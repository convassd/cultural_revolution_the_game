import { describe, expect, it } from 'vitest'
import { definitions } from '../data'
import { createCharacter } from '../game/effects'
import { effectiveAttack } from '../game/rules'
import { HostMatch, HIDDEN_CARD, projectState, readAction } from './protocol'

const match = () => new HostMatch(() => 0.4, 'test-match')
describe('host authority and private views', () => {
  it('validates sales and synchronizes the public active event while keeping other hand cards private', () => {
    const game = match()
    game.state.players[0].hand = ['mao_zedong', 'may_16_notice', 'zhou_enlai']
    game.state.players[0].mana = 1
    expect(game.apply({ type: 'SELL_CARD', player: 1, cardId: 'mao_zedong' }, 1, game.id, 0)).toBeTruthy()
    expect(game.apply({ type: 'SELL_CARD', player: 0, cardId: 'mao_zedong', gain: 999 }, 0, game.id, 0)).toBeNull()
    expect(game.state.players[0].mana).toBe(8)
    expect(game.state.players[0].hp).toBe(20)
    expect(game.apply({ type: 'PLAY_CARD', player: 0, cardId: 'may_16_notice' }, 0, game.id, 1)).toBeNull()
    for (const viewer of [0, 1] as const) {
      const view = game.frame(viewer).state
      expect(view.activeEvent).toEqual({ id: 'may_16_notice', owner: 0 })
      expect(view.players[0].removed).toEqual(['mao_zedong'])
      expect(view.players[0].hand).toEqual(viewer === 0 ? ['zhou_enlai'] : [''])
    }
    expect(game.apply({ type: 'SELL_CARD', player: 0, cardId: 'mao_zedong' }, 0, game.id, 2)).toBeTruthy()
  })
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
  it('projects five opening cards and fixed draws without exposing enemy IDs', () => {
    const game = match()
    expect(game.state.players.map(p => p.hand.length)).toEqual([5, 5])
    expect(game.state.players.map(p => p.deck.length)).toEqual([25, 25])
    game.state.players[1].hand = game.state.players[1].hand.slice(0, 2)
    game.state.turn = 3
    const incoming = [...game.state.players[1].hand, ...game.state.players[1].deck.slice(0, game.state.rules.drawPerTurn)]
    expect(game.apply({ type: 'END_TURN', player: 0 }, 0, game.id, 0)).toBeNull()
    expect(game.frame(1).state.players[1].hand).toEqual(incoming)
    expect(game.frame(0).state.players[1].hand).toEqual(Array(incoming.length).fill(HIDDEN_CARD))
    expect(game.frame(0).state.players[1].deck).toEqual(Array(25 - game.state.rules.drawPerTurn).fill(HIDDEN_CARD))
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
  it('reveals real hand names only to the caster and synchronizes automatic entry effects', () => {
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
    for (const viewer of [0, 1] as const) {
      const view = game.frame(viewer).state
      expect(view.players[0].board[1]!.temporaryAttack).toBe(1)
      expect('pendingPlayTarget' in view).toBe(false)
    }
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
    expect(readAction({ type: 'SELECT_PLAY_TARGET', player: 0, targetId: 'a' }, 0)).toBeNull()
    expect(readAction({ type: 'PLAY_CARD', player: 0, cardId: 'yao_wenyuan', targetId: 'weak-enemy' }, 0)).toBeNull()
    expect(readAction({ type: 'SELL_CARD', player: 0, cardId: 'may_16_notice', gain: 999 }, 0)).toEqual({ type: 'SELL_CARD', player: 0, cardId: 'may_16_notice' })
    expect(readAction({ type: 'END_TURN', player: 0, state: { hp: 999 } }, 0)).toEqual({ type: 'END_TURN', player: 0 })
    expect(readAction({ type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } }, 0)).toEqual(
      { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(projectState(match().state, 1).players[0].hand.every(id => id === HIDDEN_CARD)).toBe(true)
  })

})

describe('public turn-relative attack modifiers', () => {
  it.each([0, 1] as const)('automatically picks the strongest enemy for seat %s and sends identical public stats', caster => {
    const game = match()
    const enemy = caster === 0 ? 1 : 0
    game.state.currentPlayer = caster; game.state.turn = caster + 1
    game.state.players[caster].mana = 10; game.state.players[caster].hand = ['yao_wenyuan']
    game.state.players[enemy].board = [createCharacter(definitions.wu_han!, 'low'), createCharacter(definitions.zhu_de!, 'high')]
    expect(game.apply({ type: 'PLAY_CARD', player: caster, cardId: 'yao_wenyuan' }, caster, game.id, 0)).toBeNull()
    for (const viewer of [0, 1] as const) {
      const board = game.frame(viewer).state.players[enemy].board
      expect(board[0]!.attackModifiers).toBeUndefined()
      expect(board[1]!.attackModifiers).toEqual([{ amount: -1, expiresAtTurn: caster + 3 }])
    }
    expect(game.apply({ type: 'END_TURN', player: caster }, caster, game.id, 1)).toBeNull()
  })
  it.each([0, 1] as const)('synchronizes caster seat %s debuffs through the enemy turn and then expires them', caster => {
    const game = match()
    const enemy = caster === 0 ? 1 : 0
    game.state.currentPlayer = caster
    game.state.turn = caster + 1
    game.state.players[caster].mana = 10
    game.state.players[caster].hand = ['guan_feng']
    game.state.players[enemy].board = [createCharacter(definitions.wu_han!, 'target')]
    expect(game.apply({ type: 'PLAY_CARD', player: caster, cardId: 'guan_feng' }, caster, game.id, game.revision)).toBeNull()
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
