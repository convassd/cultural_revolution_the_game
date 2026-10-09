import { BOARD_LIMIT, effectiveAttack, effectiveFaction } from '../game/rules'
import type { CharacterDefinition, CharacterInstance, Faction, GameEvent, GameState, PlayerId } from '../game/types'

export const BATTLE_EFFECT_DURATION = 1800

export interface PresentedCharacter {
  character: CharacterInstance
  attack: number
  faction: Faction
  damage: number | null
  dying: boolean
  returned: boolean
}
export interface BattlePresentation {
  boards: [Array<PresentedCharacter | null>, Array<PresentedCharacter | null>]
  playerDamage: [number | null, number | null]
}
export interface BattleEffect extends BattlePresentation { id: number }
export interface BoardEffect { id: number; slots: Array<PresentedCharacter | null> }
type Definitions = Readonly<Record<string, CharacterDefinition>>

export function presentCharacter(character: CharacterInstance, board: readonly CharacterInstance[], definitions: Definitions): PresentedCharacter {
  return { character, attack: effectiveAttack(character, board, definitions), faction: effectiveFaction(character, definitions),
    damage: null, dying: false, returned: false }
}

export function createBattlePresentation(
  before: GameState, after: GameState, events: readonly GameEvent[], definitions: Definitions,
): BattlePresentation | null {
  if (!events.some(e => e.type === 'CHARACTER_DAMAGED' || e.type === 'PLAYER_DAMAGED' || e.type === 'CHARACTER_DIED')) return null
  const damage = new Map<string, number>()
  const deaths = new Map<string, Extract<GameEvent, { type: 'CHARACTER_DIED' }>>()
  const returned = new Set<string>()
  const playerDamage: BattlePresentation['playerDamage'] = [null, null]
  for (const event of events) {
    if (event.type === 'CHARACTER_DAMAGED') damage.set(event.instanceId, (damage.get(event.instanceId) ?? 0) + event.amount)
    if (event.type === 'CHARACTER_DIED') deaths.set(event.character.instanceId, event)
    if (event.type === 'CHARACTER_RETURNED') returned.add(event.character.instanceId)
    if (event.type === 'PLAYER_DAMAGED') playerDamage[event.playerId] = (playerDamage[event.playerId] ?? 0) + event.amount
  }
  function boardFor(id: PlayerId): Array<PresentedCharacter | null> {
    const oldBoard = before.players[id].board
    const newBoard = after.players[id].board
    const slots: Array<PresentedCharacter | null> = Array.from({ length: BOARD_LIMIT }, () => null)
    const seen = new Set<string>()
    function visible(character: CharacterInstance): PresentedCharacter {
      const alive = newBoard.find(c => c.instanceId === character.instanceId)
      const death = deaths.get(character.instanceId)
      const source = alive ?? death?.character ?? character
      const result = presentCharacter(source, alive ? newBoard : oldBoard, definitions)
      result.damage = damage.get(character.instanceId) ?? null
      result.dying = !!death && !alive
      result.returned = returned.has(character.instanceId) && !!alive
      return result
    }
    // Keep the pre-action positions until ghosts have finished shattering.
    oldBoard.forEach((character, index) => {
      slots[index] = visible(character)
      seen.add(character.instanceId)
    })
    const incoming = [...newBoard, ...[...deaths.values()].filter(e => e.playerId === id).map(e => e.character)]
    for (const character of incoming) {
      if (seen.has(character.instanceId)) continue
      const index = slots.indexOf(null)
      if (index < 0) break
      slots[index] = visible(character)
      seen.add(character.instanceId)
    }
    return slots
  }
  return { boards: [boardFor(0), boardFor(1)], playerDamage }
}
