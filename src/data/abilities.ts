import type { AbilityId } from '../game/types'

export const ABILITIES: Record<AbilityId, { name: string; description: string }> = {
  TOUGH: { name: '申辩', description: '每回合第一次受到的伤害 -1。' },
  BUFF_ONE: { name: '动员', description: '登场：另一名己方角色本回合攻击 +1。' },
  DRAW_ONE: { name: '串联', description: '登场：抽 1 张牌。' },
  REVEAL_HAND: { name: '内部消息', description: '登场：查看对方手牌。' },
  GROUP_DRAW: { name: '碰头会', description: '登场：已有己方同组成员时，抽 1 张牌。' },
  CHARGE: { name: '冲击', description: '登场回合即可攻击。' },
  WEAKEN: { name: '大字报', description: '登场：一名敌方角色本回合攻击 -1。' },
  GUARD: { name: '保卫', description: '在场时，对方角色不能直接攻击玩家。' },
  MAO_RANDOM_COMMAND: { name: '最高指示', description: '己方回合开始投骰：1–2 禁止攻击；3–5 正常；6 对其它所有角色造成 2 点伤害并禁止攻击。' },
  ZHOU_MEDIATION: { name: '斡旋', description: '己方回合首次另一己方角色受到致命伤害：保留 1 HP，自己受到 2 点伤害。' },
  DENG_RETURN: { name: '三起三落', description: '前三次死亡后于下一己方回合复出：2/2、1/2（无派别）、1/1；复出回合不能攻击。' },
  LIN_COUNTDOWN: { name: '折戟沉沙', description: '登场计数 3；己方回合结束 -1。归零时自己死亡，全场角色受到 2 点伤害，双方的叶群、林立果直接死亡。' },
  JIANG_FULL_GROUP: { name: '四人帮集结', description: '每局首次四人帮同时在己方场上：对敌方玩家造成 6 点伤害。' },
}

const IMPLEMENTED = new Set<AbilityId>([
  'TOUGH', 'BUFF_ONE', 'DRAW_ONE', 'REVEAL_HAND', 'GROUP_DRAW', 'CHARGE', 'WEAKEN', 'GUARD',
  'MAO_RANDOM_COMMAND', 'ZHOU_MEDIATION', 'DENG_RETURN', 'LIN_COUNTDOWN', 'JIANG_FULL_GROUP',
])

export function isAbilityImplemented(id: AbilityId): boolean {
  return IMPLEMENTED.has(id)
}
