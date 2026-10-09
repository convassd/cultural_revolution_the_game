import { BOARD_LIMIT } from '../game/rules'
import type { CharacterInstance } from '../game/types'
import type { BoardEffect } from './battle'

export interface BoardLayout {
  slots: Array<string | null>
  ghosts: Record<string, number>
}
export const ghostKey = (effectId: number, instanceId: string) => effectId + '-' + instanceId

// Visual positions only. Stats, legal targets and battlefield capacity use live engine state.
export function arrangeBoard(board: readonly CharacterInstance[], effects: readonly BoardEffect[], previous: BoardLayout): BoardLayout {
  const deaths = effects.flatMap(effect => effect.slots.flatMap((card, index) =>
    card?.dying ? [{ key: ghostKey(effect.id, card.character.instanceId), instanceId: card.character.instanceId, index }] : []))
  if (!deaths.length) {
    const slots: Array<string | null> = board.map(card => card.instanceId)
    while (slots.length < BOARD_LIMIT) slots.push(null)
    return { slots, ghosts: {} }
  }
  const liveIds = new Set(board.map(card => card.instanceId))
  const slots = previous.slots.map(id => id && liveIds.has(id) ? id : null)
  const ghosts: Record<string, number> = {}
  const reserved = new Set<number>()
  for (const death of deaths) {
    const oldIndex = previous.slots.indexOf(death.instanceId)
    let index = previous.ghosts[death.key] ?? (oldIndex >= 0 ? oldIndex : death.index)
    // A return/departure chain can create another ghost of the same instance.
    if (reserved.has(index) || slots[index]) {
      index = 0
      while (reserved.has(index) || slots[index]) index++
    }
    ghosts[death.key] = index
    reserved.add(index)
    while (slots.length <= index) slots.push(null)
  }
  for (const card of board) {
    if (slots.includes(card.instanceId)) continue
    let index = 0
    while (reserved.has(index) || slots[index]) index++
    while (slots.length <= index) slots.push(null)
    slots[index] = card.instanceId
  }
  while (slots.length < BOARD_LIMIT) slots.push(null)
  while (slots.length > BOARD_LIMIT && slots.at(-1) === null && !reserved.has(slots.length - 1)) slots.pop()
  return { slots, ghosts }
}
