import { chooseGreedyAction, chooseRandomAction, legalTurnActions, scoreAction } from '../src/game/ai'
import { applyAction, createGame } from '../src/game/engine'
import { characters, definitions } from '../src/data'
import type { GameAction, GameState, PlayerId } from '../src/game/types'

type Policy = 'greedy' | 'face' | 'face-first' | 'random'
function randomSource(seed: number) {
  let value = seed >>> 0
  return () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296)
}

// Strong face baseline: same card/skill scoring, but never trade while face is available.
function chooseFace(state: GameState, forceAttackFirst = false): GameAction | null {
  const actions = legalTurnActions(state, definitions)
  const face = actions.filter(a => a.type === 'ATTACK' && a.target.type === 'player')
  const allowed = face.length
    ? forceAttackFirst ? face : actions.filter(a => a.type !== 'ATTACK' || a.target.type === 'player')
    : actions
  let best: GameAction | null = null
  let bestScore = -Infinity
  for (const action of allowed) {
    const score = scoreAction(state, action, definitions)
    if (score > bestScore) { best = action; bestScore = score }
  }
  return best
}

interface Metrics { plays: number; faceAttacks: number; trades: number; optionalTrades: number }
function metrics(): Metrics { return { plays: 0, faceAttacks: 0, trades: 0, optionalTrades: 0 } }
export function playMatch(seed: number, policies: [Policy, Policy], capture = false, initialHp = 20) {
  // Decks, live dice, and random policy choices use independent reproducible streams.
  let state = createGame(characters, randomSource(seed))
  for (const player of state.players) player.hp = initialHp
  const dice = randomSource(seed ^ 0xabc123)
  const policyRandom = [randomSource(seed ^ 0x111111), randomSource(seed ^ 0x222222)]
  const counts = [metrics(), metrics()]
  const trace: Array<{ turn: number; player: PlayerId; action: GameAction; log: string[] }> = []
  for (let step = 0; step < 1500 && state.winner === null; step++) {
    const id = state.currentPlayer
    const policy = policies[id]
    const action = policy === 'greedy' ? chooseGreedyAction(state, definitions)
      : policy === 'random' ? chooseRandomAction(state, definitions, policyRandom[id])
        : chooseFace(state, policy === 'face-first')
    if (!action) throw new Error(`No move: seed ${seed}, turn ${state.turn}`)
    const count = counts[id]!
    if (action.type === 'PLAY_CARD') count.plays++
    if (action.type === 'ATTACK') {
      if (action.target.type === 'player') count.faceAttacks++
      else {
        count.trades++
        if (legalTurnActions(state, definitions).some(a => a.type === 'ATTACK' && a.target.type === 'player')) count.optionalTrades++
      }
    }
    const result = applyAction(state, action, definitions, dice)
    if (result.error) throw new Error(`${seed}: ${result.error} ${JSON.stringify(action)}`)
    if (capture) {
      const prefix = state.log.slice(-1)[0]
      const index = result.state.log.lastIndexOf(prefix ?? '')
      trace.push({ turn: state.turn, player: id, action, log: result.state.log.slice(index + 1) })
    }
    state = result.state
  }
  return { seed, policies, winner: state.winner, turn: state.turn, hp: state.players.map(p => p.hp), counts, trace }
}

export function runBenchmark(startSeed: number, seedCount: number, opponent: Policy = 'face', initialHp = 20) {
  const seats = [0, 1].map(id => ({ greedySeat: id, wins: 0, losses: 0, draws: 0, totalTurns: 0 }))
  const greedy = metrics()
  const baseline = metrics()
  const examples: { win: ReturnType<typeof playMatch> | null; loss: ReturnType<typeof playMatch> | null } = { win: null, loss: null }
  for (let seed = startSeed; seed < startSeed + seedCount; seed++) {
    for (const id of [0, 1] as const) {
      const policies: [Policy, Policy] = id === 0 ? ['greedy', opponent] : [opponent, 'greedy']
      const match = playMatch(seed, policies, false, initialHp)
      const seat = seats[id]!
      if (match.winner === null) seat.draws++
      else if (match.winner === id) seat.wins++
      else seat.losses++
      seat.totalTurns += match.turn
      for (const key of ['plays', 'faceAttacks', 'trades', 'optionalTrades'] as const) {
        greedy[key] += match.counts[id]![key]
        baseline[key] += match.counts[id === 0 ? 1 : 0]![key]
      }
      const outcome = match.winner === id ? 'win' : match.winner !== null ? 'loss' : null
      if (outcome && !examples[outcome]) examples[outcome] = playMatch(seed, policies, true, initialHp)
    }
  }
  return { startSeed, seedCount, opponent, initialHp, games: seedCount * 2, seats, greedy, baseline, examples }
}
