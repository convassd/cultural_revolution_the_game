import type { PlayerId } from '../game/types'

export const HAND_DRAG_TYPE = 'application/x-cultural-revolution-hand-card'

// UI hit locations only. Character deployment still appends to the engine board.
export interface BattlefieldLocation {
  playerId: PlayerId
  slot: number // Visible positions 1–5 on each side; never a card's identity.
  instanceId?: string // Present for a live occupant; useful for future targeted cards.
}
export type CardDestination = { type: 'battlefield'; location: BattlefieldLocation }
  | { type: 'event' } | { type: 'sell' }
