import { expect, it } from 'vitest'
import { characters, definitions } from '../data'
import { legalTurnActions } from './ai'
import { applyAction, createGame } from './engine'
import { canAttackPlayer, effectiveAttack } from './rules'
import type { GameAction, GameState } from './types'

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 4294967296
  }
}

function checkInvariants(state: GameState) {
  const allCards: string[] = []
  const instanceIds: string[] = []
  for (const player of state.players) {
    allCards.push(...player.deck, ...player.hand, ...player.discard, ...player.removed,
      ...player.board.map(c => c.definitionId), ...player.pendingReturns.map(c => c.definitionId))
    instanceIds.push(...player.board.map(c => c.instanceId), ...player.pendingReturns.map(c => c.instanceId))
    expect(player.board.length).toBeLessThanOrEqual(5)
    expect(player.mana).toBeGreaterThanOrEqual(0)
    expect(player.maxMana).toBeLessThanOrEqual(state.rules.energyPerTurn)
    for (const character of player.board) {
      expect(character.health).toBeGreaterThan(0)
      expect(effectiveAttack(character, player.board, definitions)).toBeGreaterThanOrEqual(0)
    }
    for (const character of player.pendingReturns) {
      expect(character.definitionId).toBe('deng_xiaoping')
      expect(character.returnCount).toBeGreaterThanOrEqual(1)
      expect(character.returnCount).toBeLessThanOrEqual(3)
    }
  }
  if (state.activeEvent) allCards.push(state.activeEvent.id)
  expect(allCards).toHaveLength(60)
  expect(new Set(allCards).size).toBe(60)
  expect(new Set(instanceIds).size).toBe(instanceIds.length)
}

it.each(Array.from({ length: 30 }, (_, i) => i + 1))('finishes seed %i with legal SR/SSR actions and conserved cards', seed => {
  const random = seededRandom(seed)
  let state = createGame(characters, random)
  function perform(action: GameAction) {
    const result = applyAction(state, action, definitions, random)
    expect(result.error, JSON.stringify(action)).toBeNull()
    state = result.state
    checkInvariants(state)
  }
  checkInvariants(state)
  for (let turn = 0; turn < 100 && state.winner === null; turn++) {
    const id = state.currentPlayer
    for (let play = 0; play < 10; play++) {
      const action = legalTurnActions(state, definitions).find(a => a.type === 'PLAY_CARD')
      if (!action) break
      perform(action)
    }
    for (const character of [...state.players[id].board]) {
      if (state.winner !== null) break
      if (!character.canAttack) continue
      const enemy = state.players[id === 0 ? 1 : 0]
      const target = canAttackPlayer(enemy, definitions)
        ? { type: 'player' as const }
        : { type: 'character' as const, instanceId: enemy.board[0]!.instanceId }
      perform({ type: 'ATTACK', player: id, attackerId: character.instanceId, target })
    }
    if (state.winner === null) perform({ type: 'END_TURN', player: id })
  }
  expect(state.winner).not.toBeNull()
  expect(state.players[state.winner === 0 ? 1 : 0].hp).toBe(0)
})
