import type { Faction } from '../game/types'

export const FACTION_CLASSES: Record<Faction, string> = {
  '保守派': 'faction-conservative', '造反派': 'faction-rebel', '军队': 'faction-military', '无派别': 'faction-neutral',
}
