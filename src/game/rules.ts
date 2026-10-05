import type { CharacterDefinition, CharacterInstance, Faction, PlayerState, RelationGroup } from './types'

export const INITIAL_HP = 20
export const INITIAL_MANA = 2
export const MAX_MANA = 10
export const BOARD_LIMIT = 5
export const FACTIONS: readonly Faction[] = ['保守派', '造反派', '军队', '无派别']
export const GROUP_NAMES: Record<RelationGroup, string> = {
  gang_of_four: '四人帮', lin_group: '林彪反党集团', wang_guan_qi: '大毒草',
}

// Factions and rarity are game abstractions, not historical assessments.
const ADVANTAGE: Partial<Record<Faction, Faction>> = {
  '造反派': '保守派', '保守派': '军队', '军队': '造反派',
}

export function factionBonus(attacker: Faction, defender: Faction): number {
  return ADVANTAGE[attacker] === defender ? 1 : 0
}

export function groupBonus(
  character: CharacterDefinition,
  board: readonly CharacterInstance[],
  definitions: Readonly<Record<string, CharacterDefinition>>,
): number {
  if (!character.relationGroup) return 0
  const count = board.filter(c => definitions[c.definitionId]?.relationGroup === character.relationGroup).length
  return Math.min(2, Math.max(0, count - 1))
}

export function effectiveAttack(
  character: CharacterInstance,
  board: readonly CharacterInstance[],
  definitions: Readonly<Record<string, CharacterDefinition>>,
): number {
  const definition = definitions[character.definitionId]!
  const borrowedPower = definition.abilityId === 'JIANG_BORROW_POWER' && board.some(c => c.definitionId === 'mao_zedong' && c.health > 0) ? 2 : 0
  return Math.max(0, (character.attackOverride ?? definition.attack) + groupBonus(definition, board, definitions) + borrowedPower + character.temporaryAttack)
}

export function effectiveFaction(
  character: CharacterInstance,
  definitions: Readonly<Record<string, CharacterDefinition>>,
): Faction {
  return character.factionOverride ?? definitions[character.definitionId]!.faction
}

export function playTargets(card: CharacterDefinition, player: PlayerState, enemy: PlayerState): string[] {
  if (card.abilityId === 'BUFF_ONE') return player.board.map(c => c.instanceId)
  if (card.abilityId === 'WEAKEN') return enemy.board.map(c => c.instanceId)
  return []
}

export function canAttackPlayer(
  enemy: PlayerState,
  definitions: Readonly<Record<string, CharacterDefinition>>,
): boolean {
  return !enemy.board.some(c => definitions[c.definitionId]?.abilityId === 'GUARD')
}
