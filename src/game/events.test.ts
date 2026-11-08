import { describe, expect, it } from 'vitest'
import { characters, definitions } from '../data'
import { eventCards } from '../data/events'
import { createCharacter } from './effects'
import { applyAction, createGame } from './engine'
import { effectiveAttack } from './rules'
import { chooseGreedyAction, legalTurnActions } from './ai'
import { observeForAi, planTurn } from './aiPlanner'
import type { EventId, GameState } from './types'

const unit = (id: string) => createCharacter(definitions[id]!, id)
function fixture(...hand: string[]) {
  const state = createGame(characters, () => .5)
  state.players[0].hand = hand
  state.players[0].mana = 30
  return state
}
function play(state: GameState, cardId: string) {
  const original = structuredClone(state)
  const result = applyAction(state, { type: 'PLAY_CARD', player: state.currentPlayer, cardId }, definitions, () => .5)
  expect(result.error).toBeNull()
  expect(state).toEqual(original)
  return result.state
}
function attack(state: GameState, seat: 0 | 1, index = 0) {
  return effectiveAttack(state.players[seat].board[index]!, state.players[seat].board, definitions, state.activeEvent?.id)
}
const end = (s: GameState) => applyAction(s, { type: 'END_TURN', player: s.currentPlayer }, definitions, () => .5).state

describe('mixed private events and continuous global auras', () => {
  it('keeps Escalation duration independent of event replacement and turn handoffs', () => {
    let state = fixture('yao_wenyuan', 'may_16_notice')
    state.players[1].board = [unit('mao_yuanxin')]
    state = applyAction(state, { type: 'PLAY_CARD', player: 0, cardId: 'yao_wenyuan' }, definitions).state
    state = play(state, 'may_16_notice')
    expect(attack(state, 1)).toBe(3)
    state = end(state)
    expect(attack(state, 1)).toBe(3)
    state.players[1].hand = ['purge_may_16']; state.players[1].mana = 3
    state = play(state, 'purge_may_16')
    expect(attack(state, 1)).toBe(2)
    state = end(state)
    expect(attack(state, 1)).toBe(3)
  })
  it('deals all 60 unique cards across two 30-card decks with five opening cards', () => {
    const state = fixture()
    const real = createGame(characters, () => .5)
    const ids = real.players.flatMap(p => [...p.hand, ...p.deck])
    expect(ids).toHaveLength(60)
    expect(new Set(ids).size).toBe(60)
    expect(eventCards.every(card => ids.includes(card.id))).toBe(true)
    expect(real.players.map(p => p.deck.length)).toEqual([25, 25])
    expect(state.activeEvent).toBeNull()
    expect('eventPool' in real).toBe(false)
  })
  it('plays an event from hand even with a full board, replaces it and discards the old owner card', () => {
    let state = fixture('february_outline', 'may_16_notice')
    state.players[0].board = Array.from({ length: 5 }, (_, i) => ({ ...unit('nie_yuanzi'), instanceId: String(i) }))
    state = play(state, 'february_outline')
    expect(state.activeEvent).toEqual({ id: 'february_outline', owner: 0 })
    expect(state.players[0].mana).toBe(29)
    expect(attack(state, 0)).toBe(2)
    state = play(state, 'may_16_notice')
    expect(state.activeEvent!.id).toBe('may_16_notice')
    expect(state.players[0].discard).toEqual(['february_outline'])
    expect(attack(state, 0)).toBe(4)
    state = end(state)
    state.players[1].hand = ['purge_may_16']; state.players[1].mana = 3
    state = play(state, 'purge_may_16')
    expect(state.players[0].discard).toEqual(['february_outline', 'may_16_notice'])
    expect(state.activeEvent!.owner).toBe(1)
  })
  it('affects both factions and later entrants across turns, then removes the old aura', () => {
    let state = fixture('may_16_notice', 'mao_yuanxin', 'purge_may_16')
    state.players[0].board = [unit('nie_yuanzi')]
    state.players[1].board = [unit('peng_zhen')]
    state = play(state, 'may_16_notice')
    expect(attack(state, 0)).toBe(4); expect(attack(state, 1)).toBe(3)
    state = play(state, 'mao_yuanxin')
    expect(attack(state, 0, 1)).toBe(4)
    state = end(end(state))
    expect(attack(state, 0)).toBe(4); expect(attack(state, 1)).toBe(3)
    state.players[0].mana = 10
    state = play(state, 'purge_may_16')
    expect(attack(state, 0)).toBe(3); expect(attack(state, 1)).toBe(4)
  })
  it('makes January Storm global, with one draw per qualifying player only at entry', () => {
    let state = fixture('january_storm')
    state.players[0].board = [unit('jiang_qing')]; state.players[1].board = [unit('yao_wenyuan')]
    state.players[0].deck = ['wu_han']; state.players[1].deck = ['may_16_notice']
    const enemyCount = state.players[1].hand.length
    state = play(state, 'january_storm')
    expect(state.players[0].hand).toEqual(['wu_han'])
    expect(state.players[1].hand).toHaveLength(enemyCount + 1)
    expect(attack(state, 0)).toBe(5); expect(attack(state, 1)).toBe(5)
    state = end(state)
    expect(state.players[1].hand).toHaveLength(enemyCount + 1)
  })
  it('makes Wen Gong Wu Wei global, damaging once and retaining the attack aura', () => {
    let state = fixture('wen_gong_wu_wei')
    state.players[0].board = [unit('nie_yuanzi')]; state.players[1].board = [unit('mao_yuanxin')]
    state = play(state, 'wen_gong_wu_wei')
    expect(state.players.map(p => p.board[0]!.health)).toEqual([2, 3])
    state = end(end(state))
    expect(state.players.map(p => p.board[0]!.health)).toEqual([2, 3])
    expect(attack(state, 0)).toBe(5); expect(attack(state, 1)).toBe(5)
  })
  it('heals both sides once, caps at print and buffs current Conservatives dynamically', () => {
    let state = fixture('comprehensive_rectification')
    state.players[0].board = [unit('peng_zhen')]; state.players[1].board = [unit('deng_xiaoping')]
    state.players[0].board[0]!.health = 3; state.players[1].board[0]!.health = 1
    state = play(state, 'comprehensive_rectification')
    expect(state.players.map(p => p.board[0]!.health)).toEqual([4, 2])
    state = end(end(state))
    expect(state.players.map(p => p.board[0]!.health)).toEqual([4, 2])
    expect(attack(state, 1)).toBe(3)
    state.players[1].board[0]!.factionOverride = '无派别'
    expect(attack(state, 1)).toBe(2)
  })
  it.each(['bombard_headquarters', 'april_5_incident'] as const)('%s sets Deng to one without damage triggers or a return', id => {
    let state = fixture(id)
    state.players[0].board = [unit('deng_xiaoping'), unit('liu_shaoqi')]
    state = play(state, id)
    expect(state.players[0].board[0]!.health).toBe(1)
    expect(state.players[0].pendingReturns).toEqual([])
    expect(state.players[0].board[1]!.toughUsed).toBe(false)
  })
  it('July 20 sets named cards to one and leaves a persistent Military/Rebel aura', () => {
    let state = fixture('july_20_incident')
    state.players[0].board = [unit('wang_li')]; state.players[1].board = [unit('chen_zaidao')]
    state = play(state, 'july_20_incident')
    expect(state.players.map(p => p.board[0]!.health)).toEqual([1, 1])
    expect(attack(end(state), 1)).toBe(5)
  })
  it('February Countercurrent applies faction and six named extra bonuses', () => {
    let state = fixture('february_countercurrent')
    state.players[0].board = [unit('chen_yi'), unit('nie_yuanzi')]
    state.players[1].board = [unit('li_fuchun')]
    state = play(state, 'february_countercurrent')
    expect(attack(state, 0)).toBe(6); expect(attack(state, 0, 1)).toBe(2); expect(attack(state, 1)).toBe(5)
  })
  it('Purge combines extra Poisonous Weeds damage into one hit', () => {
    let state = fixture('purge_may_16')
    state.players[0].board = [unit('wang_li'), unit('nie_yuanzi')]
    state = play(state, 'purge_may_16')
    expect(state.players[0].board.map(c => c.health)).toEqual([1, 2])
  })
  it('September 13 triggers Lin departure once and kills both named relatives', () => {
    let state = fixture('september_13_incident')
    state.players[0].board = [unit('lin_biao'), unit('ye_qun')]
    state.players[1].board = [unit('lin_liguo'), unit('huang_yongsheng')]
    state = play(state, 'september_13_incident')
    expect(state.players[0].board).toEqual([])
    expect(state.players[1].board.map(c => c.definitionId)).toEqual(['huang_yongsheng'])
    expect(attack(state, 1)).toBe(3)
    expect(state.log.filter(s => s.includes('离场爆炸'))).toHaveLength(1)
  })
  it('Huairentang bypasses Mediation and removes Gang members on both sides', () => {
    let state = fixture('huairentang_incident')
    state.players[0].board = [unit('jiang_qing'), unit('zhou_enlai')]
    state.players[1].board = [unit('yao_wenyuan'), unit('nie_yuanzi')]
    state = play(state, 'huairentang_incident')
    expect(state.players[0].board.map(c => c.definitionId)).toEqual(['zhou_enlai'])
    expect(state.players[1].board.map(c => c.definitionId)).toEqual(['nie_yuanzi'])
    expect(attack(state, 1)).toBe(2)
  })
  it('AI sees only its own mixed hand and cannot sell hypothetical draws in a cached plan', () => {
    const state = fixture('may_16_notice')
    state.players[0].board = [unit('nie_yuanzi')]; state.players[0].board[0]!.canAttack = true
    state.players[1].hp = 4
    state.players[0].mana = 2
    expect(chooseGreedyAction(state, definitions)).toMatchObject({ type: 'PLAY_CARD', cardId: 'may_16_notice' })
    expect(planTurn(state, definitions).steps[0]!.action).toMatchObject({ type: 'PLAY_CARD', cardId: 'may_16_notice' })
    expect(legalTurnActions(state, definitions)).toContainEqual({ type: 'SELL_CARD', player: 0, cardId: 'may_16_notice' })
    expect(observeForAi(state).players[1].hand.every(id => id === '')).toBe(true)
  })
})
