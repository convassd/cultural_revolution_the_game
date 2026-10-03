import rawCharacters from './characters.json'
import type { CharacterDefinition } from '../game/types'

export const characters = rawCharacters as CharacterDefinition[]
export const definitions: Readonly<Record<string, CharacterDefinition>> =
  Object.fromEntries(characters.map(card => [card.id, card]))
