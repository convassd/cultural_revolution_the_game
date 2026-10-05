import { describe, expect, it } from 'vitest'
import { definitions } from '../data'
import { createCharacter } from '../game/effects'
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
    }
    expect(game.state).toEqual(original)
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
    expect(readAction({ type: 'END_TURN', player: 0, state: { hp: 999 } }, 0)).toEqual({ type: 'END_TURN', player: 0 })
    expect(readAction({ type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } }, 0)).toEqual(
      { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(projectState(match().state, 1).players[0].hand.every(id => id === HIDDEN_CARD)).toBe(true)
  })
})
