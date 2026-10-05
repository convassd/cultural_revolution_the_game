import { characters, definitions } from '../data'
import { applyAction, createGame, type RandomSource } from '../game/engine'
import { BOARD_LIMIT, INITIAL_HP, INITIAL_MANA, MAX_MANA } from '../game/rules'
import type { GameAction, GameEvent, GameState, PlayerId } from '../game/types'

export const PROTOCOL = 'wen-ge-sha-p2p-2'
// Change the protocol when engine behavior or wire semantics change incompatibly.
export const RULESET = JSON.stringify([characters, BOARD_LIMIT, INITIAL_HP, INITIAL_MANA, MAX_MANA])
export const HIDDEN_CARD = ''

export interface OnlineFrame {
  matchId: string
  revision: number
  seat: PlayerId
  state: GameState
  events: GameEvent[]
  reveal: boolean
}

export type Packet =
  | { type: 'hello'; protocol: string; ruleset: string }
  | { type: 'snapshot'; frame: OnlineFrame }
  | { type: 'action'; matchId: string; revision: number; action: GameAction }
  | { type: 'ack' | 'ready'; matchId: string; revision: number }
  | { type: 'error'; message: string }
  | { type: 'ping' | 'pong' }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 100

// Never pass an unvalidated network object to the rules engine.
export function readAction(value: unknown, seat: PlayerId): GameAction | null {
  if (!isRecord(value) || value.player !== seat) return null
  switch (value.type) {
    case 'END_TURN': return { type: 'END_TURN', player: seat }
    case 'PLAY_CARD':
      if (!identifier(value.cardId) || (value.targetId !== undefined && !identifier(value.targetId))) return null
      return { type: 'PLAY_CARD', player: seat, cardId: value.cardId, ...(value.targetId === undefined ? {} : { targetId: value.targetId }) }
    case 'SELECT_PLAY_TARGET':
      return identifier(value.targetId) ? { type: 'SELECT_PLAY_TARGET', player: seat, targetId: value.targetId } : null
    case 'ATTACK':
      if (!identifier(value.attackerId) || !isRecord(value.target)) return null
      if (value.target.type === 'player') return { type: 'ATTACK', player: seat, attackerId: value.attackerId, target: { type: 'player' } }
      if (value.target.type === 'character' && identifier(value.target.instanceId))
        return { type: 'ATTACK', player: seat, attackerId: value.attackerId, target: { type: 'character', instanceId: value.target.instanceId } }
  }
  return null
}

// Array lengths preserve the existing count-only UI, but hidden IDs and deck order never leave the host.
// This is a display snapshot, not input for applyAction.
export function projectState(state: GameState, viewer: PlayerId): GameState {
  const view = structuredClone(state)
  for (const player of view.players) {
    player.deck = player.deck.map(() => HIDDEN_CARD)
    if (player.id !== viewer) player.hand = player.hand.map(() => HIDDEN_CARD)
  }
  if (view.revealedHand?.viewer !== viewer) view.revealedHand = null
  if (view.currentPlayer !== viewer) view.pendingPlayTarget = null
  return view
}

export class HostMatch {
  readonly id: string
  readonly hostSeat: PlayerId
  readonly guestSeat: PlayerId
  state: GameState
  revision = 0
  private events: GameEvent[] = []
  private revealViewer: PlayerId | null = null

  // getRandomValues also works on plain LAN HTTP, unlike randomUUID.
  constructor(private random: RandomSource = Math.random, id: string = crypto.getRandomValues(new Uint32Array(4)).join('-')) {
    this.id = id
    this.hostSeat = random() < 0.5 ? 0 : 1
    this.guestSeat = this.hostSeat === 0 ? 1 : 0
    this.state = createGame(characters, random)
  }
  frame(viewer: PlayerId): OnlineFrame {
    return { matchId: this.id, revision: this.revision, seat: viewer, state: projectState(this.state, viewer),
      events: structuredClone(this.events), reveal: this.revealViewer === viewer }
  }
  apply(value: unknown, seat: PlayerId, matchId: unknown, revision: unknown): string | null {
    if (matchId !== this.id || revision !== this.revision) return '操作已过期，请等待双方同步。'
    const action = readAction(value, seat)
    if (!action) return '无效的联机操作。'
    const result = applyAction(this.state, action, definitions, this.random)
    if (result.error) return result.error
    this.state = result.state
    this.events = result.events
    this.revision += 1
    this.revealViewer = action.type === 'PLAY_CARD' && definitions[action.cardId]?.abilityId === 'REVEAL_HAND' ? seat : null
    return null
  }
}
