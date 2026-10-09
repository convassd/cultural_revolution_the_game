import { resolveDamage } from './combat'
import { BOARD_LIMIT, effectiveFaction, LIN_INITIAL_COUNTDOWN } from './rules'
import { ABILITIES, DENG_RECTIFICATION_NAME } from '../data/abilities'
import type { CharacterDefinition, CharacterInstance, GameEvent, GameState } from './types'

type Definitions = Readonly<Record<string, CharacterDefinition>>
export interface DamageHit { instanceId: string; amount: number }

// Helpers mutate only the engine's fresh state copy, never the caller's snapshot.
export function recordLog(state: GameState, message: string) {
  state.log.push(message)
  if (state.log.length > 60) state.log.shift()
}

export function createCharacter(card: CharacterDefinition, instanceId: string): CharacterInstance {
  const character: CharacterInstance = {
    instanceId, definitionId: card.id, health: card.health,
    canAttack: card.abilityId === 'CHARGE', temporaryAttack: 0, toughUsed: false,
  }
  if (card.abilityId === 'LIN_COUNTDOWN') character.countdown = LIN_INITIAL_COUNTDOWN
  if (card.abilityId === 'DENG_RETURN') character.returnCount = 0
  return character
}

export function applyDamageBatch(
  state: GameState,
  hits: readonly DamageHit[],
  definitions: Definitions,
  forcedDeaths: readonly string[] = [],
  events: GameEvent[] = [],
): Map<string, number> {
  const board = state.players.flatMap(player => player.board)
  const forced = new Set(forcedDeaths)
  const applied = new Map<string, number>()
  for (const hit of hits) {
    const character = board.find(c => c.instanceId === hit.instanceId)
    if (!character || character.health <= 0) continue
    const card = definitions[character.definitionId]!
    const result = resolveDamage(hit.amount, card.abilityId === 'TOUGH' && !character.toughUsed)
    character.health -= result.damage
    events.push({ type: 'CHARACTER_DAMAGED', instanceId: character.instanceId, amount: result.damage })
    applied.set(character.instanceId, (applied.get(character.instanceId) ?? 0) + result.damage)
    if (result.toughTriggered) {
      character.toughUsed = true
      recordLog(state, `${card.name} 触发${ABILITIES.TOUGH.name}，受到的伤害 -1。`)
    }
  }
  // Direct deaths bypass damage reduction and damage-only death replacement.
  for (const character of board) if (forced.has(character.instanceId)) character.health = 0

  for (const owner of state.players) {
    const zhou = owner.board.find(c => c.health > 0 && definitions[c.definitionId]!.abilityId === 'ZHOU_MEDIATION')
    if (!zhou || owner.mediationUsed) continue
    const victim = owner.board.find(c => c.instanceId !== zhou.instanceId && c.health <= 0 &&
      (applied.get(c.instanceId) ?? 0) > 0 && !forced.has(c.instanceId))
    if (victim) {
      owner.mediationUsed = true
      victim.health = 1
      zhou.health -= 2
      events.push({ type: 'CHARACTER_DAMAGED', instanceId: zhou.instanceId, amount: 2 })
      recordLog(state, `周恩来「${ABILITIES.ZHOU_MEDIATION.name}」：${definitions[victim.definitionId]!.name} 保留 1 HP，周恩来受到 2 点伤害。`)
    }
  }
  return applied
}

export function removeDead(state: GameState, definitions: Definitions, events: GameEvent[] = []) {
  // Remove each lethal batch before resolving departure effects. Newly killed characters
  // are processed in the next wave, so chained blasts cannot fire twice or retain dead auras.
  while (state.players.some(player => player.board.some(c => c.health <= 0))) {
    let departingLins = 0
    for (const player of state.players) {
      for (const character of player.board.filter(c => c.health <= 0)) {
        const card = definitions[character.definitionId]!
        events.push({ type: 'CHARACTER_DIED', playerId: player.id, character: structuredClone(character) })
        recordLog(state, `玩家 ${player.id + 1} 的 ${card.name} 离场。`)
        if (card.abilityId === 'LIN_COUNTDOWN') departingLins++
        if (card.abilityId === 'DENG_RETURN' && (character.returnCount ?? 0) < 3) {
          const count = (character.returnCount ?? 0) + 1
          player.pendingReturns.push({
            ...character, returnCount: count, health: count === 3 ? 1 : 2,
            attackOverride: count === 1 ? 2 : 1,
            factionOverride: count >= 2 ? '无派别' : effectiveFaction(character, definitions),
            canAttack: false, temporaryAttack: 0, attackModifiers: [], toughUsed: false,
          })
          recordLog(state, `邓小平等待下一己方回合进行第 ${count} 次复出。`)
        } else player.discard.push(character.definitionId)
      }
      player.board = player.board.filter(c => c.health > 0)
    }
    for (let i = 0; i < departingLins; i++) {
      const board = state.players.flatMap(player => player.board)
      const forced = board.filter(c => c.definitionId === 'ye_qun' || c.definitionId === 'lin_liguo').map(c => c.instanceId)
      recordLog(state, `林彪「${ABILITIES.LIN_COUNTDOWN.name}」：离场爆炸，其他角色受到 2 点伤害，双方叶群、林立果直接死亡。`)
      applyDamageBatch(state, board.map(c => ({ instanceId: c.instanceId, amount: 2 })), definitions, forced, events)
    }
  }
}

export function beginCharacterTurn(state: GameState, definitions: Definitions, random: () => number, events: GameEvent[] = []) {
  const player = state.players[state.currentPlayer]
  for (const owner of state.players) {
    owner.mediationUsed = false
    for (const character of owner.board) character.toughUsed = false
  }
  for (const character of player.board) character.canAttack = true

  while (player.pendingReturns.length && player.board.length < BOARD_LIMIT) {
    const character = player.pendingReturns.shift()!
    // Returnees enter after existing characters ready, so they still rest this turn.
    character.canAttack = false
    character.temporaryAttack = 0
    character.attackModifiers = []
    character.toughUsed = false
    player.board.push(character)
    events.push({ type: 'CHARACTER_RETURNED', playerId: player.id, character: structuredClone(character) })
    recordLog(state, `邓小平第 ${character.returnCount} 次复出：${character.attackOverride}/${character.health}，${effectiveFaction(character, definitions)}，本回合休息。`)
    const bonus = character.returnCount ?? 0
    for (const ally of player.board) {
      if (ally.instanceId !== character.instanceId && ally.health > 0 && effectiveFaction(ally, definitions) === '保守派') ally.temporaryAttack += bonus
    }
    recordLog(state, `邓小平「${DENG_RECTIFICATION_NAME}」：其他己方保守派本回合攻击 +${bonus}。`)
  }
  if (player.pendingReturns.length) recordLog(state, '场地已满，邓小平等待下次己方回合复出。')

  const commanders = player.board.filter(c => definitions[c.definitionId]!.abilityId === 'MAO_RANDOM_COMMAND')
  for (const mao of commanders) {
    if (mao.health <= 0 || !player.board.includes(mao)) continue
    const roll = Math.floor(random() * 6) + 1
    mao.commandRoll = roll
    mao.canAttack = roll >= 3 && roll <= 5
    recordLog(state, `毛泽东指令骰：${roll}，${mao.canAttack ? '本回合正常攻击' : '本回合不能攻击'}。`)
    if (roll === 6) {
      const hits = state.players.flatMap(owner => owner.board)
        .filter(c => c.instanceId !== mao.instanceId && c.definitionId !== 'zhang_yufeng')
        .map(c => ({ instanceId: c.instanceId, amount: 6 }))
      recordLog(state, `毛泽东「${ABILITIES.MAO_RANDOM_COMMAND.name}」：除毛本人和双方张玉凤外，所有角色各受到 6 点伤害。`)
      applyDamageBatch(state, hits, definitions, [], events)
      removeDead(state, definitions, events)
    }
  }
}

export function endCharacterTurn(state: GameState, definitions: Definitions, events: GameEvent[] = []) {
  const player = state.players[state.currentPlayer]
  const countdowns = player.board.filter(c => definitions[c.definitionId]!.abilityId === 'LIN_COUNTDOWN')
  for (const lin of countdowns) {
    if (lin.health <= 0 || !player.board.includes(lin)) continue
    lin.countdown = Math.max(0, (lin.countdown ?? LIN_INITIAL_COUNTDOWN) - 1)
    recordLog(state, `林彪「${ABILITIES.LIN_COUNTDOWN.name}」：${lin.countdown}。`)
    if (lin.countdown !== 0) continue
    lin.health = 0
    removeDead(state, definitions, events)
  }
}
