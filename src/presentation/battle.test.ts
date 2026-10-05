import { describe, expect, it } from 'vitest'
import { characters, definitions } from '../data'
import { applyAction, createGame } from '../game/engine'
import { createCharacter } from '../game/effects'
import type { GameAction, GameState } from '../game/types'
import { createBattlePresentation } from './battle'

function fixture(): GameState { return createGame(characters, () => 0.5) }
function unit(id: string, instanceId = id) {
  const character = createCharacter(definitions[id]!, instanceId)
  character.canAttack = true
  return character
}
function run(state: GameState, action: GameAction, roll = 4) {
  const before = structuredClone(state)
  const result = applyAction(state, action, definitions, () => (roll - 0.5) / 6)
  expect(result.error).toBeNull()
  const presentation = createBattlePresentation(state, result.state, result.events, definitions)
  expect(state).toEqual(before)
  return { ...result, presentation }
}

describe('battle feedback without delayed game rules', () => {
  it('reports simultaneous mutual kills, immediately removes them from state and keeps two visual ghosts', () => {
    const state = fixture()
    state.players[0].board = [unit('kuai_dafu', 'a')]
    state.players[1].board = [unit('wu_han', 'b')]
    const result = run(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(result.state.players.map(p => p.board.length)).toEqual([0, 0])
    expect(result.events.filter(e => e.type === 'CHARACTER_DIED')).toHaveLength(2)
    expect(result.presentation!.boards[0][0]).toMatchObject({ damage: 2, dying: true, character: { instanceId: 'a' } })
    expect(result.presentation!.boards[1][0]).toMatchObject({ damage: 3, dying: true, character: { instanceId: 'b' } })
  })
  it('keeps a survivor in its old position while a neighbour dies, preserving the old attack on the ghost', () => {
    const state = fixture()
    state.players[0].board = [unit('wang_li', 'a'), unit('guan_feng', 'c')]
    state.players[1].board = [unit('zhu_de', 'b')]
    const result = run(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(result.state.players[0].board[0]!.instanceId).toBe('c')
    expect(result.presentation!.boards[0][0]).toMatchObject({ attack: 4, dying: true })
    expect(result.presentation!.boards[0][1]).toMatchObject({ attack: 3, dying: false, character: { instanceId: 'c' } })
  })
  it('shows damage after TOUGH reduction, rather than inferring damage from a later HP difference', () => {
    const state = fixture()
    state.players[0].board = [unit('wu_han', 'a')]
    state.players[1].board = [unit('ye_jianying', 'b')]
    const result = run(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(result.presentation!.boards[1][0]!.damage).toBe(1)
    expect(result.state.players[1].board[0]!.health).toBe(5)
  })
  it('shows zero when a one-point hit is fully blocked', () => {
    const state = fixture()
    state.players[0].board = [unit('wu_han', 'a')]
    state.players[0].board[0]!.temporaryAttack = -1
    state.players[1].board = [unit('ye_jianying', 'b')]
    const result = run(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(result.presentation!.boards[1][0]!.damage).toBe(0)
  })
  it('Zhou rescue still shows incoming damage but does not mark the saved card as dead', () => {
    const state = fixture()
    state.players[0].board = [unit('zhou_enlai', 'zhou'), unit('wu_han', 'a')]
    state.players[1].board = [unit('zhu_de', 'b')]
    const result = run(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(result.presentation!.boards[0][1]).toMatchObject({ damage: 5, dying: false, character: { health: 1 } })
    expect(result.presentation!.boards[0][0]!.damage).toBe(2)
  })
  it('direct deaths are shown even without a separate damage number', () => {
    const before = fixture()
    before.players[0].board = [unit('lin_biao', 'lin')]
    const after = structuredClone(before)
    after.players[0].board = []
    const dead = structuredClone(before.players[0].board[0]!)
    dead.health = 0
    const presentation = createBattlePresentation(before, after, [{ type: 'CHARACTER_DIED', playerId: 0, character: dead }], definitions)
    expect(presentation!.boards[0][0]).toMatchObject({ dying: true, damage: null })
  })
  it('combines area damage and Zhou mediation payment in the same action', () => {
    const before = fixture()
    before.currentPlayer = 1
    before.players[0].board = [unit('mao_zedong', 'mao'), unit('zhou_enlai', 'zhou'), unit('wu_han', 'a')]
    before.players[0].board[2]!.health = 1
    const result = run(before, { type: 'END_TURN', player: 1 }, 6)
    expect(result.presentation!.boards[0][1]).toMatchObject({ damage: 8, dying: false, character: { health: 1 } })
    expect(result.presentation!.boards[0][2]).toMatchObject({ damage: 6, dying: false, character: { health: 1 } })
  })
  it('shows a returnee killed during the same start step, even if it did not exist on the previous board', () => {
    const before = fixture()
    before.currentPlayer = 1
    before.players[0].board = [unit('mao_zedong', 'mao')]
    const deng = unit('deng_xiaoping', 'deng')
    deng.returnCount = 1
    deng.attackOverride = 2
    deng.health = 2
    before.players[0].pendingReturns = [deng]
    const result = run(before, { type: 'END_TURN', player: 1 }, 6)
    expect(result.presentation!.boards[0][1]).toMatchObject({ damage: 6, dying: true, character: { instanceId: 'deng', returnCount: 1 } })
    expect(result.state.players[0].pendingReturns[0]!.returnCount).toBe(2)
  })
  it('an immediate next-turn return is shown alive, not as an interactive dead ghost', () => {
    const before = fixture()
    before.players[0].board = [unit('lin_biao', 'lin')]
    before.players[0].board[0]!.countdown = 1
    before.players[1].board = [unit('deng_xiaoping', 'deng')]
    before.players[1].board[0]!.health = 1
    const result = run(before, { type: 'END_TURN', player: 0 })
    expect(result.presentation!.boards[1][0]).toMatchObject({ damage: 2, dying: false, returned: true, character: { health: 2, canAttack: false } })
  })
  it('emits player damage for lethal overkill without delaying the winner', () => {
    const before = fixture()
    before.players[0].board = [unit('zhu_de', 'a')]
    before.players[1].hp = 1
    const result = run(before, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'player' } })
    expect(result.state.winner).toBe(0)
    expect(result.presentation!.playerDamage).toEqual([null, 5])
  })
  it('does not start an animation for rejected actions, ordinary plays or empty turn switches', () => {
    const before = fixture()
    const denied = applyAction(before, { type: 'END_TURN', player: 1 }, definitions)
    expect(denied.events).toEqual([])
    expect(createBattlePresentation(before, denied.state, denied.events, definitions)).toBeNull()
    before.players[0].hand = ['wu_han']
    expect(run(before, { type: 'PLAY_CARD', player: 0, cardId: 'wu_han' }).presentation).toBeNull()
    expect(run(fixture(), { type: 'END_TURN', player: 0 }).presentation).toBeNull()
  })
  it('damage events and death snapshots do not share mutable references with the committed state', () => {
    const before = fixture()
    before.players[0].board = [unit('deng_xiaoping', 'deng')]
    before.players[1].board = [unit('mao_zedong', 'enemy')]
    const result = run(before, { type: 'ATTACK', player: 0, attackerId: 'deng', target: { type: 'character', instanceId: 'enemy' } })
    const death = result.events.find(e => e.type === 'CHARACTER_DIED')!
    if (death.type === 'CHARACTER_DIED') death.character.returnCount = 99
    expect(result.state.players[0].pendingReturns[0]!.returnCount).toBe(1)
  })
})
