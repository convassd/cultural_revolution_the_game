import { eventDefinitions } from '../src/data/events'
import { applyAction, type Definitions } from '../src/game/engine'
import { legalTurnActions, positionScore, scoreAction } from '../src/game/ai'
import { BOARD_LIMIT, effectiveAttack } from '../src/game/rules'
import type { CardDefinition, GameAction, GameState } from '../src/game/types'

const lookup = (id: string, definitions: Definitions): CardDefinition | undefined => definitions[id] ?? eventDefinitions[id]

// Conservative: count an event only if it changes current stats/HP, removes a character,
// or draws. A future-only aura setup is deliberately not called productive here.
export function productiveCard(state: GameState, id: string, definitions: Definitions): boolean {
  const card = lookup(id, definitions), seat = state.currentPlayer
  if (!card) return false
  if (card.type === 'character') return state.players[seat].board.length < BOARD_LIMIT
  const preview: GameState = { ...state, players: state.players.map(p => p.id === seat ? { ...p, mana: Math.max(p.mana, card.cost) } : p) as GameState['players'] }
  const result = applyAction(preview, { type: 'PLAY_CARD', player: seat, cardId: id }, definitions, () => .5)
  if (result.error) return false
  return state.players.some((before, index) => {
    const after = result.state.players[index]!
    if (before.hp !== after.hp || before.board.length !== after.board.length) return true
    if (after.hand.length > before.hand.length - (index === seat ? 1 : 0)) return true
    return before.board.some(c => {
      const next = after.board.find(n => n.instanceId === c.instanceId)
      return !next || c.health !== next.health || effectiveAttack(c, before.board, definitions, state.activeEvent?.id) !== effectiveAttack(next, after.board, definitions, result.state.activeEvent?.id)
    })
  })
}

export function handChoices(state: GameState, definitions: Definitions) {
  const player = state.players[state.currentPlayer]
  let direct = 0, funded = 0
  const totalCost = player.hand.reduce((sum, id) => sum + (lookup(id, definitions)?.cost ?? 0), 0)
  for (const id of player.hand) {
    const card = lookup(id, definitions)
    if (!card || !productiveCard(state, id, definitions)) continue
    if (card.cost <= player.mana) direct++
    // Each candidate can use the other hand cards as fuel; never sell the played card.
    if (card.cost <= player.mana + totalCost - card.cost) funded++
  }
  return { hand: player.hand.length, direct, funded, nonfull: player.board.length < BOARD_LIMIT }
}

// A consumption-heavy stress policy, not a model of optimal or human play.
// Prioritize characters; play an event only when its heuristic value improves.
// Sell only when it enables a concrete play; never sell just to hoard energy.
export function chooseSpenderAction(state: GameState, definitions: Definitions): GameAction | null {
  const actions = legalTurnActions(state, definitions)
  if (!actions.length) return null
  const seat = state.currentPlayer, known = new Set(state.players[seat].hand)
  const baseline = positionScore(state, seat, definitions, known)
  const plays = actions.filter(a => a.type === 'PLAY_CARD').filter(a => productiveCard(state, a.cardId, definitions))
  const useful = plays.filter(a => definitions[a.cardId] || scoreAction(state, a, definitions) > baseline)
  if (useful.length) return useful.reduce((best, action) => scoreAction(state, action, definitions) > scoreAction(state, best, definitions) ? action : best)
  let bestSale: GameAction | null = null, bestValue = baseline
  const hand = state.players[seat].hand
  for (let i = 0; i < hand.length; i++) {
    const sale: GameAction = { type: 'SELL_CARD', player: seat, cardId: hand[i]! }
    const first = applyAction(state, sale, definitions).state
    const saleStates = [first]
    for (let j = i + 1; j < hand.length; j++) saleStates.push(applyAction(first, { type: 'SELL_CARD', player: seat, cardId: hand[j]! }, definitions).state)
    for (const sold of saleStates) for (const action of legalTurnActions(sold, definitions)) {
      if (action.type !== 'PLAY_CARD' || !productiveCard(sold, action.cardId, definitions)) continue
      const result = applyAction(sold, action, definitions, () => .5)
      const value = positionScore(result.state, seat, definitions, known)
      if (value > bestValue) { bestValue = value; bestSale = sale }
    }
  }
  if (bestSale) return bestSale
  const attacks = actions.filter(a => a.type === 'ATTACK')
  if (attacks.length) return attacks.reduce((best, action) => scoreAction(state, action, definitions) > scoreAction(state, best, definitions) ? action : best)
  return { type: 'END_TURN', player: seat }
}

export interface TurnFlow {
  turn: number
  seat: number
  hand: number
  direct: number
  funded: number
  nonfull: boolean
  postOpening: boolean
  recoveredFromEmpty: boolean
  supply: boolean
}
