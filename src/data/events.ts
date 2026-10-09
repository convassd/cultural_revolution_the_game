import rawEvents from './events.json'
import type { EventDefinition } from '../game/types'

export const eventCards = rawEvents as EventDefinition[]
export const eventDefinitions: Readonly<Record<string, EventDefinition>> =
  Object.fromEntries(eventCards.map(card => [card.id, card]))
