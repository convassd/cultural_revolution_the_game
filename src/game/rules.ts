import type { CharacterDefinition, CharacterInstance, Faction, PlayerState, RelationGroup, EventId, GameRules } from './types'

export const INITIAL_HP = 20
export const INITIAL_HAND_SIZE = 5
export const CHARACTERS_PER_EVENT = 4
export const DEFAULT_RULES: Readonly<GameRules> = { energyPerTurn: 4, drawPerTurn: 3, secondPlayerOpeningBonus: 6 }
export const BOARD_LIMIT = 5
export const LIN_INITIAL_COUNTDOWN = 3
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
  activeEvent: EventId | null = null,
): number {
  const definition = definitions[character.definitionId]!
  const borrowedPower = definition.abilityId === 'JIANG_BORROW_POWER' && board.some(c => c.definitionId === 'mao_zedong' && c.health > 0) ? 2 : 0
  return Math.max(0, eventAttackBonus(character, definitions, activeEvent) + (character.attackOverride ?? definition.attack) + groupBonus(definition, board, definitions) + borrowedPower + character.temporaryAttack + (character.attackModifiers ?? []).reduce((sum, modifier) => sum + modifier.amount, 0))
}

// Continuous event auras use current faction and membership, including later arrivals.
export function eventAttackBonus(character: CharacterInstance, definitions: Readonly<Record<string, CharacterDefinition>>, event: EventId | null): number {
  const faction = effectiveFaction(character, definitions)
  const group = definitions[character.definitionId]!.relationGroup
  const rebel = faction === '造反派', conservative = faction === '保守派', military = faction === '军队'
  switch (event) {
    case 'february_outline': return rebel ? -1 : 0
    case 'may_16_notice': return rebel ? 1 : conservative ? -1 : 0
    case 'bombard_headquarters': return conservative && !['liu_shaoqi', 'deng_xiaoping'].includes(character.definitionId) ? -1 : 0
    case 'january_storm': case 'wen_gong_wu_wei': return rebel ? 2 : 0
    case 'february_countercurrent': return (rebel ? -1 : conservative || military ? 1 : 0) + (['chen_yi', 'ye_jianying', 'xu_xiangqian', 'tan_zhenlin', 'li_fuchun', 'li_xiannian'].includes(character.definitionId) ? 1 : 0)
    case 'july_20_incident': return military || rebel ? 1 : 0
    case 'september_13_incident': return group === 'lin_group' && character.definitionId !== 'lin_biao' ? -2 : 0
    case 'comprehensive_rectification': return conservative ? 1 : 0
    case 'april_5_incident': return group === 'gang_of_four' ? -1 : 0
    case 'huairentang_incident': return rebel && group !== 'gang_of_four' ? -1 : 0
    default: return 0
  }
}

export function effectiveFaction(
  character: CharacterInstance,
  definitions: Readonly<Record<string, CharacterDefinition>>,
): Faction {
  return character.factionOverride ?? definitions[character.definitionId]!.faction
}

export function canAttackPlayer(
  enemy: PlayerState,
  definitions: Readonly<Record<string, CharacterDefinition>>,
): boolean {
  return !enemy.board.some(c => definitions[c.definitionId]?.abilityId === 'GUARD')
}
