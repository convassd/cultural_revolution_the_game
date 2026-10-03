import { factionBonus } from './rules'
import type { Faction } from './types'

export interface Combatant { attack: number; health: number; faction: Faction; toughReady?: boolean }

export function resolveDamage(amount: number, toughReady = false) {
  const toughTriggered = toughReady && amount > 0
  return { damage: Math.max(0, amount - (toughTriggered ? 1 : 0)), toughTriggered }
}

// Both damage values use the board snapshot before deaths change any aura.
// Retaliation is also a damage source, so its faction bonus applies independently.
export function resolveCombat(attacker: Combatant, defender: Combatant) {
  const rawToDefender = attacker.attack + factionBonus(attacker.faction, defender.faction)
  const rawToAttacker = defender.attack + factionBonus(defender.faction, attacker.faction)
  const defenderDamage = resolveDamage(rawToDefender, defender.toughReady)
  const attackerDamage = resolveDamage(rawToAttacker, attacker.toughReady)
  const toDefender = defenderDamage.damage
  const toAttacker = attackerDamage.damage
  return {
    attackerHealth: attacker.health - toAttacker,
    defenderHealth: defender.health - toDefender,
    toDefender,
    toAttacker,
    attackerToughTriggered: attackerDamage.toughTriggered,
    defenderToughTriggered: defenderDamage.toughTriggered,
  }
}
