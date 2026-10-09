import { describe, expect, it } from 'vitest'
import { characters, definitions } from '../data'
import { eventCards } from '../data/events'
import { createCharacter } from './effects'
import { applyAction, createGame } from './engine'
import { chooseGreedyAction, legalTurnActions } from './ai'
import { observeForAi, planTurn } from './aiPlanner'
import { effectiveAttack, EVENT_UNLOCK_TURN } from './rules'
import { createBattlePresentation } from '../presentation/battle'
import type { EventId, GameState } from './types'

function unit(id: string) { return createCharacter(definitions[id]!, id) }
function fixture(eventId: EventId): GameState {
  const state = createGame(characters, () => .5)
  state.turn = EVENT_UNLOCK_TURN + 1
  state.eventPool = { slots: [eventId, null], deck: [], discard: [], usedThisTurn: false }
  for (const player of state.players) { player.hand = []; player.deck = []; player.mana = player.maxMana = 10 }
  return state
}
function use(state: GameState, eventId: EventId) {
  const original = structuredClone(state)
  const result = applyAction(state, { type: 'USE_EVENT', player: state.currentPlayer, eventId }, definitions)
  expect(result.error).toBeNull()
  expect(state).toEqual(original)
  return result
}
function hp(state: GameState, id: string) { return state.players.flatMap(p => p.board).find(c => c.definitionId === id)?.health }
function bonus(state: GameState, id: string) { return state.players.flatMap(p => p.board).find(c => c.definitionId === id)?.temporaryAttack }

describe('public event lifecycle', () => {
  it('shuffles 12 unique events independently of the 48 character cards and opens only on round 4 player 2 turn', () => {
    const state = createGame(characters, () => .5)
    expect(eventCards).toHaveLength(12)
    expect(new Set(eventCards.map(c => c.id)).size).toBe(12)
    expect(eventCards.every(c => c.type === 'event' && c.cost >= 1 && c.cost <= 5)).toBe(true)
    expect(state.eventPool.slots).toEqual([null, null])
    expect(state.eventPool.deck).toHaveLength(12)
    expect(new Set(state.eventPool.deck)).toEqual(new Set(eventCards.map(c => c.id)))
    expect(state.eventPool.deck).not.toEqual(createGame(characters, () => .9).eventPool.deck)
    expect(legalTurnActions(state, definitions).some(a => a.type === 'USE_EVENT')).toBe(false)
    let next = state
    while (next.turn < EVENT_UNLOCK_TURN) {
      expect(next.eventPool.slots).toEqual([null, null])
      expect(next.eventPool.deck).toHaveLength(12)
      expect(legalTurnActions(next, definitions).some(a => a.type === 'USE_EVENT')).toBe(false)
      next = applyAction(next, { type: 'END_TURN', player: next.currentPlayer }, definitions).state
    }
    expect(next.turn).toBe(8)
    expect(next.currentPlayer).toBe(1)
    expect(next.eventPool.slots).toEqual(state.eventPool.deck.slice(0, 2))
    expect(next.eventPool.deck).toHaveLength(10)
    expect(next.players.flatMap(p => [...p.deck, ...p.hand])).toHaveLength(48)
  })
  it('pays cost, replaces the same slot, discards once, caps usage and resets on the next player turn', () => {
    let state = fixture('february_outline')
    state.eventPool.slots[1] = 'may_16_notice'
    state.eventPool.deck = ['january_storm', 'july_20_incident']
    state = use(state, 'february_outline').state
    expect(state.players[0].mana).toBe(9)
    expect(state.eventPool).toEqual({ slots: ['january_storm', 'may_16_notice'], deck: ['july_20_incident'], discard: ['february_outline'], usedThisTurn: true })
    const rejected = applyAction(state, { type: 'USE_EVENT', player: 0, eventId: 'may_16_notice' }, definitions)
    expect(rejected.error).toBeTruthy()
    expect(rejected.state).toBe(state)
    expect(legalTurnActions(state, definitions).some(a => a.type === 'USE_EVENT')).toBe(false)
    state = applyAction(state, { type: 'END_TURN', player: 0 }, definitions).state
    expect(state.eventPool.usedThisTurn).toBe(false)
    state = use(state, 'may_16_notice').state
    expect(state.eventPool.slots).toEqual(['january_storm', 'july_20_incident'])
    expect(state.players[1].mana).toBe(8)
  })
  it.each(['opening', 'mana', 'missing', 'pending', 'wrong-seat', 'finished'])('rejects %s use without modifying state or emitting events', reason => {
    const state = fixture('february_outline')
    if (reason === 'opening') state.turn = 1
    if (reason === 'mana') state.players[0].mana = 0
    if (reason === 'missing') state.eventPool.slots = [null, null]
    if (reason === 'pending') state.pendingPlayTarget = { cardId: 'zhang_chunqiao', targetIds: ['ally'] }
    if (reason === 'finished') state.winner = 0
    const result = applyAction(state, { type: 'USE_EVENT', player: reason === 'wrong-seat' ? 1 : 0, eventId: 'february_outline' }, definitions)
    expect(result.error).toBeTruthy()
    expect(result.state).toBe(state)
    expect(result.events).toEqual([])
  })
  it('uses every event once, leaves empty slots and never reshuffles discards', () => {
    let state = createGame(characters, () => .5)
    while (state.turn < EVENT_UNLOCK_TURN) state = applyAction(state, { type: 'END_TURN', player: state.currentPlayer }, definitions).state
    for (let i = 0; i < 12; i++) {
      state.players[state.currentPlayer].mana = state.players[state.currentPlayer].maxMana = 10
      const eventId = state.eventPool.slots.find(id => id !== null)! as EventId
      state = use(state, eventId).state
      const all = [...state.eventPool.deck, ...state.eventPool.slots.filter(id => id !== null), ...state.eventPool.discard]
      expect(all).toHaveLength(12)
      expect(new Set(all).size).toBe(12)
      state = applyAction(state, { type: 'END_TURN', player: state.currentPlayer }, definitions, () => .5).state
    }
    expect(state.eventPool.slots).toEqual([null, null])
    expect(state.eventPool.deck).toEqual([])
    expect(state.eventPool.discard).toHaveLength(12)
  })
  it('clears global modifiers on both sides at turn end; later arrivals do not inherit the event', () => {
    let state = fixture('may_16_notice')
    state.players[0].board = [unit('nie_yuanzi')]
    state.players[1].board = [unit('peng_zhen')]
    state.players[0].hand = ['mao_yuanxin']
    state = use(state, 'may_16_notice').state
    state = applyAction(state, { type: 'PLAY_CARD', player: 0, cardId: 'mao_yuanxin' }, definitions).state
    expect(bonus(state, 'nie_yuanzi')).toBe(1)
    expect(bonus(state, 'mao_yuanxin')).toBe(0)
    expect(bonus(state, 'peng_zhen')).toBe(-1)
    state = applyAction(state, { type: 'END_TURN', player: 0 }, definitions).state
    expect(state.players.every(p => p.board.every(c => c.temporaryAttack === 0))).toBe(true)
  })
})

describe('event effects', () => {
  it('February Outline affects Rebels on both sides, stacks, and floors final attack at zero', () => {
    const state = fixture('february_outline')
    state.players[0].board = [unit('nie_yuanzi'), unit('peng_zhen')]
    state.players[0].board[0]!.temporaryAttack = -10
    state.players[1].board = [unit('mao_yuanxin'), unit('wu_han'), unit('chen_yi')]
    const next = use(state, 'february_outline').state
    expect(bonus(next, 'nie_yuanzi')).toBe(-11)
    expect(bonus(next, 'mao_yuanxin')).toBe(-1)
    for (const id of ['peng_zhen', 'wu_han', 'chen_yi']) expect(bonus(next, id)).toBe(0)
    expect(effectiveAttack(next.players[0].board[0]!, next.players[0].board, definitions)).toBe(0)
  })
  it('May 16 buffs Rebels and weakens Conservatives using effective, not printed, faction', () => {
    const state = fixture('may_16_notice')
    const deng = unit('deng_xiaoping'); deng.factionOverride = '无派别'
    state.players[0].board = [unit('jiang_qing'), deng]
    state.players[1].board = [unit('peng_zhen'), unit('wu_han')]
    const next = use(state, 'may_16_notice').state
    expect(bonus(next, 'jiang_qing')).toBe(1)
    expect(bonus(next, 'peng_zhen')).toBe(-1)
    expect(bonus(next, 'deng_xiaoping')).toBe(0)
    expect(bonus(next, 'wu_han')).toBe(0)
  })
  it('Bombard sets both named characters to one, bypasses damage skills, and only weakens other Conservatives', () => {
    const state = fixture('bombard_headquarters')
    state.players[0].board = [unit('liu_shaoqi'), unit('zhou_enlai')]
    state.players[1].board = [unit('deng_xiaoping'), unit('peng_zhen')]
    const result = use(state, 'bombard_headquarters')
    for (const id of ['liu_shaoqi', 'deng_xiaoping']) { expect(hp(result.state, id)).toBe(1); expect(bonus(result.state, id)).toBe(0) }
    expect(bonus(result.state, 'peng_zhen')).toBe(-1)
    expect(result.state.players[0].mediationUsed).toBe(false)
    expect(result.state.players[0].board[0]!.toughUsed).toBe(false)
    expect(result.state.players[1].pendingReturns).toEqual([])
    expect(createBattlePresentation(state, result.state, result.events, definitions)?.boards[0][0]?.damage).toBe(6)
  })
  it.each([true, false])('January Storm buffs only friendly Rebels and draws only with a friendly group member: %s', grouped => {
    const state = fixture('january_storm')
    state.players[0].board = [unit(grouped ? 'jiang_qing' : 'nie_yuanzi'), unit('peng_zhen')]
    state.players[1].board = [unit('yao_wenyuan')]
    state.players[0].deck = ['wu_han']
    state.players[0].hand = ['mao_zedong', 'lin_biao', 'zhou_enlai', 'chen_yi', 'peng_zhen']
    const next = use(state, 'january_storm').state
    expect(next.players[0].board.map(c => c.temporaryAttack)).toEqual([2, 0])
    expect(bonus(next, 'yao_wenyuan')).toBe(0)
    expect(next.players[0].hand).toHaveLength(grouped ? 6 : 5)
    expect(next.players[0].deck).toHaveLength(grouped ? 0 : 1)
  })
  it('February Countercurrent applies each faction change and all six named extra bonuses', () => {
    const state = fixture('february_countercurrent')
    const special = ['chen_yi', 'ye_jianying', 'xu_xiangqian', 'tan_zhenlin', 'li_fuchun', 'li_xiannian']
    state.players[0].board = special.slice(0, 3).map(unit)
    state.players[1].board = [...special.slice(3).map(unit), unit('nie_yuanzi'), unit('wu_han')]
    const next = use(state, 'february_countercurrent').state
    for (const id of special) expect(bonus(next, id)).toBe(2)
    expect(bonus(next, 'nie_yuanzi')).toBe(-1)
    expect(bonus(next, 'wu_han')).toBe(0)
  })
  it('July 20 sets Wang Li and Chen Zaidao to one and buffs both military and Rebel sides', () => {
    const state = fixture('july_20_incident')
    state.players[0].board = [unit('wang_li'), unit('peng_zhen')]
    state.players[1].board = [unit('chen_zaidao'), unit('nie_yuanzi')]
    const next = use(state, 'july_20_incident').state
    for (const id of ['wang_li', 'chen_zaidao']) expect(hp(next, id)).toBe(1)
    for (const id of ['wang_li', 'chen_zaidao', 'nie_yuanzi']) expect(bonus(next, id)).toBe(1)
    expect(bonus(next, 'peng_zhen')).toBe(0)
  })
  it('Wen Gong Wu Wei resolves damage and Mediation before buffing survivors, and leaves enemies alone', () => {
    const state = fixture('wen_gong_wu_wei')
    state.players[0].board = [unit('jiang_qing'), unit('nie_yuanzi'), unit('zhou_enlai')]
    for (const card of state.players[0].board.slice(0, 2)) card.health = 1
    state.players[1].board = [unit('yao_wenyuan')]
    const next = use(state, 'wen_gong_wu_wei').state
    expect(hp(next, 'jiang_qing')).toBe(1)
    expect(bonus(next, 'jiang_qing')).toBe(2)
    expect(hp(next, 'nie_yuanzi')).toBeUndefined()
    expect(next.players[0].discard).toContain('nie_yuanzi')
    expect(hp(next, 'zhou_enlai')).toBe(7)
    expect(hp(next, 'yao_wenyuan')).toBe(4)
    expect(bonus(next, 'yao_wenyuan')).toBe(0)
  })
  it('Purge May 16 deals one global damage or one combined two-damage hit for Big Poisonous Weeds', () => {
    const state = fixture('purge_may_16')
    state.players[0].board = [unit('wang_li'), unit('nie_yuanzi'), unit('peng_zhen')]
    state.players[1].board = [unit('guan_feng'), unit('qi_benyu')]
    const result = use(state, 'purge_may_16')
    for (const id of ['wang_li', 'guan_feng', 'qi_benyu']) expect(hp(result.state, id)).toBe(1)
    expect(hp(result.state, 'nie_yuanzi')).toBe(2)
    expect(hp(result.state, 'peng_zhen')).toBe(5)
    expect(result.events.filter(e => e.type === 'CHARACTER_DAMAGED' && e.instanceId === 'wang_li')).toEqual([{ type: 'CHARACTER_DAMAGED', instanceId: 'wang_li', amount: 2 }])
  })
  it('September 13 removes Lin, triggers one blast, directly removes both named family cards, and debuffs survivors', () => {
    const state = fixture('september_13_incident')
    state.players[0].board = [unit('lin_biao'), unit('zhou_enlai'), unit('ye_qun')]
    state.players[1].board = [unit('lin_liguo'), unit('wu_faxian'), unit('ye_jianying'), unit('deng_xiaoping')]
    state.players[1].board[3]!.health = 1
    const result = use(state, 'september_13_incident')
    for (const id of ['lin_biao', 'ye_qun', 'lin_liguo']) expect(hp(result.state, id)).toBeUndefined()
    expect(hp(result.state, 'zhou_enlai')).toBe(7)
    expect(result.state.players[0].mediationUsed).toBe(false)
    expect(hp(result.state, 'ye_jianying')).toBe(5)
    expect(hp(result.state, 'wu_faxian')).toBe(2)
    expect(bonus(result.state, 'wu_faxian')).toBe(-2)
    expect(result.state.players[1].pendingReturns).toHaveLength(1)
    expect(result.state.log.filter(line => line.includes('离场爆炸'))).toHaveLength(1)
    expect(result.events.filter(e => e.type === 'CHARACTER_DIED')).toHaveLength(4)
  })
  it('September 13 without Lin does not invent a blast, but still debuffs the remaining group', () => {
    const state = fixture('september_13_incident')
    state.players[0].board = [unit('ye_qun')]
    state.players[1].board = [unit('wu_faxian'), unit('wu_han')]
    const next = use(state, 'september_13_incident').state
    expect(hp(next, 'ye_qun')).toBe(4)
    expect(bonus(next, 'ye_qun')).toBe(-2)
    expect(bonus(next, 'wu_faxian')).toBe(-2)
    expect(hp(next, 'wu_han')).toBe(3)
  })
  it('Comprehensive Rectification heals only friendly wounded characters, caps at print, and buffs current Conservatives', () => {
    const state = fixture('comprehensive_rectification')
    state.players[0].board = [unit('peng_zhen'), unit('deng_xiaoping'), unit('wu_han'), unit('mao_zedong')]
    state.players[0].board[0]!.health = 4
    state.players[0].board[1]!.health = 1; state.players[0].board[1]!.factionOverride = '无派别'
    state.players[0].board[2]!.health = 2
    state.players[0].board[3]!.health = 10
    state.players[1].board = [unit('chen_yi')]; state.players[1].board[0]!.health = 1
    const next = use(state, 'comprehensive_rectification').state
    expect(next.players[0].board.map(c => c.health)).toEqual([5, 2, 3, 10])
    expect(next.players[0].board.map(c => c.temporaryAttack)).toEqual([1, 0, 0, 0])
    expect(hp(next, 'chen_yi')).toBe(1)
  })
  it('April 5 affects groups on both sides and sets Deng to one without causing a return', () => {
    const state = fixture('april_5_incident')
    state.players[0].board = [unit('jiang_qing'), unit('deng_xiaoping')]
    state.players[1].board = [unit('yao_wenyuan'), unit('nie_yuanzi')]
    const next = use(state, 'april_5_incident').state
    expect(hp(next, 'jiang_qing')).toBe(4)
    expect(hp(next, 'yao_wenyuan')).toBe(3)
    expect(bonus(next, 'jiang_qing')).toBe(-1)
    expect(bonus(next, 'yao_wenyuan')).toBe(-1)
    expect(hp(next, 'deng_xiaoping')).toBe(1)
    expect(next.players[0].pendingReturns).toEqual([])
    expect(hp(next, 'nie_yuanzi')).toBe(3)
  })
  it('Huairentang directly removes all four members across both boards, bypasses Mediation and updates auras', () => {
    const state = fixture('huairentang_incident')
    state.players[0].board = [unit('jiang_qing'), unit('zhang_chunqiao'), unit('zhou_enlai'), unit('nie_yuanzi')]
    state.players[1].board = [unit('wang_hongwen'), unit('yao_wenyuan'), unit('mao_yuanxin')]
    const result = use(state, 'huairentang_incident')
    for (const id of ['jiang_qing', 'zhang_chunqiao', 'wang_hongwen', 'yao_wenyuan']) expect(hp(result.state, id)).toBeUndefined()
    expect(hp(result.state, 'zhou_enlai')).toBe(9)
    expect(result.state.players[0].mediationUsed).toBe(false)
    expect(bonus(result.state, 'nie_yuanzi')).toBe(-1)
    expect(bonus(result.state, 'mao_yuanxin')).toBe(-1)
    expect(result.events.filter(e => e.type === 'CHARACTER_DIED')).toHaveLength(4)
  })
})

describe('event AI integration', () => {
  it('both policies can use a public event to unlock same-turn lethal', () => {
    let state = fixture('may_16_notice')
    state.players[0].board = [unit('nie_yuanzi')]
    state.players[1].hp = 4
    state.players[0].mana = 2
    expect(chooseGreedyAction(state, definitions)).toEqual({ type: 'USE_EVENT', player: 0, eventId: 'may_16_notice' })
    const plan = planTurn(state, definitions)
    expect(plan.steps[0]!.action).toEqual({ type: 'USE_EVENT', player: 0, eventId: 'may_16_notice' })
    for (const step of plan.steps) {
      const result = applyAction(state, step.action, definitions)
      expect(result.error).toBeNull(); state = result.state
    }
    expect(state.winner).toBe(0)
  })
  it('future public-event order is redacted and cannot change the chosen plan', () => {
    const state = fixture('may_16_notice')
    state.eventPool.deck = eventCards.filter(c => c.id !== 'may_16_notice').map(c => c.id)
    state.players[0].board = [unit('nie_yuanzi')]
    const hidden = structuredClone(state); hidden.eventPool.deck.reverse()
    expect(observeForAi(state).eventPool.deck).toEqual(Array(11).fill(''))
    expect(planTurn(state, definitions).steps).toEqual(planTurn(hidden, definitions).steps)
  })
})

describe('mixed event and battlecry durations', () => {
  it.each([0, 1] as const)('clears only this-turn event changes for caster seat %s', caster => {
    const enemy = caster === 0 ? 1 : 0
    let state = fixture('february_outline')
    state.currentPlayer = caster
    state.turn = caster + EVENT_UNLOCK_TURN + 1
    state.players[caster].hand = ['yao_wenyuan']
    state.players[enemy].board = [unit('mao_yuanxin')]
    state = applyAction(state, { type: 'PLAY_CARD', player: caster, cardId: 'yao_wenyuan', targetId: 'mao_yuanxin' }, definitions).state
    state = use(state, 'february_outline').state
    expect(effectiveAttack(state.players[enemy].board[0]!, state.players[enemy].board, definitions)).toBe(1)
    state = applyAction(state, { type: 'END_TURN', player: caster }, definitions).state
    expect(effectiveAttack(state.players[enemy].board[0]!, state.players[enemy].board, definitions)).toBe(2)
    state = applyAction(state, { type: 'END_TURN', player: enemy }, definitions).state
    expect(effectiveAttack(state.players[enemy].board[0]!, state.players[enemy].board, definitions)).toBe(3)
  })
})

describe('event unlock validation', () => {
  it.each([1, 2, 3, 4, 5, 6, 7])('rejects event use on turn %s even if a slot is supplied early', turn => {
    const state = fixture('february_outline')
    state.turn = turn
    state.currentPlayer = turn % 2 === 0 ? 1 : 0
    const original = structuredClone(state)
    const result = applyAction(state, { type: 'USE_EVENT', player: state.currentPlayer, eventId: 'february_outline' }, definitions)
    expect(result.error).toBeTruthy()
    expect(result.state).toBe(state)
    expect(result.events).toEqual([])
    expect(state).toEqual(original)
    expect(legalTurnActions(state, definitions).some(action => action.type === 'USE_EVENT')).toBe(false)
  })
})
