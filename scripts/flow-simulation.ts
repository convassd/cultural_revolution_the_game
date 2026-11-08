import { cards, characters, definitions } from '../src/data'
import { createCharacter } from '../src/game/effects'
import { applyAction, createGame, shuffle } from '../src/game/engine'
import type { GameRules } from '../src/game/types'
import { handChoices, type TurnFlow } from './hand-flow'
import { match, rng, summarize, type Policy } from './economy-simulation'

function rates(turns: TurnFlow[]) {
  const eligible = turns.filter(t => t.nonfull && t.supply)
  const rate = (predicate: (t: TurnFlow) => boolean) => eligible.length ? eligible.filter(predicate).length / eligible.length : null
  const hands = turns.map(t => t.hand).sort((a,b) => a-b)
  return { starts: turns.length, eligible: eligible.length, medianHand: hands[Math.floor(hands.length/2)] ?? null,
    directRate: rate(t => t.direct > 0), recoveryRate: rate(t => t.funded > 0), stalledRate: rate(t => t.funded === 0),
    twoChoicesRate: rate(t => t.funded >= 2), needsSaleRate: rate(t => t.direct === 0 && t.funded > 0) }
}

export function summarizeFlow(matches: ReturnType<typeof match>[]) {
  const turns = matches.flatMap(m => m.flow), base = summarize(matches)
  const mean = (f: (m: ReturnType<typeof match>) => number) => matches.reduce((sum,m) => sum+f(m),0)/matches.length
  return { ...base, cardStats: undefined,
    exposed: mean(m => m.drawn.reduce((sum,h) => sum+h.length,0)), playedCards: mean(m => m.played.reduce((sum,h) => sum+h.length,0)),
    meaningfulStarts: rates(turns), later: rates(turns.filter(t => t.turn >= 5)),
    postOpening: rates(turns.filter(t => t.postOpening)), fromEmpty: rates(turns.filter(t => t.recoveredFromEmpty)),
    phaseGames: matches.filter(m => m.flow.some(t => t.postOpening)).length,
    evaluatedWins: matches[0]?.policies[0] !== matches[0]?.policies[1] ? matches.filter(m => m.winner !== null && m.policies[m.winner] === matches[0]?.policies[0]).length : undefined }
}

export function runFlow(start: number, count: number, rules: GameRules, policies: [Policy, Policy], nodes = 4800) {
  const games: ReturnType<typeof match>[] = []
  for (let seed=start; seed<start+count; seed++) {
    for (const swap of [false,true]) games.push(match(seed,rules,policies,swap,{},nodes,true))
    if (count >= 80 && (seed-start+1)%20===0) console.log(`Progress ${seed-start+1}/${count}: ${JSON.stringify(rules)} ${policies.join('/')}`)
  }
  return { summary: summarizeFlow(games), games }
}

// Matched empty-hand starts isolate recurring supply from the five-card opening.
// Both an empty battlefield and a populated, nonfull battlefield are tested.
export function emptyHandProbe(start: number, count: number, rules: GameRules) {
  const samples: Array<ReturnType<typeof handChoices> & { seed: number; populated: boolean }> = []
  const fixed = ['wu_de','mao_yuanxin','chen_yi','tao_zhu']
  for (let seed=start; seed<start+count; seed++) for (const populated of [false,true]) {
    let state = createGame(characters, rng(seed), rules)
    for (const p of state.players) { p.hand = []; p.deck = [] }
    state.currentPlayer = 1; state.turn = 4
    state.players[0].deck = shuffle(cards.filter(c => !populated || !fixed.includes(c.id)).map(c => c.id), rng(seed ^ 0x56789))
    if (populated) {
      state.players[0].board = fixed.slice(0,2).map(id => createCharacter(definitions[id]!,id))
      state.players[1].board = fixed.slice(2).map(id => createCharacter(definitions[id]!,id))
    }
    state = applyAction(state, { type:'END_TURN',player:1 }, definitions, () => .5).state
    samples.push({ seed, populated, ...handChoices(state,definitions) })
  }
  const result = (subset: typeof samples) => ({ samples: subset.length,
    directRate: subset.filter(s => s.direct>0).length/subset.length,
    recoveryRate: subset.filter(s => s.funded>0).length/subset.length,
    twoChoicesRate: subset.filter(s => s.funded>=2).length/subset.length })
  return { empty: result(samples.filter(s=>!s.populated)), populated: result(samples.filter(s=>s.populated)), samples }
}
