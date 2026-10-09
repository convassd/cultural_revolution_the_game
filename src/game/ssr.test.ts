import { describe, expect, it } from 'vitest'
import { characters, definitions } from '../data'
import { applyAction, createGame } from './engine'
import { createCharacter } from './effects'
import { effectiveAttack, effectiveFaction } from './rules'
import type { GameAction, GameState, PlayerId } from './types'

function fixture(hand: string[] = []): GameState {
  const state = createGame(characters, () => 0.5)
  state.players[0].hand = hand
  state.players[0].mana = 10
  state.players[0].maxMana = 10
  return state
}
function unit(id: string, instanceId = id) {
  const result = createCharacter(definitions[id]!, instanceId)
  result.canAttack = true
  return result
}
function act(state: GameState, action: GameAction, roll = 4): GameState {
  const before = structuredClone(state)
  const result = applyAction(state, action, definitions, () => (roll - 0.5) / 6)
  expect(result.error).toBeNull()
  expect(state).toEqual(before)
  return result.state
}
function end(state: GameState, roll = 4) {
  return act(state, { type: 'END_TURN', player: state.currentPlayer }, roll)
}
function attack(state: GameState, attackerId: string, targetId: string) {
  return act(state, { type: 'ATTACK', player: state.currentPlayer, attackerId,
    target: { type: 'character', instanceId: targetId } })
}

describe('毛泽东最高指示', () => {
  it.each([1, 2, 3, 4, 5, 6])('controls d6 result %i, dealing six only on six and exempting both Zhang Yufeng cards', roll => {
    const state = fixture()
    state.currentPlayer = 1
    state.players[0].board = [unit('mao_zedong', 'mao'), unit('wu_han', 'friend'), unit('zhang_yufeng', 'friendly-zhang')]
    state.players[1].board = [unit('chen_yi', 'enemy'), unit('ye_jianying', 'tough'), unit('zhang_yufeng', 'enemy-zhang')]
    const next = end(state, roll)
    const mao = next.players[0].board[0]!
    expect(mao).toMatchObject({ commandRoll: roll, canAttack: roll >= 3 && roll <= 5, health: 8 })
    expect(next.players[0].board.some(c => c.instanceId === 'friend')).toBe(roll !== 6)
    expect(next.players[1].board.some(c => c.instanceId === 'enemy')).toBe(roll !== 6)
    expect(next.players[1].board.find(c => c.instanceId === 'tough')!.health).toBe(roll === 6 ? 1 : 6)
    for (const [id, owner] of [['friendly-zhang', 0], ['enemy-zhang', 1]] as const)
      expect(next.players[owner].board.find(c => c.instanceId === id)!.health).toBe(definitions.zhang_yufeng!.health)
    expect(next.players.map(p => p.hp)).toEqual([20, 20])
    if (roll < 3 || roll === 6) expect(applyAction(next, { type: 'ATTACK', player: 0, attackerId: 'mao', target: { type: 'player' } }, definitions).error).toBeTruthy()
  })
  it.each([8, 20, 27])('adds five player HP on entry with no cap (initial %i)', hp => {
    const state = fixture(['mao_zedong'])
    state.players[0].hp = hp
    const never = () => { throw new Error('unexpected random call') }
    const result = applyAction(state, { type: 'PLAY_CARD', player: 0, cardId: 'mao_zedong' }, definitions, never)
    expect(result.error).toBeNull()
    expect(result.state.players[0]).toMatchObject({ hp: hp + 5, mana: 3 })
    expect(result.state.players[0].board[0]).toMatchObject({ health: 8, canAttack: false })
    expect(result.state.players[0].board[0]!.commandRoll).toBeUndefined()
    expect(state.players[0].hp).toBe(hp)
    const rejected = applyAction(result.state, { type: 'PLAY_CARD', player: 0, cardId: 'mao_zedong' }, definitions, never)
    expect(rejected.error).toBeTruthy()
    expect(rejected.state.players[0].hp).toBe(hp + 5)
    const enemyTurn = applyAction(result.state, { type: 'END_TURN', player: 0 }, definitions, never)
    expect(enemyTurn.error).toBeNull()
    expect(enemyTurn.state.players[0].hp).toBe(hp + 5)
  })
  it('Mao killing Lin triggers a second blast; Zhang is exempt only from Mao damage', () => {
    const state = fixture()
    state.currentPlayer = 1
    state.players[0].board = [unit('mao_zedong', 'mao'), unit('zhang_yufeng', 'zhang'), unit('liu_shaoqi', 'liu')]
    state.players[1].board = [unit('lin_biao', 'lin')]
    const result = applyAction(state, { type: 'END_TURN', player: 1 }, definitions, () => 0.99)
    expect(result.error).toBeNull()
    expect(result.state.players[0].board.find(c => c.instanceId === 'mao')!.health).toBe(6)
    expect(result.state.players[0].board.find(c => c.instanceId === 'zhang')!.health).toBe(1)
    expect(result.state.players[0].discard).toContain('liu_shaoqi')
    expect(result.events.filter(e => e.type === 'CHARACTER_DIED' && e.character.instanceId === 'lin')).toHaveLength(1)
    expect(result.events.filter(e => e.type === 'CHARACTER_DAMAGED' && e.instanceId === 'liu').map(e => e.type === 'CHARACTER_DAMAGED' && e.amount)).toEqual([5, 2])
    expect(result.state.players.map(p => p.hp)).toEqual([20, 20])
  })
})

describe('周恩来全局回合调解', () => {
  it('saves once in either player turn and resets immediately at each global turn start', () => {
    let state = fixture()
    state.players[0].board = [unit('zhu_de', 'a'), unit('chen_yi', 'c')]
    state.players[1].board = [unit('zhou_enlai', 'zhou'), unit('wu_han', 'b'), unit('lin_liguo', 'd')]
    state = attack(state, 'a', 'b')
    expect(state.players[1].board.find(c => c.instanceId === 'b')!.health).toBe(1)
    expect(state.players[1].board[0]!.health).toBe(7)
    expect(state.players[1].mediationUsed).toBe(true)
    state = attack(state, 'c', 'd')
    expect(state.players[1].discard).toContain('lin_liguo')
    state = end(state)
    expect(state.players[1].mediationUsed).toBe(false)
    state = attack(state, 'b', 'a')
    expect(state.players[1].board.find(c => c.instanceId === 'b')!.health).toBe(1)
    expect(state.players[1].board[0]!.health).toBe(5)
    state = end(state)
    expect(state.players.every(p => !p.mediationUsed)).toBe(true)
    expect(definitions.zhou_enlai!.faction).toBe('无派别')
  })
  it('does not rescue Zhou himself', () => {
    const state = fixture()
    state.players[0].board = [unit('zhou_enlai', 'zhou')]
    state.players[0].board[0]!.health = 1
    state.players[1].board = [unit('wu_han', 'enemy')]
    expect(attack(state, 'zhou', 'enemy').players[0].discard).toContain('zhou_enlai')
  })
  it('Zhou may die paying two HP while the rescued character stays alive', () => {
    const state = fixture()
    state.players[0].board = [unit('zhou_enlai', 'zhou'), unit('wu_han', 'a')]
    state.players[0].board[0]!.health = 2
    state.players[1].board = [unit('zhu_de', 'b')]
    const next = attack(state, 'a', 'b')
    expect(next.players[0].discard).toContain('zhou_enlai')
    expect(next.players[0].board).toHaveLength(1)
    expect(next.players[0].board[0]!.health).toBe(1)
  })
  it('area damage rescues the first eligible friendly slot only', () => {
    const state = fixture()
    state.currentPlayer = 1
    state.players[0].board = [unit('mao_zedong', 'mao'), unit('zhou_enlai', 'zhou'), unit('wu_han', 'a'), unit('lin_liguo', 'b')]
    const next = end(state, 6)
    expect(next.players[0].board.find(c => c.instanceId === 'a')!.health).toBe(1)
    expect(next.players[0].discard).toContain('lin_liguo')
    expect(next.players[0].board.find(c => c.instanceId === 'zhou')!.health).toBe(1)
  })
  it('Zhou dying in the initial damage batch cannot mediate', () => {
    const state = fixture()
    state.currentPlayer = 1
    state.players[0].board = [unit('mao_zedong'), unit('zhou_enlai'), unit('wu_han')]
    state.players[0].board[1]!.health = 6
    const next = end(state, 6)
    expect(next.players[0].discard).toEqual(['zhou_enlai', 'wu_han'])
    expect(next.players[0].mediationUsed).toBe(false)
  })
  it('a rescued Deng does not die or consume a return', () => {
    const state = fixture()
    state.players[0].board = [unit('zhou_enlai'), unit('deng_xiaoping', 'deng')]
    state.players[0].board[1]!.health = 1
    state.players[1].board = [unit('wu_han', 'enemy')]
    const next = attack(state, 'deng', 'enemy')
    expect(next.players[0].board[1]).toMatchObject({ health: 1, returnCount: 0 })
    expect(next.players[0].pendingReturns).toEqual([])
  })
})

describe('邓小平三起三落', () => {
  it('returns with 2/2, 1/2 neutral, 1/1 neutral, then goes to discard on the fourth death', () => {
    let state = fixture()
    state.currentPlayer = 1
    state.players[0].board = [unit('deng_xiaoping', 'deng')]
    state.players[1].board = [unit('mao_zedong', 'enemy')]
    const expected = [[2, 2, '保守派'], [1, 2, '无派别'], [1, 1, '无派别']] as const
    for (let count = 1; count <= 4; count++) {
      state = attack(state, 'enemy', 'deng')
      expect(state.players[0].board).toEqual([])
      if (count === 4) {
        expect(state.players[0].pendingReturns).toEqual([])
        expect(state.players[0].discard).toEqual(['deng_xiaoping'])
        break
      }
      expect(state.players[0].discard).toEqual([])
      expect(state.players[0].pendingReturns).toHaveLength(1)
      state = end(state)
      const deng = state.players[0].board[0]!
      expect(deng.instanceId).toBe('deng')
      expect(deng.returnCount).toBe(count)
      expect(effectiveAttack(deng, state.players[0].board, definitions)).toBe(expected[count - 1]![0])
      expect(deng.health).toBe(expected[count - 1]![1])
      expect(effectiveFaction(deng, definitions)).toBe(expected[count - 1]![2])
      expect(deng.canAttack).toBe(false)
      state = end(state)
    }
    expect(definitions.deng_xiaoping).toMatchObject({ attack: 2, health: 3, faction: '保守派' })
  })
  it('waits if the board is full and retries on a later own turn without exceeding 5', () => {
    let state = fixture()
    state.currentPlayer = 1
    state.players[0].board = [unit('deng_xiaoping', 'deng')]
    state.players[1].board = [unit('mao_zedong', 'enemy')]
    state = attack(state, 'enemy', 'deng')
    state.players[0].board = ['wu_han', 'kuai_dafu', 'yao_dengshan', 'zhang_yufeng', 'chen_yi'].map(id => unit(id))
    state = end(state)
    expect(state.players[0].board).toHaveLength(5)
    expect(state.players[0].pendingReturns).toHaveLength(1)
    state = attack(state, 'wu_han', 'enemy')
    state = end(state)
    state = end(state)
    expect(state.players[0].board).toHaveLength(5)
    expect(state.players[0].pendingReturns).toEqual([])
    expect(state.players[0].board.find(c => c.instanceId === 'deng')!.canAttack).toBe(false)
  })
  it('a returnee killed by Mao in the same start step waits until the following own turn', () => {
    let state = fixture()
    state.currentPlayer = 1
    state.players[0].board = [unit('deng_xiaoping', 'deng'), unit('mao_zedong', 'mao')]
    state.players[1].board = [unit('mao_zedong', 'enemy')]
    state = attack(state, 'enemy', 'deng')
    state = end(state, 6)
    expect(state.players[0].board.map(c => c.instanceId)).toEqual(['mao'])
    expect(state.players[0].pendingReturns).toHaveLength(1)
    expect(state.players[0].pendingReturns[0]!.returnCount).toBe(2)
  })
})

describe('邓小平复出整顿', () => {
  it.each([1, 2, 3])('buffs only other friendly Conservatives by +%i for that turn', count => {
    let state = fixture()
    state.currentPlayer = 1
    const deng = unit('deng_xiaoping', 'deng')
    deng.returnCount = count - 1
    deng.health = 1
    state.players[0].board = [deng, unit('peng_zhen', 'conservative'), unit('chen_yi', 'military'), unit('jiang_qing', 'rebel'), unit('zhou_enlai', 'neutral')]
    // Avoid mediation preventing Deng's intended death in this fixture.
    state.players[0].mediationUsed = true
    state.players[1].board = [unit('mao_zedong', 'enemy')]
    state = attack(state, 'enemy', 'deng')
    state = end(state)
    const owner = state.players[0]
    expect(owner.board.find(c => c.instanceId === 'conservative')!.temporaryAttack).toBe(count)
    for (const id of ['military', 'rebel', 'neutral', 'deng']) expect(owner.board.find(c => c.instanceId === id)!.temporaryAttack).toBe(0)
    expect(effectiveAttack(owner.board.find(c => c.instanceId === 'conservative')!, owner.board, definitions)).toBe(4 + count)
    expect(owner.board.find(c => c.instanceId === 'deng')!.canAttack).toBe(false)
    expect(state.log.some(line => line.includes('整顿') && line.includes('+' + count))).toBe(true)
    state = end(state)
    expect(state.players[0].board.every(c => c.temporaryAttack === 0)).toBe(true)
  })
  it('does not buff while waiting for a slot; buffs once when the delayed return actually enters', () => {
    let state = fixture()
    state.currentPlayer = 1
    state.players[0].board = [unit('deng_xiaoping', 'deng')]
    state.players[1].board = [unit('mao_zedong', 'enemy')]
    state = attack(state, 'enemy', 'deng')
    state.players[0].board = ['peng_zhen', 'wu_han', 'chen_yi', 'yao_dengshan', 'zhang_yufeng'].map(id => unit(id))
    state = end(state)
    expect(state.players[0].board[0]!.temporaryAttack).toBe(0)
    state = attack(state, 'wu_han', 'enemy')
    state = end(end(state))
    expect(state.players[0].board[0]!.temporaryAttack).toBe(1)
    expect(state.players[0].pendingReturns).toEqual([])
  })
  it('the temporary buff remains if returned Deng dies to Mao during the same turn start', () => {
    const state = fixture()
    state.currentPlayer = 1
    state.players[0].board = [unit('mao_zedong'), unit('liu_shaoqi', 'liu')]
    const deng = unit('deng_xiaoping', 'deng')
    deng.returnCount = 1; deng.health = 2; deng.attackOverride = 2
    state.players[0].pendingReturns = [deng]
    const next = end(state, 6)
    expect(next.players[0].board.find(c => c.instanceId === 'liu')).toMatchObject({ health: 2, temporaryAttack: 1 })
    expect(next.players[0].pendingReturns[0]!.returnCount).toBe(2)
  })
})

describe('林彪离场爆炸', () => {
  it('starts at three and expires after three own turn ends, including entry', () => {
    let state = act(fixture(['lin_biao']), { type: 'PLAY_CARD', player: 0, cardId: 'lin_biao' })
    expect(state.players[0].board[0]!.countdown).toBe(3)
    state = end(state)
    expect(state.players[0].board[0]!.countdown).toBe(2)
    state = end(state)
    expect(state.players[0].board[0]!.countdown).toBe(2)
    state = end(state)
    expect(state.players[0].board[0]!.countdown).toBe(1)
    state = end(state)
    expect(state.players[0].board[0]!.countdown).toBe(1)
    state = end(state)
    expect(state.players[0].board).toEqual([])
    expect(state.players[0].discard).toEqual(['lin_biao'])
    expect(state.log.filter(line => line.includes('离场爆炸'))).toHaveLength(1)
  })
  it.each([0, 1] as PlayerId[])('directly removes Ye Qun and Lin Liguo on side %i without mediation', owner => {
    const state = fixture()
    state.players[0].board = [unit('lin_biao', 'lin')]
    state.players[0].board[0]!.countdown = 1
    state.players[owner].board.push(unit('zhou_enlai', 'zhou'), unit('ye_qun', 'ye'), unit('lin_liguo', 'liguo'))
    state.players[1].board.push(unit('ye_jianying', 'tough'))
    const next = end(state)
    expect(next.players[0].discard).toContain('lin_biao')
    expect(next.players[owner].discard).toEqual(expect.arrayContaining(['ye_qun', 'lin_liguo']))
    expect(next.players[owner].board.find(c => c.instanceId === 'zhou')!.health).toBe(7)
    expect(next.players[owner].mediationUsed).toBe(false)
    expect(next.players[1].board.find(c => c.instanceId === 'tough')!.health).toBe(5)
    expect(next.players.map(p => p.hp)).toEqual([20, 20])
  })
  it('ordinary combat death also explodes exactly once', () => {
    const state = fixture()
    state.players[0].board = [unit('lin_biao', 'lin'), unit('ye_qun', 'ye')]
    state.players[0].board[0]!.health = 1
    state.players[1].board = [unit('wu_han', 'victim'), unit('chen_yi', 'other')]
    const result = applyAction(state, { type: 'ATTACK', player: 0, attackerId: 'lin', target: { type: 'character', instanceId: 'victim' } }, definitions)
    expect(result.error).toBeNull()
    expect(result.state.players[0].board).toEqual([])
    expect(result.state.players[0].discard).toEqual(['lin_biao', 'ye_qun'])
    expect(result.state.players[1].board[0]!.health).toBe(3)
    expect(result.events.filter(e => e.type === 'CHARACTER_DIED' && e.character.instanceId === 'lin')).toHaveLength(1)
    expect(result.state.log.filter(line => line.includes('离场爆炸'))).toHaveLength(1)
  })
  it('being rescued by Zhou prevents departure and the blast', () => {
    const state = fixture()
    state.players[0].board = [unit('lin_biao', 'lin'), unit('zhou_enlai', 'zhou')]
    state.players[0].board[0]!.health = 1
    state.players[1].board = [unit('wu_han', 'victim'), unit('chen_yi', 'other')]
    const next = attack(state, 'lin', 'victim')
    expect(next.players[0].board[0]).toMatchObject({ health: 1, countdown: 3 })
    expect(next.players[0].board[1]!.health).toBe(7)
    expect(next.players[1].board[0]!.health).toBe(5)
    expect(next.log.some(line => line.includes('离场爆炸'))).toBe(false)
  })
  it('the end-turn blast schedules an enemy Deng return on the incoming turn', () => {
    const state = fixture()
    state.players[0].board = [unit('lin_biao', 'lin')]
    state.players[0].board[0]!.countdown = 1
    state.players[1].board = [unit('deng_xiaoping', 'deng')]
    state.players[1].board[0]!.health = 1
    const next = end(state)
    expect(next.currentPlayer).toBe(1)
    expect(next.players[1].board[0]).toMatchObject({ instanceId: 'deng', returnCount: 1, health: 2, canAttack: false })
    expect(next.players[1].pendingReturns).toEqual([])
  })
})

describe('江青借势', () => {
  it('draws the first Rebel from the deck without changing the order of remaining cards or exposing its ID in logs', () => {
    const state = fixture(['jiang_qing'])
    state.players[0].deck = ['zhou_enlai', 'mao_zedong', 'nie_yuanzi', 'yao_wenyuan']
    const next = act(state, { type: 'PLAY_CARD', player: 0, cardId: 'jiang_qing' })
    expect(next.players[0].hand).toEqual(['nie_yuanzi'])
    expect(next.players[0].deck).toEqual(['zhou_enlai', 'mao_zedong', 'yao_wenyuan'])
    expect(next.players[0].board[0]).toMatchObject({ canAttack: false, health: 5 })
    expect(next.players[0].mana).toBe(6)
    expect(next.log.join('')).not.toContain('聂元梓')
  })
  it.each([{ deck: [] }, { deck: ['zhou_enlai', 'mao_zedong'] }])('skips drawing if no Rebel remains ($deck)', ({ deck }) => {
    const state = fixture(['jiang_qing'])
    state.players[0].deck = deck
    const next = act(state, { type: 'PLAY_CARD', player: 0, cardId: 'jiang_qing' })
    expect(next.players[0].deck).toEqual(deck)
    expect(next.players[0].hand).toEqual([])
    expect(next.players[0].board).toHaveLength(1)
  })
  it('Mao aura stacks with group and temporary bonuses, then disappears immediately when friendly Mao dies', () => {
    let state = fixture(['mao_zedong'])
    state.players[0].board = [unit('jiang_qing', 'jiang'), unit('yao_wenyuan', 'yao')]
    state.players[0].board[0]!.temporaryAttack = 1
    state.players[1].board = [unit('zhu_de', 'enemy')]
    expect(effectiveAttack(state.players[0].board[0]!, state.players[0].board, definitions)).toBe(5)
    state = act(state, { type: 'PLAY_CARD', player: 0, cardId: 'mao_zedong' })
    expect(effectiveAttack(state.players[0].board[0]!, state.players[0].board, definitions)).toBe(7)
    const mao = state.players[0].board[2]!
    mao.health = 1
    state = end(state)
    state = attack(state, 'enemy', mao.instanceId)
    expect(effectiveAttack(state.players[0].board[0]!, state.players[0].board, definitions)).toBe(4)
    expect(definitions.jiang_qing!.attack).toBe(3)
  })
  it('an enemy Mao does not grant the aura; completing the group grants only its ordinary attack bonus', () => {
    const state = fixture(['wang_hongwen'])
    state.players[0].board = ['jiang_qing', 'zhang_chunqiao', 'yao_wenyuan'].map(id => unit(id))
    state.players[1].board = [unit('mao_zedong')]
    state.players[1].hp = 6
    const next = act(state, { type: 'PLAY_CARD', player: 0, cardId: 'wang_hongwen' })
    expect(next.players[1].hp).toBe(6)
    expect(next.winner).toBeNull()
    expect(effectiveAttack(next.players[0].board[0]!, next.players[0].board, definitions)).toBe(5)
  })
})
