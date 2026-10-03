import { resolveDamage } from './combat'
import { BOARD_LIMIT, effectiveFaction } from './rules'
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
  if (card.abilityId === 'LIN_COUNTDOWN') character.countdown = 3
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
      recordLog(state, `${card.name} 触发申辩，受到的伤害 -1。`)
    }
  }
  // Direct deaths bypass damage reduction and damage-only death replacement.
  for (const character of board) if (forced.has(character.instanceId)) character.health = 0

  const owner = state.players[state.currentPlayer]
  const zhou = owner.board.find(c => c.health > 0 && definitions[c.definitionId]!.abilityId === 'ZHOU_MEDIATION')
  if (zhou && !owner.mediationUsed) {
    const victim = owner.board.find(c => c.instanceId !== zhou.instanceId && c.health <= 0 &&
      (applied.get(c.instanceId) ?? 0) > 0 && !forced.has(c.instanceId))
    if (victim) {
      owner.mediationUsed = true
      victim.health = 1
      zhou.health -= 2
      events.push({ type: 'CHARACTER_DAMAGED', instanceId: zhou.instanceId, amount: 2 })
      recordLog(state, `周恩来调停：${definitions[victim.definitionId]!.name} 保留 1 HP，周恩来受到 2 点伤害。`)
    }
  }
  return applied
}

export function removeDead(state: GameState, definitions: Definitions, events: GameEvent[] = []) {
  for (const player of state.players) {
    for (const character of player.board.filter(c => c.health <= 0)) {
      const card = definitions[character.definitionId]!
      events.push({ type: 'CHARACTER_DIED', playerId: player.id, character: structuredClone(character) })
      recordLog(state, `玩家 ${player.id + 1} 的 ${card.name} 离场。`)
      if (card.abilityId === 'DENG_RETURN' && (character.returnCount ?? 0) < 3) {
        const count = (character.returnCount ?? 0) + 1
        player.pendingReturns.push({
          ...character, returnCount: count, health: count === 3 ? 1 : 2,
          attackOverride: count === 1 ? 2 : 1,
          factionOverride: count >= 2 ? '无派别' : effectiveFaction(character, definitions),
          canAttack: false, temporaryAttack: 0, toughUsed: false,
        })
        recordLog(state, `邓小平等待下一己方回合进行第 ${count} 次复出。`)
      } else player.discard.push(character.definitionId)
    }
    player.board = player.board.filter(c => c.health > 0)
  }
}

export function checkFullGroup(state: GameState, events: GameEvent[] = []) {
  if (state.jiangTriggered) return
  const members = ['jiang_qing', 'zhang_chunqiao', 'yao_wenyuan', 'wang_hongwen']
  for (const player of state.players) {
    if (!members.every(id => player.board.some(c => c.definitionId === id && c.health > 0))) continue
    state.jiangTriggered = true
    const enemy = state.players[player.id === 0 ? 1 : 0]
    enemy.hp = Math.max(0, enemy.hp - 6)
    events.push({ type: 'PLAYER_DAMAGED', playerId: enemy.id, amount: 6 })
    recordLog(state, `四人帮集结：对玩家 ${enemy.id + 1} 造成 6 点伤害（本局仅一次）。`)
    if (enemy.hp === 0) {
      state.winner = player.id
      recordLog(state, `玩家 ${player.id + 1} 获胜！`)
    }
    return
  }
}

export function beginCharacterTurn(state: GameState, definitions: Definitions, random: () => number, events: GameEvent[] = []) {
  const player = state.players[state.currentPlayer]
  player.mediationUsed = false
  for (const owner of state.players) {
    for (const character of owner.board) character.toughUsed = false
  }
  for (const character of player.board) character.canAttack = true

  while (player.pendingReturns.length && player.board.length < BOARD_LIMIT) {
    const character = player.pendingReturns.shift()!
    // Returnees enter after existing characters ready, so they still rest this turn.
    character.canAttack = false
    character.temporaryAttack = 0
    character.toughUsed = false
    player.board.push(character)
    events.push({ type: 'CHARACTER_RETURNED', playerId: player.id, character: structuredClone(character) })
    recordLog(state, `邓小平第 ${character.returnCount} 次复出：${character.attackOverride}/${character.health}，${effectiveFaction(character, definitions)}，本回合休息。`)
  }
  if (player.pendingReturns.length) recordLog(state, '场地已满，邓小平等待下次己方回合复出。')
  checkFullGroup(state, events)
  if (state.winner !== null) return

  const commanders = player.board.filter(c => definitions[c.definitionId]!.abilityId === 'MAO_RANDOM_COMMAND')
  for (const mao of commanders) {
    if (mao.health <= 0 || !player.board.includes(mao)) continue
    const roll = Math.floor(random() * 6) + 1
    mao.commandRoll = roll
    mao.canAttack = roll >= 3 && roll <= 5
    recordLog(state, `毛泽东指令骰：${roll}，${mao.canAttack ? '本回合正常攻击' : '本回合不能攻击'}。`)
    if (roll === 6) {
      const hits = state.players.flatMap(owner => owner.board)
        .filter(c => c.instanceId !== mao.instanceId)
        .map(c => ({ instanceId: c.instanceId, amount: 2 }))
      recordLog(state, '毛泽东指令：对场上其它所有角色各造成 2 点伤害。')
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
    lin.countdown = Math.max(0, (lin.countdown ?? 3) - 1)
    recordLog(state, `林彪折戟沉沙：${lin.countdown}。`)
    if (lin.countdown !== 0) continue
    const board = state.players.flatMap(owner => owner.board)
    const forced = board.filter(c => c.instanceId === lin.instanceId ||
      c.definitionId === 'ye_qun' || c.definitionId === 'lin_liguo').map(c => c.instanceId)
    recordLog(state, '林彪折戟沉沙归零：全场角色受到 2 点伤害，林彪及双方的叶群、林立果直接死亡。')
    applyDamageBatch(state, board.map(c => ({ instanceId: c.instanceId, amount: 2 })), definitions, forced, events)
    removeDead(state, definitions, events)
  }
}
