import { describe, expect, it } from 'vitest'
import { ABILITIES } from '../data/abilities'
import { characters, definitions, cardDefinitions } from '../data'
import { applyAction, createGame, shuffle } from './engine'
import { resolveCombat } from './combat'
import { canAttackPlayer, effectiveAttack, factionBonus, groupBonus } from './rules'
import type { CharacterInstance, Faction, GameAction, GameState } from './types'

function instance(id: string, instanceId = id, canAttack = true): CharacterInstance {
  return { definitionId: id, instanceId, health: definitions[id]!.health, canAttack, temporaryAttack: 0, toughUsed: false }
}
function fixture(): GameState {
  return createGame(characters, () => 0.5)
}
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action, definitions, () => 0.5)
  expect(result.error).toBeNull()
  return result.state
}

describe('data and setup', () => {
  it('has exactly 48 unique cards and the specified groups and abilities', () => {
    expect(characters).toHaveLength(48)
    expect(new Set(characters.map(c => c.id)).size).toBe(48)
    expect(new Set(characters.map(c => c.image)).size).toBe(48)
    expect(characters.filter(c => c.rarity === 'SSR')).toHaveLength(5)
    expect(characters.filter(c => c.rarity === 'SR')).toHaveLength(14)
    for (const [group, count] of [['gang_of_four', 4], ['lin_group', 7], ['wang_guan_qi', 3]] as const) {
      expect(characters.filter(c => c.relationGroup === group)).toHaveLength(count)
    }
    for (const card of characters) {
      expect(card.type).toBe('character')
      expect(card.image).toMatch(/^\/portraits\//)
      expect(card.cost).toBeGreaterThan(0)
      if (card.abilityId) expect(ABILITIES[card.abilityId]).toBeDefined()
    }
  })
  it('shuffles without mutating input and can inject deterministic randomness', () => {
    const input = [1, 2, 3, 4]
    expect(shuffle(input, () => 0)).toEqual([2, 3, 4, 1])
    expect(input).toEqual([1, 2, 3, 4])
    expect(fixture()).toEqual(fixture())
  })
  it('deals five starting cards to each seat without an extra opening draw', () => {
    const state = fixture()
    expect(state.players.map(p => p.hp)).toEqual([20, 20])
    expect(state.players.map(p => p.hand.length)).toEqual([5, 5])
    expect(state.players.map(p => p.deck.length)).toEqual([25, 25])
    const all = state.players.flatMap(p => [...p.hand, ...p.deck])
    expect(new Set(all).size).toBe(60)
    expect(state.players[0].mana).toBe(state.rules.energyPerTurn)
    expect(state.players[1].mana).toBe(0)
  })
  it('rejects missing or duplicate definitions at setup', () => {
    expect(() => createGame(characters.slice(1))).toThrow()
    expect(() => createGame([...characters.slice(1), characters[1]!])).toThrow()
  })
  it.each([1,2,3,41,999])('separately shuffles equal card types and interleaves 4 characters then 1 event: seed %i', seed => {
    let value = seed
    const random = () => ((value = (Math.imul(value,1664525)+1013904223) >>> 0) / 4294967296)
    const state = createGame(characters,random)
    const all: string[] = []
    for (const player of state.players) {
      const deck = [...player.hand,...player.deck]
      expect(deck.filter(id=>cardDefinitions[id]!.type==='character')).toHaveLength(24)
      expect(deck.filter(id=>cardDefinitions[id]!.type==='event')).toHaveLength(6)
      expect(deck.map(id=>cardDefinitions[id]!.type)).toEqual(Array.from({length:6},()=>['character','character','character','character','event']).flat())
      all.push(...deck)
    }
    expect(new Set(all).size).toBe(60)
  })
})

describe('turns and playing', () => {
  it('grants only seat 2 an opening energy bonus once, retaining the same hand and base E', () => {
    let state = createGame(characters, () => .5, { energyPerTurn: 5, drawPerTurn: 2, secondPlayerOpeningBonus: 2 })
    expect(state.players[0].mana).toBe(5)
    const opening = [...state.players[1].hand]
    state = act(state, { type: 'END_TURN', player: 0 })
    expect(state.players[1]).toMatchObject({ mana: 7, maxMana: 5, hand: opening })
    state.players[1].mana = 25
    state = act(state, { type: 'END_TURN', player: 1 })
    expect(state.players[0].mana).toBe(5)
    state = act(state, { type: 'END_TURN', player: 0 })
    expect(state.players[1]).toMatchObject({ mana: 5, maxMana: 5 })
    expect(state.players[1].hand).toHaveLength(7)
  })
  it.each([-1, .5, Infinity, NaN])('rejects invalid opening bonus %s', secondPlayerOpeningBonus => {
    expect(() => createGame(characters, () => .5, { energyPerTurn: 5, drawPerTurn: 2, secondPlayerOpeningBonus })).toThrow()
  })
  it('resets energy to E on every own turn without growth or carryover', () => {
    let state = createGame(characters, () => .5, { energyPerTurn: 3, drawPerTurn: 2 })
    state.players[0].mana = 17
    state = act(state, { type: 'END_TURN', player: 0 })
    expect(state.players[1].mana).toBe(3)
    state = act(state, { type: 'END_TURN', player: 1 })
    expect(state.players[0]).toMatchObject({ mana: 3, maxMana: 3 })
    expect(state.players[0].hand).toHaveLength(7)
  })
  it('pays cost, moves a card, preserves the input snapshot and applies summoning sickness', () => {
    const state = fixture()
    state.players[0].hand = ['wu_han']
    state.players[0].mana = 3
    const original = structuredClone(state)
    const next = act(state, { type: 'PLAY_CARD', player: 0, cardId: 'wu_han' })
    expect(state).toEqual(original)
    expect(next.players[0].hand).toHaveLength(0)
    expect(next.players[0].mana).toBe(1)
    expect(next.players[0].board[0]).toMatchObject({ definitionId: 'wu_han', health: 3, canAttack: false })
    const attempt = applyAction(next, { type: 'ATTACK', player: 0, attackerId: next.players[0].board[0]!.instanceId, target: { type: 'player' } }, definitions)
    expect(attempt.error).not.toBeNull()
  })
  it('rejects wrong player, missing card, insufficient mana and a full board without changes', () => {
    const state = fixture()
    state.players[0].hand = ['mao_zedong']
    const actions: GameAction[] = [
      { type: 'END_TURN', player: 1 },
      { type: 'PLAY_CARD', player: 0, cardId: 'wu_han' },
      { type: 'PLAY_CARD', player: 0, cardId: 'mao_zedong' },
    ]
    for (const action of actions) {
      const result = applyAction(state, action, definitions)
      expect(result.error).not.toBeNull()
      expect(result.state).toBe(state)
    }
    state.players[0].mana = 10
    state.players[0].board = Array.from({ length: 5 }, (_, i) => instance('wu_han', `${i}`))
    expect(applyAction(state, actions[2]!, definitions).error).toContain('已满')
  })
  it('readies characters only at their next own turn and allows one attack', () => {
    let state = fixture()
    state.players[0].board = [instance('wu_han', 'a', false)]
    state = act(state, { type: 'END_TURN', player: 0 })
    expect(state.players[0].board[0]!.canAttack).toBe(false)
    state = act(state, { type: 'END_TURN', player: 1 })
    expect(state.players[0].board[0]!.canAttack).toBe(true)
    const attack: GameAction = { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'player' } }
    state = act(state, attack)
    expect(state.players[1].hp).toBe(18)
    expect(state.players[0].board[0]!.health).toBe(3)
    expect(applyAction(state, attack, definitions).error).not.toBeNull()
  })
  it.each([0, 2, 5, 8])('draws exactly K into a retained hand of %i cards', count => {
    let state = fixture()
    state.rules.drawPerTurn = 2
    state.turn = 2
    state.currentPlayer = 1
    state.players[0].hand = Array(count).fill('wu_han')
    state.players[0].deck = ['lin_liguo', 'may_16_notice', 'chen_yi']
    const before = structuredClone(state)
    state = act(state, { type: 'END_TURN', player: 1 })
    expect(state.players[0].hand).toEqual([...before.players[0].hand, 'lin_liguo', 'may_16_notice'])
    expect(state.players[0].deck).toEqual(['chen_yi'])
  })
  it('stops at an empty deck without fatigue and accepts K=0', () => {
    let state = createGame(characters, () => .5, { energyPerTurn: 2, drawPerTurn: 3 })
    state.turn = 2; state.currentPlayer = 1
    state.players[0].deck = ['wu_han']
    state = act(state, { type: 'END_TURN', player: 1 })
    expect(state.players[0].hand).toHaveLength(6)
    expect(state.players[0].hp).toBe(20)
    expect(state.log.at(-1)).toContain('牌库已空')
    expect(createGame(characters, () => .5, { energyPerTurn: 1, drawPerTurn: 0 }).players[0].hand).toHaveLength(5)
    expect(() => createGame(characters, () => .5, { energyPerTurn: 0, drawPerTurn: 2 })).toThrow()
  })
  it('sells characters and events permanently, permits energy above E, and forbids replay or resale', () => {
    let state = fixture()
    state.players[0].hand = ['mao_zedong', 'may_16_notice', 'zhu_de']
    const before = structuredClone(state)
    state = act(state, { type: 'SELL_CARD', player: 0, cardId: 'mao_zedong' })
    state = act(state, { type: 'SELL_CARD', player: 0, cardId: 'may_16_notice' })
    expect(state.players[0].mana).toBe(before.players[0].mana + 9)
    expect(state.players[0].removed).toEqual(['mao_zedong', 'may_16_notice'])
    expect(before.players[0].removed).toEqual([])
    expect(applyAction(state, { type: 'SELL_CARD', player: 0, cardId: 'mao_zedong' }, definitions).state).toBe(state)
    expect(applyAction(state, { type: 'PLAY_CARD', player: 0, cardId: 'mao_zedong' }, definitions).error).toBeTruthy()
    state = act(state, { type: 'PLAY_CARD', player: 0, cardId: 'zhu_de' })
    expect(state.players[0].board[0]!.definitionId).toBe('zhu_de')
  })

})

describe('combat and aura', () => {
  it('applies only the three directed faction advantages', () => {
    const factions: Faction[] = ['造反派', '保守派', '军队', '无派别']
    const pairs = new Set(['造反派保守派', '保守派军队', '军队造反派'])
    for (const a of factions) for (const b of factions) {
      expect(factionBonus(a, b)).toBe(pairs.has(a + b) ? 1 : 0)
    }
  })
  it('calculates simultaneous damage with independent faction bonuses on retaliation', () => {
    expect(resolveCombat({ attack: 3, health: 4, faction: '保守派' }, { attack: 4, health: 5, faction: '造反派' }))
      .toMatchObject({ attackerHealth: -1, defenderHealth: 2, toDefender: 3, toAttacker: 5 })
  })
  it('computes dynamic group bonuses with a +2 cap, without modifying definitions', () => {
    const ids = ['jiang_qing', 'zhang_chunqiao', 'yao_wenyuan', 'wang_hongwen']
    const board = ids.map(id => instance(id))
    for (let count = 1; count <= 4; count++) {
      expect(groupBonus(definitions.jiang_qing!, board.slice(0, count), definitions)).toBe(Math.min(2, count - 1))
    }
    expect(groupBonus(definitions.wu_han!, board, definitions)).toBe(0)
    expect(definitions.jiang_qing!.attack).toBe(3)
  })
  it('removes both dead characters and sends each to its own discard', () => {
    const state = fixture()
    state.players[0].board = [instance('kuai_dafu', 'a')]
    state.players[1].board = [instance('wu_han', 'b')]
    const next = act(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(next.players.map(p => p.board.length)).toEqual([0, 0])
    expect(next.players[0].discard).toEqual(['kuai_dafu'])
    expect(next.players[1].discard).toEqual(['wu_han'])
  })
  it('uses aura before damage, then immediately decreases it after a group member dies', () => {
    const state = fixture()
    state.players[0].board = [instance('wang_li', 'a'), instance('guan_feng', 'c')]
    state.players[1].board = [instance('zhu_de', 'b')]
    const next = act(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(next.players[1].board[0]!.health).toBe(2)
    expect(next.players[0].board).toHaveLength(1)
    expect(effectiveAttack(next.players[0].board[0]!, next.players[0].board, definitions)).toBe(3)
  })
  it('rejects attacks by enemy characters or against friendly/nonexistent targets', () => {
    const state = fixture()
    state.players[0].board = [instance('wu_han', 'a')]
    state.players[1].board = [instance('wu_han', 'b')]
    for (const [attackerId, targetId] of [['b', 'a'], ['a', 'a'], ['a', 'missing']]) {
      const result = applyAction(state, { type: 'ATTACK', player: 0, attackerId, target: { type: 'character', instanceId: targetId } }, definitions)
      expect(result.error).not.toBeNull()
      expect(result.state).toBe(state)
    }
  })
  it('ends the game at zero HP and rejects further actions', () => {
    const state = fixture()
    state.players[0].board = [instance('wu_han', 'a')]
    state.players[1].hp = 1
    const next = act(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'player' } })
    expect(next.winner).toBe(0)
    expect(next.players[1].hp).toBe(0)
    expect(applyAction(next, { type: 'END_TURN', player: 0 }, definitions).state).toBe(next)
    expect(applyAction(next, { type: 'END_TURN', player: 0 }, definitions).error).not.toBeNull()
  })
  it('can finish a deterministic legal match while conserving all 60 unique cards', () => {
    let state = fixture()
    for (let turn = 0; turn < 100 && state.winner === null; turn++) {
      const id = state.currentPlayer
      for (const cardId of [...state.players[id].hand]) {
        if (state.players[id].board.length < 5 && cardDefinitions[cardId]!.cost <= state.players[id].mana) {
          const enemy = state.players[id === 0 ? 1 : 0]
          state = act(state, { type: 'PLAY_CARD', player: id, cardId })
        }
      }
      for (const card of [...state.players[id].board]) {
        if (card.canAttack && state.winner === null) {
          const enemy = state.players[id === 0 ? 1 : 0]
          const target = canAttackPlayer(enemy, definitions)
            ? { type: 'player' as const }
            : { type: 'character' as const, instanceId: enemy.board[0]!.instanceId }
          state = act(state, { type: 'ATTACK', player: id, attackerId: card.instanceId, target })
        }
      }
      const all = state.players.flatMap(p => [...p.deck, ...p.hand, ...p.discard, ...p.removed,
        ...p.board.map(c => c.definitionId), ...p.pendingReturns.map(c => c.definitionId)])
      if (state.activeEvent) all.push(state.activeEvent.id)
      expect(all).toHaveLength(60)
      expect(new Set(all).size).toBe(60)
      if (state.winner === null) state = act(state, { type: 'END_TURN', player: id })
    }
    expect(state.winner).not.toBeNull()
  })
})
