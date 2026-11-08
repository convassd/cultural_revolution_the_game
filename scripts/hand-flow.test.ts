import { describe, expect, it } from 'vitest'
import { characters, definitions } from '../src/data'
import { createCharacter } from '../src/game/effects'
import { applyAction, createGame } from '../src/game/engine'
import { chooseSpenderAction, handChoices, productiveCard } from './hand-flow'
import { emptyHandProbe } from './flow-simulation'

function fixture(hand: string[], mana = 3) {
  const state = createGame(characters, () => .5, { energyPerTurn: mana, drawPerTurn: 2 })
  state.players[0].hand = hand; state.players[0].mana = mana
  return state
}

describe('hand-flow diagnostics', () => {
  it('does not count selling the only unaffordable card as productive recovery', () => {
    const state = fixture(['mao_zedong'])
    expect(handChoices(state, definitions)).toMatchObject({ hand: 1, direct: 0, funded: 0, nonfull: true })
    expect(chooseSpenderAction(state, definitions)).toEqual({ type: 'END_TURN', player: 0 })
  })
  it('counts distinct playable cards, not permutations of sale order', () => {
    const state = fixture(['mao_zedong', 'zhou_enlai'])
    const before = structuredClone(state)
    expect(handChoices(state, definitions)).toMatchObject({ hand: 2, direct: 0, funded: 2 })
    expect(state).toEqual(before)
    state.players[0].hand.push('wu_han')
    expect(handChoices(state, definitions)).toMatchObject({ direct: 1, funded: 3 })
  })
  it('excludes full boards and ineffective event dumps from productive choices', () => {
    const state = fixture(['wu_han', 'purge_may_16'])
    expect(productiveCard(state, 'purge_may_16', definitions)).toBe(false)
    state.players[0].board = Array.from({length:5},(_,i) => createCharacter(definitions.wu_han!,String(i)))
    expect(handChoices(state, definitions)).toMatchObject({ nonfull: false, direct: 0, funded: 0 })
  })
  it('recognizes a current aura change or an entry heal without changing the input', () => {
    const state = fixture(['may_16_notice', 'comprehensive_rectification'])
    state.players[0].board = [createCharacter(definitions.nie_yuanzi!, 'rebel')]
    state.players[0].board[0]!.health = 1
    const before = structuredClone(state)
    expect(productiveCard(state, 'may_16_notice', definitions)).toBe(true)
    expect(productiveCard(state, 'comprehensive_rectification', definitions)).toBe(true)
    expect(state).toEqual(before)
  })
  it('the consumption policy sells only to enable a play, then can finish a charge lethal', () => {
    let state = fixture(['mao_zedong', 'wang_hongwen'], 1)
    state.players[1].hp = 5
    const actions = []
    for (let i = 0; i < 4 && state.winner === null; i++) {
      const action = chooseSpenderAction(state, definitions)!
      actions.push(action.type)
      const next = applyAction(state, action, definitions)
      expect(next.error).toBeNull(); state = next.state
    }
    expect(actions).toEqual(['SELL_CARD', 'PLAY_CARD', 'ATTACK'])
    expect(state.winner).toBe(0)
  })
  it('empty-hand probes retain matched draws and ignore the opening-only bonus at turn five', () => {
    const base = { energyPerTurn: 5, drawPerTurn: 2 }
    const first = emptyHandProbe(100, 8, { ...base, secondPlayerOpeningBonus: 0 })
    const second = emptyHandProbe(100, 8, { ...base, secondPlayerOpeningBonus: 9 })
    expect(second).toEqual(first)
    expect(first.samples).toHaveLength(16)
    expect(first.samples.every(s => s.hand === 2)).toBe(true)
  })
})
