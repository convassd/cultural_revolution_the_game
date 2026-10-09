import { describe, expect, it } from 'vitest'
import { characters, definitions } from '../data'
import { isAbilityImplemented } from '../data/abilities'
import { resolveCombat } from './combat'
import { applyAction, createGame } from './engine'
import { canAttackPlayer, effectiveAttack, GROUP_NAMES, playTargets } from './rules'
import type { CharacterInstance, GameAction, GameState, PlayerId } from './types'

function instance(id: string, instanceId = id): CharacterInstance {
  return { definitionId: id, instanceId, health: definitions[id]!.health,
    canAttack: true, temporaryAttack: 0, toughUsed: false }
}
function fixture(cardIds: string[] = []): GameState {
  const state = createGame(characters, () => 0.5)
  state.players[0].hand = cardIds
  state.players[0].mana = 10
  state.players[0].maxMana = 10
  return state
}
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action, definitions, () => 0.5)
  expect(result.error).toBeNull()
  return result.state
}
function play(state: GameState, cardId: string, targetId?: string): GameState {
  return act(state, { type: 'PLAY_CARD', player: 0, cardId, targetId })
}

describe('SR battlecries', () => {
  it('DRAW_ONE pays cost and draws one card without changing the input', () => {
    const state = fixture(['chen_boda'])
    state.players[0].deck = ['wu_han', 'kuai_dafu']
    const before = structuredClone(state)
    const next = play(state, 'chen_boda')
    expect(state).toEqual(before)
    expect(next.players[0].mana).toBe(6)
    expect(next.players[0].hand).toEqual(['wu_han'])
    expect(next.players[0].deck).toEqual(['kuai_dafu'])
  })
  it('DRAW_ONE still enters successfully with an empty deck', () => {
    const state = fixture(['qi_benyu'])
    state.players[0].deck = []
    const next = play(state, 'qi_benyu')
    expect(next.players[0].hand).toEqual([])
    expect(next.players[0].board).toHaveLength(1)
    expect(next.log.at(-1)).toContain('牌库已空')
  })
  it('DRAW_ONE still draws at five remaining cards; six cards are retained without a next-turn refill', () => {
    const state = fixture(['chen_boda', 'mao_zedong', 'zhou_enlai', 'zhu_de', 'lin_biao', 'jiang_qing'])
    state.players[0].deck = ['wu_han', 'lin_liguo']
    let next = play(state, 'chen_boda')
    expect(next.players[0].hand).toEqual(['mao_zedong', 'zhou_enlai', 'zhu_de', 'lin_biao', 'jiang_qing', 'wu_han'])
    expect(next.players[0].deck).toEqual(['lin_liguo'])
    next = act(next, { type: 'END_TURN', player: 0 })
    next = act(next, { type: 'END_TURN', player: 1 })
    expect(next.players[0].hand).toHaveLength(6)
    expect(next.players[0].deck).toEqual(['lin_liguo'])
  })
  it('GROUP_DRAW ignores itself, enemy members and unrelated friendly characters', () => {
    const state = fixture(['ye_qun'])
    state.players[0].deck = ['wu_han']
    state.players[0].board = [instance('jiang_qing')]
    state.players[1].board = [instance('lin_liguo')]
    const next = play(state, 'ye_qun')
    expect(next.players[0].hand).toEqual([])
    expect(next.players[0].deck).toEqual(['wu_han'])
  })
  it('GROUP_DRAW draws with an existing friendly member and aura includes the new member', () => {
    const state = fixture(['ye_qun'])
    state.players[0].deck = ['wu_han']
    state.players[0].board = [instance('lin_liguo')]
    const next = play(state, 'ye_qun')
    expect(next.players[0].hand).toEqual(['wu_han'])
    expect(effectiveAttack(next.players[0].board[1]!, next.players[0].board, definitions)).toBe(3)
  })
  it('BUFF_ONE can target a resting friendly character and expires before the enemy turn', () => {
    const state = fixture(['zhang_chunqiao'])
    const target = instance('wu_han', 'a')
    target.canAttack = false
    state.players[0].board = [target]
    let next = play(state, 'zhang_chunqiao', 'a')
    expect(effectiveAttack(next.players[0].board[0]!, next.players[0].board, definitions)).toBe(3)
    expect(definitions.wu_han!.attack).toBe(2)
    expect(next.players[0].board[0]!.canAttack).toBe(false)
    next = act(next, { type: 'END_TURN', player: 0 })
    expect(effectiveAttack(next.players[0].board[0]!, next.players[0].board, definitions)).toBe(2)
  })
  it('targeted battlecries reject wrong-side/stale/self targets atomically', () => {
    const state = fixture(['zhang_chunqiao', 'yao_wenyuan'])
    state.players[0].board = [instance('wu_han', 'a')]
    state.players[1].board = [instance('lin_liguo', 'b')]
    const before = structuredClone(state)
    const attempts: Array<[string, string | undefined]> = [
      ['zhang_chunqiao', 'b'],
      ['zhang_chunqiao', 'missing'], ['zhang_chunqiao', `character-${state.nextInstanceId}`],
      ['yao_wenyuan', 'a'], ['yao_wenyuan', 'missing'],
    ]
    for (const [cardId, targetId] of attempts) {
      const result = applyAction(state, { type: 'PLAY_CARD', player: 0, cardId, targetId }, definitions)
      expect(result.error).not.toBeNull()
      expect(result.state).toBe(state)
    }
    expect(state).toEqual(before)
  })
  it.each([
    ['zhang_chunqiao', 0, 1], ['yao_wenyuan', 1, -1],
  ] as const)('%s commits before target selection and resolves exactly once', (cardId, owner, change) => {
    const state = fixture([cardId, 'wu_han'])
    state.players[0].board = [instance('wu_han', 'friendly')]
    state.players[1].board = [instance('lin_liguo', 'enemy')]
    const targetId = owner === 0 ? 'friendly' : 'enemy'
    const before = structuredClone(state)
    const committed = play(state, cardId)
    expect(state).toEqual(before)
    expect(committed.players[0].hand).toEqual(['wu_han'])
    expect(committed.players[0].mana).toBe(10 - definitions[cardId]!.cost)
    expect(committed.players[0].board.at(-1)?.definitionId).toBe(cardId)
    expect(committed.players[0].board.at(-1)?.canAttack).toBe(false)
    expect(committed.pendingPlayTarget?.targetIds).toEqual([targetId])
    expect(committed.players[owner].board[0]!.temporaryAttack).toBe(0)

    const blocked: GameAction[] = [
      { type: 'END_TURN', player: 0 },
      { type: 'PLAY_CARD', player: 0, cardId: 'wu_han' },
      { type: 'ATTACK', player: 0, attackerId: 'friendly', target: { type: 'player' } },
      { type: 'SELECT_PLAY_TARGET', player: 1, targetId },
      { type: 'SELECT_PLAY_TARGET', player: 0, targetId: owner === 0 ? 'enemy' : 'friendly' },
      { type: 'SELECT_PLAY_TARGET', player: 0, targetId: committed.players[0].board.at(-1)!.instanceId },
      { type: 'SELECT_PLAY_TARGET', player: 0, targetId: 'missing' },
    ]
    for (const action of blocked) {
      const result = applyAction(committed, action, definitions)
      expect(result.error).not.toBeNull()
      expect(result.state).toBe(committed)
    }
    const selection: GameAction = { type: 'SELECT_PLAY_TARGET', player: 0, targetId }
    const resolved = act(committed, selection)
    expect(resolved.pendingPlayTarget).toBeNull()
    expect(effectiveAttack(resolved.players[owner].board[0]!, resolved.players[owner].board, definitions)).toBe(definitions[resolved.players[owner].board[0]!.definitionId]!.attack + change)
    expect(resolved).toEqual(play(state, cardId, targetId))
    expect(applyAction(resolved, selection, definitions).error).not.toBeNull()
  })
  it('finishes the entry target with full-group aura but no removed face-damage trigger', () => {
    const state = fixture(['zhang_chunqiao'])
    state.players[0].board = ['jiang_qing', 'yao_wenyuan', 'wang_hongwen'].map(id => instance(id))
    state.players[1].hp = 6
    const committed = play(state, 'zhang_chunqiao')
    expect(committed.winner).toBeNull()
    const resolved = applyAction(committed, { type: 'SELECT_PLAY_TARGET', player: 0, targetId: 'jiang_qing' }, definitions)
    expect(resolved.error).toBeNull()
    expect(resolved.state.winner).toBeNull()
    expect(resolved.state.players[1].hp).toBe(6)
    expect(resolved.state.pendingPlayTarget).toBeNull()
    expect(resolved.state).toEqual(play(state, 'zhang_chunqiao', 'jiang_qing'))
    expect(resolved.events).toEqual([])
  })
  it('targeted battlecries play normally and skip if their target side is empty', () => {
    for (const cardId of ['zhang_chunqiao', 'yao_wenyuan']) {
      const next = play(fixture([cardId]), cardId)
      expect(next.players[0].board).toHaveLength(1)
      expect(next.players[0].board[0]!.temporaryAttack).toBe(0)
      expect(next.pendingPlayTarget).toBeNull()
      expect(next.log.at(-1)).toContain('跳过')
    }
  })
  it('WEAKEN lowers retaliation and remains through the enemy turn', () => {
    const state = fixture(['yao_wenyuan'])
    state.players[0].board = [instance('wu_han', 'a')]
    state.players[1].board = [instance('wu_han', 'b')]
    let next = play(state, 'yao_wenyuan', 'b')
    expect(effectiveAttack(next.players[1].board[0]!, next.players[1].board, definitions)).toBe(1)
    next = act(next, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(next.players[0].board[0]!.health).toBe(2)
    expect(next.players[1].board[0]!.health).toBe(1)
    next = act(next, { type: 'END_TURN', player: 0 })
    expect(effectiveAttack(next.players[1].board[0]!, next.players[1].board, definitions)).toBe(1)
    next = act(next, { type: 'END_TURN', player: 1 })
    expect(effectiveAttack(next.players[1].board[0]!, next.players[1].board, definitions)).toBe(2)
  })
  it('temporary penalties stack, floor displayed attack at zero, and expire together', () => {
    let state = fixture(['yao_wenyuan', 'guan_feng'])
    const target = instance('lin_liguo', 'b')
    target.temporaryAttack = -1
    state.players[1].board = [target]
    state = play(state, 'yao_wenyuan', 'b')
    state = play(state, 'guan_feng', 'b')
    expect(state.players[1].board[0]!.temporaryAttack).toBe(-1)
    expect(state.players[1].board[0]!.attackModifiers).toEqual([{ amount: -1, expiresAtTurn: 3 }, { amount: -1, expiresAtTurn: 3 }])
    expect(effectiveAttack(state.players[1].board[0]!, state.players[1].board, definitions)).toBe(0)
    state = act(state, { type: 'END_TURN', player: 0 })
    expect(effectiveAttack(state.players[1].board[0]!, state.players[1].board, definitions)).toBe(0)
    state = act(state, { type: 'END_TURN', player: 1 })
    expect(effectiveAttack(state.players[1].board[0]!, state.players[1].board, definitions)).toBe(2)
  })
  it('REVEAL_HAND records only a snapshot for the caster and clears on handoff', () => {
    const state = fixture(['kang_sheng'])
    state.players[1].hand = ['mao_zedong', 'lin_biao']
    let next = play(state, 'kang_sheng')
    expect(next.revealedHand).toEqual({ viewer: 0, owner: 1, cards: ['mao_zedong', 'lin_biao'] })
    next.players[1].hand.push('wu_han')
    expect(next.revealedHand!.cards).toHaveLength(2)
    next = act(next, { type: 'END_TURN', player: 0 })
    expect(next.revealedHand).toBeNull()
  })
  it('REVEAL_HAND handles an empty hand', () => {
    const state = fixture(['kang_sheng'])
    state.players[1].hand = []
    expect(play(state, 'kang_sheng').revealedHand?.cards).toEqual([])
  })
})

describe('charge, guard and tough', () => {
  it('CHARGE attacks on entry but still only once per turn', () => {
    let state = play(fixture(['nie_yuanzi']), 'nie_yuanzi')
    const attacker = state.players[0].board[0]!
    expect(attacker.canAttack).toBe(true)
    const attack: GameAction = { type: 'ATTACK', player: 0, attackerId: attacker.instanceId, target: { type: 'player' } }
    state = act(state, attack)
    expect(state.players[1].hp).toBe(17)
    expect(applyAction(state, attack, definitions).error).not.toBeNull()
  })
  it('GUARD blocks face attacks without using the attack, but allows any enemy character target', () => {
    const state = fixture()
    state.players[0].board = [instance('zhu_de', 'a')]
    state.players[1].board = [instance('hua_guofeng', 'guard'), instance('wu_han', 'other')]
    const denied = applyAction(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'player' } }, definitions)
    expect(denied.error).toContain('保卫')
    expect(denied.state).toBe(state)
    expect(state.players[0].board[0]!.canAttack).toBe(true)
    const next = act(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'other' } })
    expect(next.players[1].discard).toContain('wu_han')
    expect(canAttackPlayer(next.players[1], definitions)).toBe(false)
  })
  it('killing the last GUARD immediately opens the player as a target', () => {
    let state = fixture()
    state.players[0].board = [instance('zhu_de', 'a'), instance('wu_han', 'c')]
    state.players[1].board = [instance('hua_guofeng', 'b')]
    state.players[1].board[0]!.health = 1
    state = act(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(canAttackPlayer(state.players[1], definitions)).toBe(true)
    state = act(state, { type: 'ATTACK', player: 0, attackerId: 'c', target: { type: 'player' } })
    expect(state.players[1].hp).toBe(18)
  })
  it('another surviving GUARD keeps face attacks blocked', () => {
    let state = fixture()
    state.players[0].board = [instance('zhu_de', 'a')]
    state.players[1].board = [instance('hua_guofeng', 'b'), instance('xie_fuzhi', 'c')]
    state.players[1].board[0]!.health = 1
    state = act(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(canAttackPlayer(state.players[1], definitions)).toBe(false)
  })
  it('TOUGH reduces only the first hit each global turn and resets on either player turn', () => {
    let state = fixture()
    state.players[0].board = [instance('wu_han', 'a'), instance('lin_liguo', 'c')]
    state.players[1].board = [instance('ye_jianying', 'b')]
    state = act(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(state.players[1].board[0]!.health).toBe(5)
    expect(state.players[1].board[0]!.toughUsed).toBe(true)
    state = act(state, { type: 'ATTACK', player: 0, attackerId: 'c', target: { type: 'character', instanceId: 'b' } })
    expect(state.players[1].board[0]!.health).toBe(3)
    state = act(state, { type: 'END_TURN', player: 0 })
    expect(state.players[1].board[0]!.toughUsed).toBe(false)
    state.players[1].board[0]!.toughUsed = true
    state = act(state, { type: 'END_TURN', player: 1 })
    expect(state.players[1].board[0]!.toughUsed).toBe(false)
  })
  it('TOUGH applies to retaliation and faction damage on both sides simultaneously', () => {
    const state = fixture()
    state.players[0].board = [instance('liu_shaoqi', 'a')]
    state.players[1].board = [instance('ye_jianying', 'b')]
    const next = act(state, { type: 'ATTACK', player: 0, attackerId: 'a', target: { type: 'character', instanceId: 'b' } })
    expect(next.players[0].board[0]).toMatchObject({ health: 4, toughUsed: true })
    expect(next.players[1].board[0]).toMatchObject({ health: 2, toughUsed: true })
  })
  it('zero damage does not spend TOUGH, while 1 damage prevented to 0 does', () => {
    const defender = { attack: 2, health: 3, faction: '无派别' as const, toughReady: true }
    expect(resolveCombat({ attack: 0, health: 3, faction: '无派别' }, defender))
      .toMatchObject({ toDefender: 0, defenderToughTriggered: false })
    expect(resolveCombat({ attack: 1, health: 3, faction: '无派别' }, defender))
      .toMatchObject({ toDefender: 0, defenderToughTriggered: true })
  })
})

describe('renames and skill status', () => {
  it('uses full faction names and 四人帮 in data and rules', () => {
    const allowed = new Set(['造反派', '保守派', '军队', '无派别'])
    for (const card of characters) expect(allowed.has(card.faction)).toBe(true)
    expect(GROUP_NAMES.gang_of_four).toBe('四人帮')
  })
  it('marks all SR and SSR abilities implemented', () => {
    for (const card of characters) {
      if (card.abilityId) expect(isAbilityImplemented(card.abilityId)).toBe(true)
    }
  })
  it('gives legal targets only on the appropriate side, before the card enters', () => {
    const state = fixture()
    state.players[0].board = [instance('wu_han', 'a')]
    state.players[1].board = [instance('lin_liguo', 'b')]
    expect(playTargets(definitions.zhang_chunqiao!, state.players[0], state.players[1])).toEqual(['a'])
    expect(playTargets(definitions.yao_wenyuan!, state.players[0], state.players[1])).toEqual(['b'])
    expect(playTargets(definitions.chen_boda!, state.players[0], state.players[1])).toEqual([])
  })
})

describe('turn-relative attack durations', () => {
  it.each([0, 1] as const)('gives caster seat %s the same retaliation reduction and one full enemy action turn', caster => {
    const enemy: PlayerId = caster === 0 ? 1 : 0
    let state = fixture()
    state.currentPlayer = caster
    state.turn = caster + 1
    state.players[caster].mana = 10
    state.players[caster].hand = ['yao_wenyuan']
    state.players[caster].board = [instance('wu_han', 'ally')]
    state.players[enemy].board = [instance('wu_han', 'target')]
    const original = structuredClone(state)
    state = act(state, { type: 'PLAY_CARD', player: caster, cardId: 'yao_wenyuan', targetId: 'target' })
    expect(original.players[enemy].board[0]!.attackModifiers).toBeUndefined()
    expect(state.players[enemy].board[0]!.attackModifiers).toEqual([{ amount: -1, expiresAtTurn: caster + 3 }])
    state = act(state, { type: 'ATTACK', player: caster, attackerId: 'ally', target: { type: 'character', instanceId: 'target' } })
    expect(state.players[caster].board[0]!.health).toBe(2)
    state = act(state, { type: 'END_TURN', player: caster })
    expect(state.currentPlayer).toBe(enemy)
    expect(effectiveAttack(state.players[enemy].board[0]!, state.players[enemy].board, definitions)).toBe(1)
    state = act(state, { type: 'ATTACK', player: enemy, attackerId: 'target', target: { type: 'player' } })
    expect(state.players[caster].hp).toBe(19)
    state = act(state, { type: 'END_TURN', player: enemy })
    expect(state.currentPlayer).toBe(caster)
    expect(effectiveAttack(state.players[enemy].board[0]!, state.players[enemy].board, definitions)).toBe(2)
    expect(state.players[enemy].board[0]!.attackModifiers).toEqual([])
  })
  it.each([0, 1] as const)('keeps short buffs separate from seat %s lasting debuffs', caster => {
    const enemy: PlayerId = caster === 0 ? 1 : 0
    let state = fixture()
    state.currentPlayer = caster
    state.turn = caster + 1
    state.players[caster].mana = 10
    state.players[caster].hand = ['yao_wenyuan', 'guan_feng']
    state.players[enemy].board = [instance('wu_han', 'target')]
    for (const cardId of ['yao_wenyuan', 'guan_feng']) state = act(state, { type: 'PLAY_CARD', player: caster, cardId, targetId: 'target' })
    state = act(state, { type: 'END_TURN', player: caster })
    state.players[enemy].mana = 10
    state.players[enemy].hand = ['zhang_chunqiao']
    state = act(state, { type: 'PLAY_CARD', player: enemy, cardId: 'zhang_chunqiao', targetId: 'target' })
    expect(effectiveAttack(state.players[enemy].board[0]!, state.players[enemy].board, definitions)).toBe(1)
    state = act(state, { type: 'ATTACK', player: enemy, attackerId: 'target', target: { type: 'player' } })
    expect(state.players[caster].hp).toBe(19)
    state = act(state, { type: 'END_TURN', player: enemy })
    expect(effectiveAttack(state.players[enemy].board[0]!, state.players[enemy].board, definitions)).toBe(2)
    expect(state.players[enemy].board[0]!.temporaryAttack).toBe(0)
    state.players[caster].hand = ['guan_feng']
    state.players[caster].mana = 10
    state = act(state, { type: 'PLAY_CARD', player: caster, cardId: 'guan_feng', targetId: 'target' })
    expect(effectiveAttack(state.players[enemy].board[0]!, state.players[enemy].board, definitions)).toBe(1)
  })
  it('keeps the debuff after its source leaves play', () => {
    let state = fixture(['yao_wenyuan'])
    state.players[1].board = [instance('wu_han', 'target'), instance('zhu_de', 'killer')]
    state = play(state, 'yao_wenyuan', 'target')
    const source = state.players[0].board[0]!.instanceId
    state = act(state, { type: 'END_TURN', player: 0 })
    state = act(state, { type: 'ATTACK', player: 1, attackerId: 'killer', target: { type: 'character', instanceId: source } })
    expect(state.players[0].board).toHaveLength(0)
    expect(effectiveAttack(state.players[1].board[0]!, state.players[1].board, definitions)).toBe(1)
    state = act(state, { type: 'END_TURN', player: 1 })
    expect(effectiveAttack(state.players[1].board[0]!, state.players[1].board, definitions)).toBe(2)
  })
  it('does not carry a debuff across death and Deng return', () => {
    let state = fixture(['yao_wenyuan'])
    state.players[0].board = [instance('wu_han', 'attacker')]
    state.players[1].board = [instance('deng_xiaoping', 'deng')]
    state.players[1].board[0]!.health = 1
    state = play(state, 'yao_wenyuan', 'deng')
    state = act(state, { type: 'ATTACK', player: 0, attackerId: 'attacker', target: { type: 'character', instanceId: 'deng' } })
    expect(state.players[1].pendingReturns[0]!.attackModifiers).toEqual([])
    state = act(state, { type: 'END_TURN', player: 0 })
    const returned = state.players[1].board[0]!
    expect(returned).toMatchObject({ returnCount: 1, canAttack: false })
    expect(effectiveAttack(returned, state.players[1].board, definitions)).toBe(2)
  })
})
