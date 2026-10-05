import type { AbilityId } from '../game/types'

export const DENG_RECTIFICATION_NAME = '整顿'

export const ABILITIES: Record<AbilityId, { name: string; description: string }> = {
  TOUGH: { name: '申辩', description: '每回合第一次受到的伤害 -1。' },
  BUFF_ONE: { name: '声援', description: '登场：另一名己方角色本回合攻击 +1。' },
  DRAW_ONE: { name: '串联', description: '登场：抽 1 张牌。' },
  REVEAL_HAND: { name: '调查材料', description: '登场：查看对方手牌。' },
  GROUP_DRAW: { name: '动员', description: '登场：已有己方同组成员时，抽 1 张牌。' },
  CHARGE: { name: '冲击', description: '登场回合即可攻击。' },
  WEAKEN: { name: '大字报', description: '登场：一名敌方角色本回合攻击 -1。' },
  GUARD: { name: '保卫', description: '在场时，对方角色不能直接攻击玩家。' },
  MAO_RANDOM_COMMAND: { name: '最高指示', description: '登场：己方玩家恢复 5 HP，可超过 20。己方回合开始投骰：1–2 停攻；3–5 正常；6 除毛本人和双方张玉凤外，所有角色受到 6 点伤害，毛本回合停攻。' },
  ZHOU_MEDIATION: { name: '调解', description: '每个玩家回合最多一次：另一名己方角色受到致命伤害时，保留 1 HP；自己受到 2 点伤害。' },
  DENG_RETURN: { name: '三起三落', description: `前三次死亡后于下一己方回合复出：2/2、1/2（无派别）、1/1；本回合休息。复出时「${DENG_RECTIFICATION_NAME}」：其他己方保守派本回合攻击 +1/+2/+3。` },
  LIN_COUNTDOWN: { name: '折戟沉沙', description: '登场计数 2；己方回合结束 -1，归零时死亡。每次离场：其他角色受到 2 点伤害，双方叶群、林立果直接死亡。' },
  JIANG_BORROW_POWER: { name: '借势', description: '登场：从牌库抽 1 张造反派。己方毛泽东在场时，攻击 +2；仍享受关系组加成。' },
}

const IMPLEMENTED = new Set<AbilityId>([
  'TOUGH', 'BUFF_ONE', 'DRAW_ONE', 'REVEAL_HAND', 'GROUP_DRAW', 'CHARGE', 'WEAKEN', 'GUARD',
  'MAO_RANDOM_COMMAND', 'ZHOU_MEDIATION', 'DENG_RETURN', 'LIN_COUNTDOWN', 'JIANG_BORROW_POWER',
])

export function isAbilityImplemented(id: AbilityId): boolean {
  return IMPLEMENTED.has(id)
}
