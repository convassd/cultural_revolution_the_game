import { legalTurnActions, positionScore } from './ai'
import { applyAction, shuffle, type Definitions } from './engine'
import { eventCards } from '../data/events'
import type { GameAction, GameState, PlayerId } from './types'

export const PLANNER_LIMITS = {
  maxNodes: 4800, beamWidth: 8, maxActions: 14, candidates: 4,
  samples: 2, replyWidth: 2, replyActions: 10,
}
export interface PlannerOptions {
  maxNodes?: number
  timeMs?: number
}
export interface PlannerStats {
  nodes: number
  elapsedMs: number
  budgetHit: boolean
  candidates: number
  samples: number
}
export interface PlanStep { observation: string; action: GameAction }
export interface TurnPlan { steps: PlanStep[]; stats: PlannerStats }

// Only visible information enters sampling, fingerprints and worker requests.
export function observeForAi(state: GameState, seat: PlayerId = state.currentPlayer): GameState {
  const view = structuredClone(state)
  view.eventPool.deck.fill('')
  for (const player of view.players) {
    player.deck.fill('')
    if (player.id !== seat) player.hand.fill('')
  }
  if (view.revealedHand?.viewer !== seat) view.revealedHand = null
  view.log = []
  return view
}
export function observationKey(state: GameState, seat: PlayerId = state.currentPlayer): string {
  const view = observeForAi(state, seat)
  return JSON.stringify(view)
}
function hash(text: string): number {
  let value = 2166136261
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619)
  return value >>> 0
}
function randomSource(seed: number) {
  let value = seed >>> 0
  return () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296)
}
function sampleWorld(view: GameState, seat: PlayerId, definitions: Definitions, seed: number): GameState {
  const state = structuredClone(view)
  const visibleEvents = new Set([...state.eventPool.slots, ...state.eventPool.discard])
  state.eventPool.deck = shuffle(eventCards.map(card => card.id).filter(id => !visibleEvents.has(id)), randomSource(seed ^ 0x12345)).slice(0, state.eventPool.deck.length)
  const visible = new Set(state.players[seat].hand)
  for (const player of state.players) {
    for (const id of player.discard) visible.add(id)
    for (const card of [...player.board, ...player.pendingReturns]) visible.add(card.definitionId)
  }
  const enemy = state.players[seat === 0 ? 1 : 0]
  const revealed = state.revealedHand?.cards.slice(0, enemy.hand.length) ?? []
  for (const id of revealed) visible.add(id)
  const pool = shuffle(Object.keys(definitions).sort().filter(id => !visible.has(id)), randomSource(seed))
  let cursor = 0
  // Repeated IDs are only a fallback for synthetic test fixtures that do not conserve 48 cards.
  const take = () => pool[cursor++ % pool.length] ?? Object.keys(definitions)[0]!
  enemy.hand = [...revealed, ...Array.from({ length: enemy.hand.length - revealed.length }, take)]
  for (const player of state.players) player.deck = Array.from({ length: player.deck.length }, take)
  return state
}
interface Node { state: GameState; steps: PlanStep[]; value: number }
interface Budget { nodes: number; limit: number; deadline: number; hit: boolean }
function advance(state: GameState, action: GameAction, definitions: Definitions, budget: Budget, roll = 4): GameState | null {
  if (budget.nodes >= budget.limit || performance.now() >= budget.deadline) { budget.hit = true; return null }
  budget.nodes++
  const result = applyAction({ ...state, log: [] }, action, definitions, () => (roll - .5) / 6)
  return result.error ? null : result.state
}
function turnRolls(state: GameState, definitions: Definitions) {
  const incoming = state.players[state.currentPlayer === 0 ? 1 : 0]
  return incoming.board.some(c => definitions[c.definitionId]!.abilityId === 'MAO_RANDOM_COMMAND')
    ? [{ roll: 1, weight: 2 / 6 }, { roll: 4, weight: 3 / 6 }, { roll: 6, weight: 1 / 6 }]
    : [{ roll: 4, weight: 1 }]
}
function prune(nodes: Node[], width: number, seat: PlayerId): Node[] {
  const unique = new Map<string, Node>()
  for (const node of nodes.sort((a, b) => b.value - a.value)) {
    const key = observationKey(node.state, seat)
    if (!unique.has(key)) unique.set(key, node)
    if (unique.size === width) break
  }
  return [...unique.values()]
}

// Approximate minimax: enumerate a beam of replies, then take its worst result for us.
function replyValue(start: GameState, seat: PlayerId, definitions: Definitions, known: ReadonlySet<string>, budget: Budget, allowance: number): number {
  if (start.winner !== null) return positionScore(start, seat, definitions, known)
  const enemySeat = start.currentPlayer
  const enemyKnown = new Set(start.players[enemySeat].hand)
  const stopAt = Math.min(budget.limit, budget.nodes + allowance)
  let frontier: Node[] = [{ state: start, steps: [], value: 0 }]
  let worst = Infinity
  for (let depth = 0; depth < PLANNER_LIMITS.replyActions && frontier.length && budget.nodes < stopAt; depth++) {
    const expanded: Node[] = []
    for (const node of frontier) {
      const end: GameAction = { type: 'END_TURN', player: enemySeat }
      let value = 0, complete = true
      for (const outcome of turnRolls(node.state, definitions)) {
        const state = advance(node.state, end, definitions, budget, outcome.roll)
        if (!state) { complete = false; break }
        value += outcome.weight * positionScore(state, seat, definitions, known)
      }
      if (complete) worst = Math.min(worst, value)
      for (const action of legalTurnActions(node.state, definitions)) {
        if (action.type === 'END_TURN' || (action.type === 'PLAY_CARD' && !enemyKnown.has(action.cardId))) continue
        if (budget.nodes >= stopAt) break
        const state = advance(node.state, action, definitions, budget)
        if (!state) break
        if (state.winner !== null) worst = Math.min(worst, positionScore(state, seat, definitions, known))
        else expanded.push({ state, steps: [], value: positionScore(state, enemySeat, definitions, enemyKnown) })
      }
    }
    frontier = prune(expanded, PLANNER_LIMITS.replyWidth, enemySeat)
  }
  return Number.isFinite(worst) ? worst : positionScore(start, seat, definitions, known)
}

export function planTurn(input: GameState, definitions: Definitions, options: PlannerOptions = {}): TurnPlan {
  const started = performance.now()
  const maxNodes = Math.max(1, Math.floor(options.maxNodes ?? PLANNER_LIMITS.maxNodes))
  const budget: Budget = { nodes: 0, limit: maxNodes, deadline: options.timeMs ? started + options.timeMs : Infinity, hit: false }
  const seat = input.currentPlayer
  const view = observeForAi(input, seat)
  const key = JSON.stringify(view)
  const seed = hash(key)
  const worlds = Array.from({ length: PLANNER_LIMITS.samples }, (_, i) => sampleWorld(view, seat, definitions, seed + i * 0x9e3779b9))
  const known = new Set(view.players[seat].hand)
  let frontier: Node[] = [{ state: worlds[0]!, steps: [], value: 0 }]
  let finished: Node[] = []
  let fallback: PlanStep[] = []
  let fallbackValue = -Infinity
  const ownLimit = Math.max(1, Math.floor(maxNodes * .35))
  for (let depth = 0; depth < PLANNER_LIMITS.maxActions && frontier.length && budget.nodes < ownLimit; depth++) {
    const expanded: Node[] = []
    for (const node of frontier) {
      const observation = observationKey(node.state, seat)
      for (const action of legalTurnActions(node.state, definitions)) {
        if (action.type === 'PLAY_CARD' && !known.has(action.cardId)) continue
        if (budget.nodes >= ownLimit) break
        const state = advance(node.state, action, definitions, budget)
        if (!state) break
        const steps = [...node.steps, { observation, action }]
        const value = positionScore(state, seat, definitions, known)
        if (depth === 0 && value > fallbackValue) { fallback = steps; fallbackValue = value }
        if (state.winner === seat) {
          return { steps, stats: { nodes: budget.nodes, elapsedMs: performance.now() - started, budgetHit: false, candidates: 1, samples: worlds.length } }
        }
        if (action.type === 'END_TURN') finished.push({ state: node.state, steps, value })
        else expanded.push({ state, steps, value })
      }
    }
    frontier = prune(expanded, PLANNER_LIMITS.beamWidth, seat)
  }
  // Preserve complete plans, not only attractive intermediate states.
  finished = prune(finished, PLANNER_LIMITS.candidates, seat)
  let best = fallback, bestValue = -Infinity
  const scenarios = finished.flatMap(node => turnRolls(node.state, definitions))
  const allowance = Math.max(8, Math.floor((maxNodes - budget.nodes) / Math.max(1, scenarios.length * worlds.length)))
  for (const candidate of finished) {
    let value = 0, complete = true
    for (const world of worlds) {
      let state: GameState | null = world
      for (const step of candidate.steps.slice(0, -1)) {
        state = advance(state, step.action, definitions, budget)
        if (!state) { complete = false; break }
      }
      if (!state) break
      for (const outcome of turnRolls(state, definitions)) {
        const ended = advance(state, candidate.steps.at(-1)!.action, definitions, budget, outcome.roll)
        if (!ended) { complete = false; break }
        value += outcome.weight * replyValue(ended, seat, definitions, known, budget, allowance) / worlds.length
        if (budget.hit) { complete = false; break }
      }
      if (!complete) break
    }
    if (complete && value > bestValue) { best = candidate.steps; bestValue = value }
  }
  if (!best.length && input.winner === null) {
    const action = legalTurnActions(view, definitions)[0]
    if (action) best = [{ observation: key, action }]
  }
  return { steps: best, stats: { nodes: budget.nodes, elapsedMs: performance.now() - started, budgetHit: budget.hit, candidates: finished.length, samples: worlds.length } }
}

export class TurnPlanner {
  private steps: PlanStep[] = []
  next(state: GameState, definitions: Definitions, options: PlannerOptions = {}): { action: GameAction | null; stats: PlannerStats | null } {
    const key = observationKey(state)
    let stats: PlannerStats | null = null
    if (this.steps[0]?.observation !== key) {
      const result = planTurn(state, definitions, options)
      this.steps = result.steps
      stats = result.stats
    }
    return { action: this.steps.shift()?.action ?? null, stats }
  }
}
