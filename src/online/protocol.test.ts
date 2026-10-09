import { describe, expect, it } from 'vitest'
import { definitions } from '../data'
import { createCharacter } from '../game/effects'
import { effectiveAttack, EVENT_UNLOCK_TURN } from '../game/rules'
import { HostMatch, HIDDEN_CARD, projectState, readAction } from './protocol'

const match = () => new HostMatch(() => 0.4, 'test-match')
describe('host authority and private views', () => {
  it('assigns opposite seats, with either host or guest able to open', () => {
    expect(match().hostSeat).toBe(0)
    const second = new HostMatch(() => 0.9, 'second')
    expect(second.hostSeat).toBe(1)
    expect(second.guestSeat).toBe(0)
    expect(second.state.currentPlayer).toBe(0)
  })
  it('redacts both deck orders and only the opponent hand, without mutating authority', () => {
    const game = match()
    const original = structuredClone(game.state)
    for (const seat of [0, 1] as const) {
      const frame = game.frame(seat)
      expect(frame.state.players[seat].hand).toEqual(original.players[seat].hand)
      const enemy = seat === 0 ? 1 : 0
      expect(frame.state.players[enemy].hand).toEqual(original.players[enemy].hand.map(() => HIDDEN_CARD))
      for (const player of frame.state.players) expect(player.deck).toEqual(original.players[player.id].deck.map(() => HIDDEN_CARD))
      expect(frame.state.eventPool.deck).toEqual(Array(12).fill(HIDDEN_CARD))
    }
    expect(game.state).toEqual(original)
  })
  it('projects five opening cards and a multi-card refill without exposing enemy IDs', () => {
    const game = match()
    expect(game.state.players.map(p => p.hand.length)).toEqual([5, 5])
    expect(game.state.players.map(p => p.deck.length)).toEqual([19, 19])
    game.state.players[1].hand = game.state.players[1].hand.slice(0, 2)
    const incoming = [...game.state.players[1].hand, ...game.state.players[1].deck.slice(0, 3)]
    expect(game.apply({ type: 'END_TURN', player: 0 }, 0, game.id, 0)).toBeNull()
    expect(game.frame(1).state.players[1].hand).toEqual(incoming)
    expect(game.frame(0).state.players[1].hand).toEqual(Array(5).fill(HIDDEN_CARD))
    expect(game.frame(0).state.players[1].deck).toEqual(Array(16).fill(HIDDEN_CARD))
  })
  it('rejects forged seats, malformed requests, illegal plays, duplicates and old matches', () => {
    const game = match()
    const original = structuredClone(game.state)
    for (const action of [null, { type: 'UNKNOWN', player: 0 }, { type: 'ATTACK', player: 0 },
      { type: 'END_TURN', player: 1 }, { type: 'PLAY_CARD', player: 0, cardId: 'not-a-card' }]) {
      expect(game.apply(action, 0, game.id, 0)).toBeTruthy()
      expect(game.state).toEqual(original)
    }
    expect(game.apply({ type: 'END_TURN', player: 0 }, 0, 'old-match', 0)).toBeTruthy()
    expect(game.apply({ type: 'END_TURN', player: 0 }, 0, game.id, 0)).toBeNull()
    expect(game.revision).toBe(1)
    expect(game.apply({ type: 'END_TURN', player: 1 }, 1, game.id, 0)).toBeTruthy()
    expect(game.state.turn).toBe(2)
    expect(game.apply({ type: 'END_TURN', player: 0 }, 0, game.id, 1)).toBeTruthy()
  })
  it('reveals real hand names only to the caster and does not leak target choices to the observer', () => {
    const game = match()
    game.state.players[0].hand = ['kang_sheng', 'zhang_chunqiao']
    game.state.players[0].mana = 10
    game.state.players[0].board = [createCharacter(definitions.wu_han!, 'friendly')]
    game.state.players[1].hand = ['mao_zedong', 'lin_biao']
    expect(game.apply({ type: 'PLAY_CARD', player: 0, cardId: 'kang_sheng' }, 0, game.id, 0)).toBeNull()
    expect(game.frame(0).state.revealedHand?.cards).toEqual(['mao_zedong', 'lin_biao'])
    expect(game.frame(0).reveal).toBe(true)
    expect(game.frame(1).state.revealedHand).toBeNull()
    expect(game.frame(1).reveal).toBe(false)
    expect(game.apply({ type: 'PLAY_CARD', player: 0, cardId: 'zhang_chunqiao' }, 0, game.id, 1)).toBeNull()
    expect(game.frame(0).reveal).toBe(false)
    expect(game.frame(0).state.pendingPlayTarget?.targetIds).toEqual(['friendly', 'character-1'])
    expect(game.frame(1).state.pendingPlayTarget).toBeNull()
  })
  it('produces public damage and death events while retaining all entry and combat rules', () => {
    const game = match()
    game.state.players[0].board = [createCharacter(definitions.nie_yuanzi!, 'attacker')]
    game.state.players[1].hp = 1
    expect(game.apply({ type: 'ATTACK', player: 0, attackerId: 'attacker', target: { type: 'player' } }, 0, game.id, 0)).toBeNull()
    expect(game.frame(1).state.winner).toBe(0)
    expect(game.frame(1).events).toContainEqual({ type: 'PLAYER_DAMAGED', playerId: 1, amount: 3 })
    expect(game.apply({ type: 'END_TURN', player: 0 }, 0, game.id, 1)).toBeTruthy()
  })
  it('normalizes requests without retaining arbitrary payload fields', () => {
    expect(readAction({ type: 'USE_EVENT', player: 0, eventId: 'february_outline', cost: 0 }, 0)).toEqual({ type: 'USE_EVENT', player: 0, eventId: 'february_outline' })
    expect(readAction({ type: 'USE_EVENT', player: 1, eventId: 'february_outline' }, 0)).toBeNull()
    for (const eventId of ['', null, 3, {}, 'x'.repeat(101)]) expect(readAction({ type: 'USE_EVENT', player: 0, eventId }, 0)).toBeNull()
    expect(readAction({ type: 'END_TURN', player: 0, state: { hp: 999 } }, 0)).toEqual({ type: 'END_TURN', player: 0 })
    expect(readAction({ type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } }, 0)).toEqual(
      { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(projectState(match().state, 1).players[0].hand.every(id => id === HIDDEN_CARD)).toBe(true)
  })
  it('shares event slots and discard but hides replacement order; host enforces cost, once-per-turn and revisions', () => {
    const game = match()
    expect(game.apply({ type: 'USE_EVENT', player: 0, eventId: 'february_outline' }, 0, game.id, 0)).toBeTruthy()
    game.state.turn = EVENT_UNLOCK_TURN - 1
    expect(game.apply({ type: 'END_TURN', player: 0 }, 0, game.id, 0)).toBeNull()
    game.state.eventPool.slots = ['february_outline', 'huairentang_incident']
    game.state.eventPool.deck = ['may_16_notice']
    expect(game.apply({ type: 'USE_EVENT', player: 1, eventId: 'huairentang_incident' }, 1, game.id, 1)).toBeTruthy()
    expect(game.apply({ type: 'USE_EVENT', player: 1, eventId: 'not-a-card' }, 1, game.id, 1)).toBeTruthy()
    expect(game.apply({ type: 'USE_EVENT', player: 1, eventId: 'february_outline' }, 1, game.id, 1)).toBeNull()
    expect(game.state.players[1].mana).toBe(1)
    expect(game.frame(0).state.eventPool).toEqual(game.frame(1).state.eventPool)
    expect(game.frame(1).state.eventPool).toEqual({ slots: ['may_16_notice', 'huairentang_incident'], deck: [], discard: ['february_outline'], usedThisTurn: true })
    expect(game.apply({ type: 'USE_EVENT', player: 1, eventId: 'may_16_notice' }, 1, game.id, 1)).toBeTruthy()
    expect(game.apply({ type: 'USE_EVENT', player: 1, eventId: 'may_16_notice' }, 1, game.id, 2)).toBeTruthy()
    expect(game.state.eventPool.discard).toEqual(['february_outline'])
  })
})

describe('public turn-relative attack modifiers', () => {
  it.each([0, 1] as const)('synchronizes caster seat %s debuffs through the enemy turn and then expires them', caster => {
    const game = match()
    const enemy = caster === 0 ? 1 : 0
    game.state.currentPlayer = caster
    game.state.turn = caster + 1
    game.state.players[caster].mana = 10
    game.state.players[caster].hand = ['guan_feng']
    game.state.players[enemy].board = [createCharacter(definitions.wu_han!, 'target')]
    expect(game.apply({ type: 'PLAY_CARD', player: caster, cardId: 'guan_feng', targetId: 'target' }, caster, game.id, game.revision)).toBeNull()
    expect(game.apply({ type: 'END_TURN', player: caster }, caster, game.id, game.revision)).toBeNull()
    for (const viewer of [0, 1] as const) {
      const state = game.frame(viewer).state
      expect(state.players[enemy].board[0]!.attackModifiers).toEqual([{ amount: -1, expiresAtTurn: caster + 3 }])
      expect(effectiveAttack(state.players[enemy].board[0]!, state.players[enemy].board, definitions)).toBe(1)
    }
    expect(game.apply({ type: 'END_TURN', player: enemy }, enemy, game.id, game.revision)).toBeNull()
    for (const viewer of [0, 1] as const) {
      const state = game.frame(viewer).state
      expect(state.players[enemy].board[0]!.attackModifiers).toEqual([])
      expect(effectiveAttack(state.players[enemy].board[0]!, state.players[enemy].board, definitions)).toBe(2)
    }
  })
})
