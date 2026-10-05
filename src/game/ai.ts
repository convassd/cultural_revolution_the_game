import { applyAction } from './engine'
import type { Definitions, RandomSource } from './engine'
import { BOARD_LIMIT, canAttackPlayer, effectiveAttack, playTargets } from './rules'
import type { GameAction, GameState, PlayerId, PlayerState } from './types'

export function legalTurnActions(state: GameState, definitions: Definitions): GameAction[] {
  if (state.winner !== null) return []
  if (state.pendingPlayTarget) return state.pendingPlayTarget.targetIds.map(targetId =>
    ({ type: 'SELECT_PLAY_TARGET', player: state.currentPlayer, targetId }))
  const player = state.players[state.currentPlayer]
  const enemy = state.players[state.currentPlayer === 0 ? 1 : 0]
  const actions: GameAction[] = []
  if (player.board.length < BOARD_LIMIT) {
    for (const cardId of player.hand) {
      const card = definitions[cardId]
      if (!card || card.cost > player.mana) continue
      const targets = playTargets(card, player, enemy)
      if (targets.length) {
        for (const targetId of targets) actions.push({ type: 'PLAY_CARD', player: player.id, cardId, targetId })
      } else actions.push({ type: 'PLAY_CARD', player: player.id, cardId })
    }
  }
  for (const character of player.board) {
    if (!character.canAttack) continue
    for (const target of enemy.board) {
      actions.push({ type: 'ATTACK', player: player.id, attackerId: character.instanceId,
        target: { type: 'character', instanceId: target.instanceId } })
    }
    if (canAttackPlayer(enemy, definitions)) {
      actions.push({ type: 'ATTACK', player: player.id, attackerId: character.instanceId, target: { type: 'player' } })
    }
  }
  actions.push({ type: 'END_TURN', player: player.id })
  return actions
}

export function chooseRandomAction(state: GameState, definitions: Definitions, random: RandomSource = Math.random): GameAction | null {
  const actions = legalTurnActions(state, definitions)
  return actions.length ? actions[Math.floor(random() * actions.length)]! : null
}

function attackPower(player: PlayerState, definitions: Definitions, readyOnly = false): number {
  return player.board.reduce((total, c) => total + (readyOnly && !c.canAttack ? 0 : effectiveAttack(c, player.board, definitions)), 0)
}

function boardValue(player: PlayerState, enemy: PlayerState, definitions: Definitions): number {
  let value = 0
  for (const character of player.board) {
    const card = definitions[character.definitionId]!
    let attack = effectiveAttack(character, player.board, definitions)
    if (card.abilityId === 'MAO_RANDOM_COMMAND') attack *= 0.5
    if (card.abilityId === 'LIN_COUNTDOWN') attack *= (character.countdown ?? 2) <= 1 ? 0.45 : 0.8
    value += 1.5 + attack * 1.2 + Math.sqrt(character.health)
    if (card.abilityId === 'TOUGH') value += 1.2
    if (card.abilityId === 'ZHOU_MEDIATION') value += Math.min(3, player.board.length - 1)
    if (card.abilityId === 'DENG_RETURN') value += Math.max(0, 3 - (character.returnCount ?? 0)) * 0.7
  }
  // GUARD is worth more when there is actual damage to block; multiple guards do not stack.
  const guards = player.board.filter(c => definitions[c.definitionId]!.abilityId === 'GUARD')
  const guardHealth = guards.reduce((best, c) => Math.max(best, c.health / definitions[c.definitionId]!.health), 0)
  value += guardHealth * (2 + Math.min(12, attackPower(enemy, definitions) * 0.9))
  value += player.pendingReturns.reduce((total, c) => total + 1 + (c.attackOverride ?? 1) * 0.7, 0)
  return value
}

function positionScore(state: GameState, perspective: PlayerId, definitions: Definitions, knownHand: ReadonlySet<string>): number {
  if (state.winner !== null) return state.winner === perspective ? 1_000_000 : -1_000_000
  const player = state.players[perspective]
  const enemy = state.players[perspective === 0 ? 1 : 0]
  const readyDamage = state.currentPlayer === perspective ? attackPower(player, definitions, true) : 0
  const canFinish = canAttackPlayer(enemy, definitions) && readyDamage >= enemy.hp
  const enemyDamage = canAttackPlayer(player, definitions) ? attackPower(enemy, definitions) : 0
  const danger = Math.max(0, enemyDamage - player.hp + 1)
  // These are static board estimates, not a searched opponent reply or future draw.
  let score = player.hp * 1.2 - enemy.hp * 1.6
    + boardValue(player, enemy, definitions) - boardValue(enemy, player, definitions)
    + player.hand.length * 1.4 - enemy.hand.length * 1.4
    + player.mana * 0.2 + readyDamage * 0.35
  const outgoing = canAttackPlayer(enemy, definitions) ? attackPower(player, definitions) : 0
  score += 20 * (outgoing / (enemy.hp + 2) - enemyDamage / (player.hp + 2))
  if (!canFinish) score -= 30 * (enemyDamage / Math.max(1, player.hp)) ** 2
  // Value leftover usable mana without searching a second move or inspecting a future draw.
  if (state.currentPlayer === perspective && player.board.length < BOARD_LIMIT) {
    let usableHand = 0
    for (const id of player.hand) {
      const card = definitions[id]!
      if (knownHand.has(id) && card.cost <= player.mana) {
        usableHand = Math.max(usableHand, 1.5 + card.attack * 1.2 + Math.sqrt(card.health))
      }
    }
    score += usableHand * 0.7
  }
  if (canFinish) score += 120
  else if (danger > 0) score -= 40 + danger * 8
  return score
}

export function scoreAction(state: GameState, action: GameAction, definitions: Definitions): number {
  const preview: GameState = { ...state, log: [] }
  const enemy = state.players[state.currentPlayer === 0 ? 1 : 0]
  const rolls = action.type === 'END_TURN' && enemy.board.some(c => definitions[c.definitionId]!.abilityId === 'MAO_RANDOM_COMMAND')
    ? [1, 2, 3, 4, 5, 6] : [4]
  let score = 0
  const knownHand = new Set(state.players[state.currentPlayer].hand)
  for (const roll of rolls) {
    const result = applyAction(preview, action, definitions, () => (roll - 0.5) / 6)
    if (result.error) return -Infinity
    score += positionScore(result.state, state.currentPlayer, definitions, knownHand)
  }
  // Averaging possible dice outcomes does not consume the live match's RNG.
  return score / rolls.length
}

export function chooseGreedyAction(state: GameState, definitions: Definitions): GameAction | null {
  let best: GameAction | null = null
  let bestScore = -Infinity
  for (const action of legalTurnActions(state, definitions)) {
    const score = scoreAction(state, action, definitions)
    if (score > bestScore) { best = action; bestScore = score }
  }
  return best
}
