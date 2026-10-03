import type { CharacterDefinition, Faction, Rarity } from '../game/types'

export type CardSortKey = 'rarity' | 'cost' | 'attack' | 'health'
export type SortDirection = 'asc' | 'desc'
const RARITY_ORDER: Record<Rarity, number> = { R: 1, SR: 2, SSR: 3 }

export function queryCards(
  cards: readonly CharacterDefinition[],
  faction: Faction | 'all',
  sortKey: CardSortKey,
  direction: SortDirection,
): CharacterDefinition[] {
  const result = cards.filter(card => faction === 'all' || card.faction === faction)
  const value = (card: CharacterDefinition) => sortKey === 'rarity' ? RARITY_ORDER[card.rarity] : card[sortKey]
  // Equal values retain source order, so toggling a filter stays predictable.
  return result.sort((a, b) => (value(a) - value(b)) * (direction === 'asc' ? 1 : -1))
}
