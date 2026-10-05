import { describe, expect, it } from 'vitest'
import { characters, definitions } from '../data'
import { createCharacter } from './effects'
import { applyAction, createGame } from './engine'
import { chooseGreedyAction, chooseRandomAction, legalTurnActions, scoreAction } from './ai'
import type { GameState } from './types'

function fixture(): GameState {
  const state = createGame(characters, () => 0.5)
  state.players[0].mana = 4
  state.players[0].hand = ['wu_han', 'zhang_chunqiao', 'yao_wenyuan', 'mao_zedong']
  state.players[0].board = [createCharacter(definitions.wang_li!, 'ready'), createCharacter(definitions.wu_han!, 'resting')]
  state.players[0].board[0]!.canAttack = true
  state.players[1].board = [createCharacter(definitions.wu_han!, 'enemy-a'), createCharacter(definitions.kuai_dafu!, 'enemy-b')]
  return state
}

describe('random AI legal moves', () => {
  it('enumerates each affordable play/target, each ready attack/target, and end turn exactly once', () => {
    const state = fixture()
    const before = structuredClone(state)
    const actions = legalTurnActions(state, definitions)
    expect(actions).toHaveLength(9)
    expect(new Set(actions.map(action => JSON.stringify(action))).size).toBe(9)
    expect(actions.filter(a => a.type === 'PLAY_CARD')).toHaveLength(5)
    expect(actions.filter(a => a.type === 'ATTACK')).toHaveLength(3)
    expect(actions.at(-1)).toEqual({ type: 'END_TURN', player: 0 })
    for (const action of actions) expect(applyAction(state, action, definitions).error).toBeNull()
    expect(state).toEqual(before)
  })

  it('respects full board, mana, summoning sickness and GUARD while still allowing any character target', () => {
    const state = fixture()
    state.players[0].board.push(...['lin_liguo', 'ye_qun', 'wu_de'].map(id => createCharacter(definitions[id]!, id)))
    state.players[1].board.push(createCharacter(definitions.hua_guofeng!, 'guard'))
    const actions = legalTurnActions(state, definitions)
    expect(actions.filter(a => a.type === 'PLAY_CARD')).toEqual([])
    expect(actions.filter(a => a.type === 'ATTACK')).toHaveLength(3)
    expect(actions.some(a => a.type === 'ATTACK' && a.target.type === 'player')).toBe(false)
    expect(actions.some(a => a.type === 'ATTACK' && a.attackerId !== 'ready')).toBe(false)
    for (const action of actions) expect(applyAction(state, action, definitions).error).toBeNull()
  })

  it('allows no-target battlecries to skip their effect and charge to attack immediately', () => {
    const state = fixture()
    state.players[0].board = []
    state.players[1].board = []
    state.players[0].hand = ['zhang_chunqiao', 'yao_wenyuan', 'nie_yuanzi']
    const actions = legalTurnActions(state, definitions)
    expect(actions.filter(a => a.type === 'PLAY_CARD')).toHaveLength(3)
    for (const action of actions) expect(applyAction(state, action, definitions).error).toBeNull()
    const charged = applyAction(state, { type: 'PLAY_CARD', player: 0, cardId: 'nie_yuanzi' }, definitions).state
    expect(legalTurnActions(charged, definitions).some(a => a.type === 'ATTACK' && a.target.type === 'player')).toBe(true)
  })

  it('gives each concrete action the same random interval, including early end turn', () => {
    const state = fixture()
    const actions = legalTurnActions(state, definitions)
    actions.forEach((action, index) => {
      expect(chooseRandomAction(state, definitions, () => (index + 0.5) / actions.length)).toEqual(action)
    })
    expect(chooseRandomAction(state, definitions, () => 0)).toEqual(actions[0])
    expect(chooseRandomAction(state, definitions, () => 0.999999)).toEqual({ type: 'END_TURN', player: 0 })
  })

  it('only acts for the current player after a turn switch', () => {
    const state = createGame(characters, () => 0.5)
    state.players[0].hand = ['wu_han']
    const played = applyAction(state, { type: 'PLAY_CARD', player: 0, cardId: 'wu_han' }, definitions).state
    const next = applyAction(played, { type: 'END_TURN', player: 0 }, definitions).state
    expect(legalTurnActions(next, definitions).every(a => a.player === 1)).toBe(true)
  })
  it('only offers entry targets while a played card awaits its target', () => {
    const state = applyAction(fixture(), { type: 'PLAY_CARD', player: 0, cardId: 'zhang_chunqiao' }, definitions).state
    expect(legalTurnActions(state, definitions)).toEqual([
      { type: 'SELECT_PLAY_TARGET', player: 0, targetId: 'ready' },
      { type: 'SELECT_PLAY_TARGET', player: 0, targetId: 'resting' },
    ])
    const action = chooseGreedyAction(state, definitions)!
    const result = applyAction(state, action, definitions)
    expect(result.error).toBeNull()
    expect(result.state.pendingPlayTarget).toBeNull()
  })

  it('returns no move once the game ends, without consulting random', () => {
    const state = fixture()
    state.winner = 0
    expect(legalTurnActions(state, definitions)).toEqual([])
    expect(chooseRandomAction(state, definitions, () => { throw new Error('unexpected random'); })).toBeNull()
  })
})

describe('one-step greedy decisions', () => {
  function combat(ownId: string, enemyId: string) {
    const state = createGame(characters, () => 0.5)
    state.players[0].hand = []
    state.players[0].mana = 0
    state.players[0].board = [createCharacter(definitions[ownId]!, 'attacker')]
    state.players[0].board[0]!.canAttack = true
    state.players[1].board = [createCharacter(definitions[enemyId]!, 'defender')]
    return state
  }

  it('takes an immediate win instead of killing an enemy character', () => {
    const state = combat('zhu_de', 'nie_yuanzi')
    state.players[1].hp = 5
    expect(chooseGreedyAction(state, definitions)).toMatchObject({ type: 'ATTACK', target: { type: 'player' } })
  })

  it('trades to remove visible lethal pressure instead of blindly hitting face', () => {
    const state = combat('zhou_enlai', 'nie_yuanzi')
    state.players[0].hp = 3
    for (const player of state.players) { player.deck = []; player.hand = [] }
    const trade = chooseGreedyAction(state, definitions)!
    expect(trade).toMatchObject({ type: 'ATTACK', target: { type: 'character', instanceId: 'defender' } })
    const saved = applyAction(state, trade, definitions).state
    expect(saved.players[0].hp).toBe(3)
    expect(saved.players[0].board[0]!.health).toBe(6)
    expect(saved.players[1].board).toEqual([])
    const face = applyAction(state, { type: 'ATTACK', player: 0, attackerId: 'attacker', target: { type: 'player' } }, definitions).state
    const nextTurn = applyAction(face, { type: 'END_TURN', player: 0 }, definitions).state
    const lost = applyAction(nextTurn, chooseGreedyAction(nextTurn, definitions)!, definitions).state
    expect(lost.winner).toBe(1)
  })

  it('keeps a lethal sequence available when two ready attackers can win this turn', () => {
    const state = combat('wu_han', 'nie_yuanzi')
    const second = createCharacter(definitions.kuai_dafu!, 'second')
    second.canAttack = true
    state.players[0].board.push(second)
    state.players[0].hp = 1
    state.players[1].hp = 5
    const first = chooseGreedyAction(state, definitions)!
    expect(first).toMatchObject({ type: 'ATTACK', target: { type: 'player' } })
    const after = applyAction(state, first, definitions).state
    expect(chooseGreedyAction(after, definitions)).toMatchObject({ type: 'ATTACK', target: { type: 'player' } })
  })

  it('deploys affordable cards rather than randomly passing, and obeys GUARD', () => {
    const state = combat('zhu_de', 'hua_guofeng')
    expect(chooseGreedyAction(state, definitions)).not.toMatchObject({ type: 'ATTACK', target: { type: 'player' } })
    state.players[0].board = []
    state.players[0].hand = ['wu_han']
    state.players[0].mana = 2
    expect(chooseGreedyAction(state, definitions)).toMatchObject({ type: 'PLAY_CARD', cardId: 'wu_han' })
  })

  it('selects the larger useful friendly target for BUFF_ONE', () => {
    const state = combat('zhu_de', 'wu_han')
    state.players[0].board[0]!.canAttack = false
    const ready = createCharacter(definitions.kuai_dafu!, 'ready')
    ready.canAttack = true
    state.players[0].board.push(ready)
    state.players[0].hand = ['zhang_chunqiao']
    state.players[0].mana = 4
    const resting = scoreAction(state, { type: 'PLAY_CARD', player: 0, cardId: 'zhang_chunqiao', targetId: 'attacker' }, definitions)
    const attacking = scoreAction(state, { type: 'PLAY_CARD', player: 0, cardId: 'zhang_chunqiao', targetId: 'ready' }, definitions)
    expect(attacking).toBeGreaterThan(resting)
  })

  it('does not mutate state, consult live RNG, or change decisions with hidden cards', () => {
    const state = fixture()
    state.players[0].hand = ['chen_boda', 'wu_han']
    state.players[0].deck = ['mao_zedong', 'zhou_enlai']
    const original = structuredClone(state)
    const first = chooseGreedyAction(state, definitions)
    expect(state).toEqual(original)
    const hidden = structuredClone(state)
    hidden.players[0].deck = ['kuai_dafu', 'wang_hongwen']
    hidden.players[1].deck.reverse()
    hidden.players[1].hand = hidden.players[1].hand.map(() => 'mao_zedong')
    expect(chooseGreedyAction(hidden, definitions)).toEqual(first)
    for (const action of legalTurnActions(state, definitions)) {
      expect(scoreAction(hidden, action, definitions)).toBe(scoreAction(state, action, definitions))
    }
  })

  it('averages Mao dice as one uncertain action, without depending on the actual next roll', () => {
    const state = combat('wu_han', 'mao_zedong')
    const end = { type: 'END_TURN', player: 0 } as const
    const first = scoreAction(state, end, definitions)
    state.players[1].board[0]!.commandRoll = 6
    expect(scoreAction(state, end, definitions)).toBe(first)
  })

  it('returns null after victory and produces only engine-accepted actions', () => {
    const state = fixture()
    expect(applyAction(state, chooseGreedyAction(state, definitions)!, definitions).error).toBeNull()
    state.winner = 1
    expect(chooseGreedyAction(state, definitions)).toBeNull()
  })
})

it.each(Array.from({ length: 10 }, (_, i) => ['random', 'greedy'].map(policy => ({ seed: i + 1, policy }))).flat())('$policy opponents finish seed $seed using only legal moves and preserve all 48 cards', ({ seed, policy }) => {
  let value = seed
  const random = () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296)
  let state = createGame(characters, random)
  for (let step = 0; step < 3000 && state.winner === null; step++) {
    const action = (policy === 'greedy' ? chooseGreedyAction(state, definitions) : chooseRandomAction(state, definitions, random))!
    const result = applyAction(state, action, definitions, random)
    expect(result.error, JSON.stringify(action)).toBeNull()
    state = result.state
    const ids = state.players.flatMap(player => [...player.deck, ...player.hand, ...player.discard,
      ...player.board.map(c => c.definitionId), ...player.pendingReturns.map(c => c.definitionId)])
    expect(ids).toHaveLength(48)
    expect(new Set(ids).size).toBe(48)
    for (const player of state.players) {
      expect(player.board.length).toBeLessThanOrEqual(5)
      expect(player.mana).toBeGreaterThanOrEqual(0)
      expect(player.mana).toBeLessThanOrEqual(player.maxMana)
      expect(player.board.every(c => c.health > 0)).toBe(true)
    }
  }
  expect(state.winner).not.toBeNull()
})
