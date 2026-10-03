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

describe('毛泽东随机指令', () => {
  it.each([1, 2, 3, 4, 5, 6])('controls d6 result %i at the start of the own turn', roll => {
    const state = fixture()
    state.currentPlayer = 1
    state.players[0].board = [unit('mao_zedong', 'mao'), unit('wu_han', 'friend')]
    state.players[1].board = [unit('chen_yi', 'enemy'), unit('ye_jianying', 'tough')]
    const next = end(state, roll)
    const mao = next.players[0].board[0]!
    expect(mao.commandRoll).toBe(roll)
    expect(mao.canAttack).toBe(roll >= 3 && roll <= 5)
    expect(mao.health).toBe(12)
    expect(next.players[0].board[1]!.health).toBe(roll === 6 ? 1 : 3)
    expect(next.players[0].board[1]!.canAttack).toBe(true)
    expect(next.players[1].board[0]!.health).toBe(roll === 6 ? 3 : 5)
    expect(next.players[1].board[1]!.health).toBe(roll === 6 ? 5 : 6)
    expect(next.players.map(p => p.hp)).toEqual([20, 20])
    if (roll < 3 || roll === 6) {
      const denied = applyAction(next, { type: 'ATTACK', player: 0, attackerId: 'mao', target: { type: 'player' } }, definitions)
      expect(denied.error).not.toBeNull()
      expect(denied.state).toBe(next)
    }
  })
  it('does not roll on entry, the enemy turn, or rejected actions', () => {
    const state = fixture(['mao_zedong'])
    const never = () => { throw new Error('unexpected random call') }
    const played = applyAction(state, { type: 'PLAY_CARD', player: 0, cardId: 'mao_zedong' }, definitions, never)
    expect(played.error).toBeNull()
    expect(played.state.players[0].board[0]!.commandRoll).toBeUndefined()
    expect(applyAction(played.state, { type: 'END_TURN', player: 0 }, definitions, never).error).toBeNull()
    expect(applyAction(played.state, { type: 'END_TURN', player: 1 }, definitions, never).error).not.toBeNull()
  })
})

describe('周恩来调停', () => {
  it('saves another friendly character once per own turn and resets on the next own turn', () => {
    let state = fixture()
    state.players[0].board = [unit('zhou_enlai', 'zhou'), unit('wu_han', 'a'), unit('lin_liguo', 'c')]
    state.players[1].board = [unit('zhu_de', 'b')]
    state = attack(state, 'a', 'b')
    expect(state.players[0].board.find(c => c.instanceId === 'a')!.health).toBe(1)
    expect(state.players[0].board[0]!.health).toBe(7)
    expect(state.players[0].mediationUsed).toBe(true)
    state = attack(state, 'c', 'b')
    expect(state.players[0].discard).toContain('lin_liguo')
    expect(state.players[0].board[0]!.health).toBe(7)
    state = end(state)
    expect(state.players[0].mediationUsed).toBe(true)
    state = end(state)
    expect(state.players[0].mediationUsed).toBe(false)
  })
  it('does not save enemy-turn casualties or Zhou himself', () => {
    const enemyTurn = fixture()
    enemyTurn.players[0].board = [unit('zhu_de', 'a')]
    enemyTurn.players[1].board = [unit('zhou_enlai', 'zhou'), unit('wu_han', 'b')]
    const next = attack(enemyTurn, 'a', 'b')
    expect(next.players[1].discard).toContain('wu_han')
    expect(next.players[1].board[0]!.health).toBe(9)
    const self = fixture()
    self.players[0].board = [unit('zhou_enlai', 'zhou')]
    self.players[0].board[0]!.health = 1
    self.players[1].board = [unit('wu_han', 'b')]
    expect(attack(self, 'zhou', 'b').players[0].discard).toContain('zhou_enlai')
  })
  it('Zhou may die paying the 2 HP while the saved character stays alive', () => {
    const state = fixture()
    state.players[0].board = [unit('zhou_enlai', 'zhou'), unit('wu_han', 'a')]
    state.players[0].board[0]!.health = 2
    state.players[1].board = [unit('zhu_de', 'b')]
    const next = attack(state, 'a', 'b')
    expect(next.players[0].discard).toContain('zhou_enlai')
    expect(next.players[0].board).toHaveLength(1)
    expect(next.players[0].board[0]!.health).toBe(1)
  })
  it('simultaneous lethal damage saves the first eligible board slot only', () => {
    const state = fixture()
    state.currentPlayer = 1
    state.players[0].board = [unit('mao_zedong', 'mao'), unit('zhou_enlai', 'zhou'), unit('wu_han', 'a'), unit('lin_liguo', 'b')]
    state.players[0].board[2]!.health = 1
    state.players[0].board[3]!.health = 1
    const next = end(state, 6)
    expect(next.players[0].board.find(c => c.instanceId === 'a')!.health).toBe(1)
    expect(next.players[0].discard).toContain('lin_liguo')
    expect(next.players[0].board.find(c => c.instanceId === 'zhou')!.health).toBe(5)
  })
  it('Zhou dying in the same damage batch cannot mediate', () => {
    const state = fixture()
    state.currentPlayer = 1
    state.players[0].board = [unit('mao_zedong'), unit('zhou_enlai'), unit('wu_han')]
    state.players[0].board[1]!.health = 2
    state.players[0].board[2]!.health = 1
    const next = end(state, 6)
    expect(next.players[0].discard).toEqual(['zhou_enlai', 'wu_han'])
    expect(next.players[0].mediationUsed).toBe(false)
  })
  it('a rescued Deng does not count as dead or enter the return queue', () => {
    const state = fixture()
    state.players[0].board = [unit('zhou_enlai'), unit('deng_xiaoping', 'deng')]
    state.players[0].board[1]!.health = 1
    state.players[1].board = [unit('wu_han', 'b')]
    const next = attack(state, 'deng', 'b')
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

describe('林彪折戟沉沙', () => {
  it('starts at 3 and ticks only at own turn ends, including the entry turn', () => {
    let state = fixture(['lin_biao'])
    state = act(state, { type: 'PLAY_CARD', player: 0, cardId: 'lin_biao' })
    expect(state.players[0].board[0]!.countdown).toBe(3)
    state = end(state)
    expect(state.players[0].board[0]!.countdown).toBe(2)
    state = end(state)
    expect(state.players[0].board[0]!.countdown).toBe(2)
    state = end(state)
    expect(state.players[0].board[0]!.countdown).toBe(1)
    state = end(state)
    state = end(state)
    expect(state.players[0].board).toEqual([])
    expect(state.players[0].discard).toEqual(['lin_biao'])
  })
  it.each([0, 1] as PlayerId[])('kills Ye Qun and Lin Liguo on side %i directly, with global damage and TOUGH', owner => {
    const state = fixture()
    state.players[0].board = [unit('lin_biao', 'lin'), unit('zhou_enlai', 'zhou'), unit('wu_han', 'friend')]
    state.players[0].board[0]!.countdown = 1
    state.players[owner].board.push(unit('ye_qun', 'ye'), unit('lin_liguo', 'liguo'))
    state.players[1].board.push(unit('ye_jianying', 'tough'), unit('chen_yi', 'other'))
    const next = end(state)
    expect(next.players[0].discard).toContain('lin_biao')
    expect(next.players[owner].discard).toEqual(expect.arrayContaining(['ye_qun', 'lin_liguo']))
    expect(next.players[0].board.find(c => c.instanceId === 'friend')!.health).toBe(1)
    expect(next.players[0].board.find(c => c.instanceId === 'zhou')!.health).toBe(7)
    expect(next.players[0].mediationUsed).toBe(false)
    expect(next.players[1].board.find(c => c.instanceId === 'tough')!.health).toBe(5)
    expect(next.players[1].board.find(c => c.instanceId === 'other')!.health).toBe(3)
    expect(next.players.map(p => p.hp)).toEqual([20, 20])
  })
  it('regular combat death does not trigger the countdown explosion', () => {
    const state = fixture()
    state.players[0].board = [unit('lin_biao', 'lin'), unit('ye_qun', 'ye')]
    state.players[0].board[0]!.health = 1
    state.players[1].board = [unit('wu_han', 'b'), unit('chen_yi', 'other')]
    const next = attack(state, 'lin', 'b')
    expect(next.players[0].discard).toContain('lin_biao')
    expect(next.players[0].board[0]!.health).toBe(4)
    expect(next.players[1].board[0]!.health).toBe(5)
  })
  it('the end-turn blast can schedule an enemy Deng return immediately on the incoming turn', () => {
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

describe('江青四人帮集结', () => {
  const members = ['jiang_qing', 'zhang_chunqiao', 'yao_wenyuan', 'wang_hongwen']
  it.each(members)('triggers when %s is the final member to enter', last => {
    const state = fixture([last])
    state.players[0].board = members.filter(id => id !== last).map(id => unit(id))
    const targetId = last === 'zhang_chunqiao' ? state.players[0].board[0]!.instanceId : undefined
    const next = act(state, { type: 'PLAY_CARD', player: 0, cardId: last, targetId })
    expect(next.players[1].hp).toBe(14)
    expect(next.jiangTriggered).toBe(true)
    expect(next.players[0].board).toHaveLength(4)
    const hongwen = next.players[0].board.find(c => c.definitionId === 'wang_hongwen')!
    expect(effectiveAttack(hongwen, next.players[0].board, definitions)).toBe(7)
  })
  it('requires all four on one side and never combines enemy members', () => {
    const state = fixture(['wang_hongwen'])
    state.players[0].board = [unit('jiang_qing'), unit('zhang_chunqiao')]
    state.players[1].board = [unit('yao_wenyuan')]
    const next = act(state, { type: 'PLAY_CARD', player: 0, cardId: 'wang_hongwen' })
    expect(next.players[1].hp).toBe(20)
    expect(next.jiangTriggered).toBe(false)
  })
  it('bypasses GUARD, does not repeat on later plays/turns, and resets for a new game', () => {
    let state = fixture(['wang_hongwen', 'wu_han'])
    state.players[0].board = members.slice(0, 3).map(id => unit(id))
    state.players[1].board = [unit('hua_guofeng')]
    state = act(state, { type: 'PLAY_CARD', player: 0, cardId: 'wang_hongwen' })
    state = act(state, { type: 'PLAY_CARD', player: 0, cardId: 'wu_han' })
    state = end(state)
    state = end(state)
    expect(state.players[1].hp).toBe(14)
    expect(state.log.filter(line => line.startsWith('四人帮集结'))).toHaveLength(1)
    expect(fixture().jiangTriggered).toBe(false)
  })
  it('ends the game immediately when the 6 damage reaches zero', () => {
    const state = fixture(['wang_hongwen'])
    state.players[0].board = members.slice(0, 3).map(id => unit(id))
    state.players[1].hp = 6
    const next = act(state, { type: 'PLAY_CARD', player: 0, cardId: 'wang_hongwen' })
    expect(next.winner).toBe(0)
    expect(next.players[1].hp).toBe(0)
    expect(applyAction(next, { type: 'END_TURN', player: 0 }, definitions).error).not.toBeNull()
  })
})
