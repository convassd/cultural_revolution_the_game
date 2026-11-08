import { characters, definitions, cardDefinitions } from '../src/data'
import { applyAction, createGame, type Definitions } from '../src/game/engine'
import { chooseGreedyAction, chooseRandomAction } from '../src/game/ai'
import { TurnPlanner } from '../src/game/aiPlanner'
import type { CharacterDefinition, GameRules } from '../src/game/types'
import { chooseSpenderAction, handChoices, type TurnFlow } from './hand-flow'
export { DEFAULT_RULES as defaultRules } from '../src/game/rules'

export type Policy = 'planner' | 'greedy' | 'random' | 'spender'
export function rng(seed: number) { let x = seed >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296) }
export function match(seed: number, rules: GameRules, policies: [Policy, Policy], swapped = false, overrides: Record<string, Partial<CharacterDefinition>> = {}, maxNodes = 4800, measureFlow = false) {
  const stats: Definitions = Object.fromEntries(characters.map(c => [c.id, { ...c, ...overrides[c.id] }]))
  let state = createGame(Object.values(stats), rng(seed), rules)
  if (swapped) {
    const a = state.players[0], b = state.players[1]
    ;[a.deck, b.deck] = [b.deck, a.deck]; [a.hand, b.hand] = [b.hand, a.hand]
  }
  const holdings = state.players.map(p => [...p.hand, ...p.deck])
  const openingHands = state.players.map(p => new Set(p.hand))
  const flow: TurnFlow[] = [], endedEmpty = [false, false]
  let measuredTurn = 0
  const dice = rng(seed ^ 0xabc123), random = [rng(seed ^ 0x111111), rng(seed ^ 0x222222)]
  const planners = [new TurnPlanner(), new TurnPlanner()]
  const drawn = state.players.map(p => new Set(p.hand)), played = [new Set<string>(), new Set<string>()], sold = [new Set<string>(), new Set<string>()]
  let actions = 0, sales = 0, eventPlays = 0, trades = 0, face = 0, emptyTurns = 0
  const maxMana = [state.players[0].mana, 0]
  for (; actions < 2000 && state.turn <= 160 && state.winner === null; actions++) {
    const seat = state.currentPlayer, policy = policies[seat]
    if (measureFlow && state.turn !== measuredTurn) {
      measuredTurn = state.turn
      const player = state.players[seat]
      flow.push({ turn: state.turn, seat, ...handChoices(state, stats),
        postOpening: state.turn > 2 && !player.hand.some(id => openingHands[seat]!.has(id)),
        recoveredFromEmpty: endedEmpty[seat]!, supply: player.hand.length > 0 || player.deck.length > 0 })
    }
    const action = policy === 'planner' ? planners[seat]!.next(state, stats, { maxNodes }).action
      : policy === 'greedy' ? chooseGreedyAction(state, stats) : policy === 'spender' ? chooseSpenderAction(state, stats) : chooseRandomAction(state, stats, random[seat])
    if (!action) throw new Error('Missing legal action')
    if (action.type === 'PLAY_CARD') { played[seat]!.add(action.cardId); if (!definitions[action.cardId]) eventPlays++ }
    if (action.type === 'SELL_CARD') { sold[seat]!.add(action.cardId); sales++ }
    if (action.type === 'ATTACK') { if (action.target.type === 'player') face++; else trades++ }
    if (action.type === 'END_TURN' && !state.players[seat].hand.length) emptyTurns++
    if (action.type === 'END_TURN') endedEmpty[seat] = state.players[seat].hand.length === 0
    const result = applyAction(state, action, stats, dice)
    if (result.error) throw new Error(`${seed}: ${result.error}: ${JSON.stringify(action)}`)
    state = result.state
    for (const p of state.players) { p.hand.forEach(id => drawn[p.id]!.add(id)); maxMana[p.id] = Math.max(maxMana[p.id]!, p.mana) }
  }
  return { seed, swapped, rules, policies, winner: state.winner, turns: state.turn, actions, sales, eventPlays, trades, face, emptyTurns, maxMana, holdings,
    drawn: drawn.map(s => [...s]), played: played.map(s => [...s]), sold: sold.map(s => [...s]), hp: state.players.map(p => p.hp), flow }
}

export function summarize(matches: ReturnType<typeof match>[]) {
  const completed = matches.filter(m => m.winner !== null), turns = completed.map(m => m.turns).sort((a,b) => a-b)
  const cardStats = Object.keys(cardDefinitions).map(id => {
    const counts = { drawn: 0, drawnWins: 0, played: 0, playedWins: 0, sold: 0, soldWins: 0 }
    for (const m of matches) for (const seat of [0, 1] as const) for (const kind of ['drawn','played','sold'] as const) {
      if (m[kind][seat]!.includes(id)) { counts[kind]++; if (m.winner === seat) counts[`${kind}Wins`]++ }
    }
    return { id, name: cardDefinitions[id]!.name, cost: cardDefinitions[id]!.cost, ...counts }
  })
  return { games: matches.length, completed: completed.length, draws: matches.length-completed.length,
    firstWins: completed.filter(m => m.winner === 0).length,
    meanTurns: turns.reduce((a,b) => a+b, 0) / (turns.length || 1), medianTurns: turns[Math.floor(turns.length/2)] ?? 0,
    p90Turns: turns[Math.floor(turns.length*.9)] ?? 0,
    meanSales: matches.reduce((s,m) => s+m.sales,0)/matches.length,
    meanEvents: matches.reduce((s,m) => s+m.eventPlays,0)/matches.length,
    meanTrades: matches.reduce((s,m) => s+m.trades,0)/matches.length,
    meanEmptyEnds: matches.reduce((s,m) => s+m.emptyTurns,0)/matches.length,
    cardStats }
}
