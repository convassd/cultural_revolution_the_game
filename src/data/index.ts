import rawCharacters from './characters.json'
import { eventCards } from './events'
import type { CardDefinition, CharacterDefinition } from '../game/types'

export const characters = rawCharacters as CharacterDefinition[]
export const cards: CardDefinition[] = [...characters, ...eventCards]
export const cardDefinitions: Readonly<Record<string, CardDefinition>> = Object.fromEntries(cards.map(card => [card.id, card]))
export const definitions: Readonly<Record<string, CharacterDefinition>> =
  Object.fromEntries(characters.map(card => [card.id, card]))
