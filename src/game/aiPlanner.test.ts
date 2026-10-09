import { describe, expect, it, vi } from 'vitest'
import { characters, definitions } from '../data'
import { createCharacter } from './effects'
import { applyAction, createGame } from './engine'
import { chooseGreedyAction, legalTurnActions } from './ai'
import { observeForAi, observationKey, planTurn, TurnPlanner } from './aiPlanner'
import type { GameState } from './types'

function fixture(): GameState {
  const state = createGame(characters, () => .5)
  for (const player of state.players) { player.deck = []; player.hand = [] }
  state.players[0].mana = state.players[0].maxMana = 7
  return state
}
function ready(id: string) {
  const card = createCharacter(definitions[id]!, id)
  card.canAttack = true
  return card
}

describe('bounded turn planner', () => {
  it('finds a three-attack lethal that greedy misses by spending its strongest attacker on the guard', () => {
    let state = fixture()
    state.players[0].board = [ready('zhu_de'), ready('wu_han'), ready('lin_liguo')]
    state.players[1].board = [ready('hua_guofeng')]
    state.players[1].board[0]!.health = 4
    state.players[1].hp = 5
    expect(chooseGreedyAction(state, definitions)).toMatchObject({ type: 'ATTACK', attackerId: 'zhu_de' })
    const plan = planTurn(state, definitions)
    expect(plan.steps).toHaveLength(3)
    expect(plan.steps.at(-1)!.action).toMatchObject({ type: 'ATTACK', attackerId: 'zhu_de', target: { type: 'player' } })
    for (const step of plan.steps) state = applyAction(state, step.action, definitions).state
    expect(state.winner).toBe(0)
  })
  it('plans a sacrifice to clear Protection, then wins with the remaining attacker', () => {
    let state = fixture()
    state.players[0].board = [ready('zhu_de'), ready('kuai_dafu')]
    state.players[1].board = [ready('hua_guofeng')]
    state.players[1].board[0]!.health = 3
    state.players[1].hp = 5
    const plan = planTurn(state, definitions)
    expect(plan.steps).toHaveLength(2)
    expect(plan.steps[0]!.action).toMatchObject({ type: 'ATTACK', attackerId: 'kuai_dafu', target: { type: 'character' } })
    expect(plan.steps[1]!.action).toMatchObject({ type: 'ATTACK', attackerId: 'zhu_de', target: { type: 'player' } })
    for (const step of plan.steps) {
      expect(observationKey(state)).toBe(step.observation)
      const result = applyAction(state, step.action, definitions)
      expect(result.error).toBeNull()
      state = result.state
    }
    expect(state.winner).toBe(0)
  })
  it('finds a same-turn charge lethal rather than ending into an enemy lethal', () => {
    let state = fixture()
    state.players[0].mana = 3
    state.players[0].hand = ['nie_yuanzi']
    state.players[0].hp = 1
    state.players[0].board = [ready('wu_han')]
    state.players[1].board = [ready('zhu_de')]
    state.players[1].hp = 5
    const plan = planTurn(state, definitions)
    expect(plan.steps.some(s => s.action.type === 'PLAY_CARD' && s.action.cardId === 'nie_yuanzi')).toBe(true)
    expect(plan.steps.some(s => s.action.type === 'END_TURN')).toBe(false)
    for (const step of plan.steps) state = applyAction(state, step.action, definitions).state
    expect(state.winner).toBe(0)
  })
  it('removes visible next-turn lethal pressure instead of racing into a loss', () => {
    const state = fixture()
    state.players[0].hp = 3
    state.players[0].board = [ready('zhou_enlai')]
    state.players[1].board = [ready('nie_yuanzi')]
    expect(planTurn(state, definitions).steps[0]!.action).toMatchObject({ type: 'ATTACK', target: { type: 'character' } })
  })
  it('uses only visible information and never changes the input or consumes live RNG', () => {
    const state = createGame(characters, () => .5)
    state.players[0].mana = 10
    const original = structuredClone(state)
    const rng = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('live RNG used') })
    try {
      const first = planTurn(state, definitions)
      const hidden = structuredClone(state)
      hidden.players[0].deck.reverse()
      hidden.players[1].deck.reverse()
      hidden.players[1].hand = hidden.players[1].hand.map(() => 'mao_zedong')
      hidden.log.push('hidden log ignored')
      expect(planTurn(hidden, definitions).steps).toEqual(first.steps)
      expect(observeForAi(hidden)).toEqual(observeForAi(state))
      expect(state).toEqual(original)
    } finally { rng.mockRestore() }
  })
  it('keeps a legitimate revealed-hand snapshot only for its caster', () => {
    const state = fixture()
    state.revealedHand = { viewer: 0, owner: 1, cards: ['hua_guofeng'] }
    state.players[1].hand = ['hua_guofeng']
    expect(observeForAi(state, 0).revealedHand?.cards).toEqual(['hua_guofeng'])
    expect(observeForAi(state, 1).revealedHand).toBeNull()
    expect(observationKey(state)).not.toBe(observationKey({ ...state, revealedHand: null }))
  })
  it('respects node and time budgets and retains a legal fallback', () => {
    const state = createGame(characters, () => .5)
    state.players[0].mana = 10
    const result = planTurn(state, definitions, { maxNodes: 10 })
    expect(result.stats.nodes).toBeLessThanOrEqual(10)
    expect(legalTurnActions(state, definitions)).toContainEqual(result.steps[0]!.action)
    let time = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => time += 10)
    try {
      const expired = planTurn(state, definitions, { timeMs: 1 })
      expect(expired.stats.budgetHit).toBe(true)
      expect(legalTurnActions(state, definitions)).toContainEqual(expired.steps[0]!.action)
    } finally { clock.mockRestore() }
  })
  it('resolves a committed mandatory entry target before other actions', () => {
    const state = fixture()
    state.players[0].board = [ready('wu_han')]
    state.players[0].hand = ['zhang_chunqiao']
    const pending = applyAction(state, { type: 'PLAY_CARD', player: 0, cardId: 'zhang_chunqiao' }, definitions).state
    const action = planTurn(pending, definitions).steps[0]!.action
    expect(action).toEqual({ type: 'SELECT_PLAY_TARGET', player: 0, targetId: 'wu_han' })
    expect(applyAction(pending, action, definitions).error).toBeNull()
  })
  it('caches a valid continuation but replans after an unexpected observed draw', () => {
    const planner = new TurnPlanner()
    let state = fixture()
    state.players[0].board = [ready('zhu_de'), ready('kuai_dafu')]
    state.players[1].board = [ready('hua_guofeng')]
    state.players[1].board[0]!.health = 3
    state.players[1].hp = 5
    const first = planner.next(state, definitions)
    expect(first.stats).not.toBeNull()
    state = applyAction(state, first.action!, definitions).state
    expect(planner.next(state, definitions).stats).toBeNull()
    state.players[0].hand.push('nie_yuanzi')
    expect(planner.next(state, definitions).stats).not.toBeNull()
  })
  it('does not plan to play imaginary own draws before observing them', () => {
    const state = fixture()
    state.players[0].hand = ['chen_boda']
    state.players[0].deck = ['nie_yuanzi']
    const plan = planTurn(state, definitions)
    expect(plan.steps.filter(s => s.action.type === 'PLAY_CARD').every(s => s.action.type === 'PLAY_CARD' && s.action.cardId === 'chen_boda')).toBe(true)
  })
  it('returns no action after victory', () => {
    const state = fixture()
    state.winner = 1
    expect(planTurn(state, definitions).steps).toEqual([])
    expect(new TurnPlanner().next(state, definitions).action).toBeNull()
  })
  it.each([0, 1] as const)('finishes a seeded match from seat %i with legal continuations and 48 conserved cards', seat => {
    let seed = 90001 + seat
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
    let state = createGame(characters, random)
    const planner = new TurnPlanner()
    let reused = 0
    for (let step = 0; step < 1500 && state.winner === null; step++) {
      const decision = state.currentPlayer === seat ? planner.next(state, definitions) : null
      if (decision && !decision.stats) reused++
      const action = decision ? decision.action : chooseGreedyAction(state, definitions)
      expect(action).not.toBeNull()
      expect(legalTurnActions(state, definitions)).toContainEqual(action)
      const result = applyAction(state, action!, definitions, random)
      expect(result.error).toBeNull()
      state = result.state
      const all = state.players.flatMap(p => [...p.deck, ...p.hand, ...p.discard,
        ...p.board.map(c => c.definitionId), ...p.pendingReturns.map(c => c.definitionId)])
      expect(all).toHaveLength(48)
      expect(new Set(all).size).toBe(48)
      const pool = [...state.eventPool.deck, ...state.eventPool.slots.filter(id => id !== null), ...state.eventPool.discard]
      expect(pool).toHaveLength(12)
      expect(new Set(pool).size).toBe(12)
    }
    expect(state.winner).not.toBeNull()
    expect(reused).toBeGreaterThan(0)
  })
})

describe('planner with lasting attack reduction', () => {
  it.each([0, 1] as const)('uses Poster to survive enemy next-turn lethal from caster seat %s', caster => {
    let state = fixture()
    const enemy = caster === 0 ? 1 : 0
    state.currentPlayer = caster
    state.turn = caster + 3
    state.players[caster].hp = 3
    state.players[caster].mana = 3
    state.players[caster].hand = ['guan_feng']
    state.players[enemy].board = [ready('nie_yuanzi')]
    const plan = planTurn(state, definitions)
    expect(plan.steps[0]!.action).toMatchObject({ type: 'PLAY_CARD', player: caster, cardId: 'guan_feng', targetId: 'nie_yuanzi' })
    state = applyAction(state, plan.steps[0]!.action, definitions).state
    expect(observeForAi(state).players[enemy].board[0]!.attackModifiers).toEqual([{ amount: -1, expiresAtTurn: caster + 5 }])
    state = applyAction(state, { type: 'END_TURN', player: caster }, definitions).state
    state = applyAction(state, { type: 'ATTACK', player: enemy, attackerId: 'nie_yuanzi', target: { type: 'player' } }, definitions).state
    expect(state.players[caster].hp).toBe(1)
    expect(state.winner).toBeNull()
  })
})
