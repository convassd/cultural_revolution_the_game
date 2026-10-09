import { describe, expect, it } from 'vitest'
import { definitions } from '../data'
import { createCharacter } from '../game/effects'
import { presentCharacter, type BoardEffect } from './battle'
import { arrangeBoard, type BoardLayout } from './boardLayout'

const empty: BoardLayout = { slots: [], ghosts: {} }
const unit = (id: string) => createCharacter(definitions.wu_han!, id)
function death(id: number, ids: string[], killed: string[]): BoardEffect {
  return { id, slots: ids.map(instanceId => ({ ...presentCharacter(unit(instanceId), [], definitions), dying: killed.includes(instanceId) })) }
}

describe('visual slots during nonblocking death effects', () => {
  it('keeps surviving cards in place, then compacts when the death effect expires', () => {
    const before = arrangeBoard(['a', 'b', 'c'].map(unit), [], empty)
    const effect = death(1, ['a', 'b', 'c'], ['a'])
    const during = arrangeBoard(['b', 'c'].map(unit), [effect], before)
    expect(during.slots).toEqual([null, 'b', 'c', null, null])
    expect(during.ghosts).toEqual({ '1-a': 0 })
    expect(arrangeBoard(['b', 'c'].map(unit), [], during)).toEqual({ slots: ['b', 'c', null, null, null], ghosts: {} })
    expect(before.slots).toEqual(['a', 'b', 'c', null, null])
  })
  it('uses actual visual positions for a second death instead of the compact engine indices', () => {
    const first = death(1, ['a', 'b', 'c'], ['a'])
    const before = arrangeBoard(['a', 'b', 'c'].map(unit), [], empty)
    const during = arrangeBoard(['b', 'c'].map(unit), [first], before)
    const second = death(2, ['b', 'c'], ['c'])
    const next = arrangeBoard([unit('b')], [first, second], during)
    expect(next.slots).toEqual([null, 'b', null, null, null])
    expect(next.ghosts).toEqual({ '1-a': 0, '2-c': 2 })
    const oneRemaining = arrangeBoard([unit('b')], [second], next)
    expect(oneRemaining.slots[1]).toBe('b')
    expect(oneRemaining.ghosts).toEqual({ '2-c': 2 })
    expect(arrangeBoard([unit('b')], [], oneRemaining).slots[0]).toBe('b')
  })
  it('places incoming cards outside reserved slots without delaying their presence', () => {
    const before = arrangeBoard(['a', 'b'].map(unit), [], empty)
    const effect = death(1, ['a', 'b'], ['a'])
    const during = arrangeBoard(['b'].map(unit), [effect], before)
    const incoming = arrangeBoard(['b', 'charge'].map(unit), [effect], during)
    expect(incoming.slots).toEqual([null, 'b', 'charge', null, null])
    expect(incoming.ghosts['1-a']).toBe(0)
  })
  it('temporarily exposes an extra slot if five live cards coexist with a ghost', () => {
    const before = arrangeBoard(['a', 'b', 'c', 'd', 'e'].map(unit), [], empty)
    const effect = death(1, ['a', 'b', 'c', 'd', 'e'], ['a'])
    const during = arrangeBoard(['b', 'c', 'd', 'e'].map(unit), [effect], before)
    const incoming = arrangeBoard(['b', 'c', 'd', 'e', 'charge'].map(unit), [effect], during)
    expect(incoming.slots).toEqual([null, 'b', 'c', 'd', 'e', 'charge'])
    expect(arrangeBoard(['b', 'c', 'd', 'e', 'charge'].map(unit), [], incoming).slots).toEqual(['b', 'c', 'd', 'e', 'charge'])
  })
  it('keeps a returned instance separate from its still-shattering earlier life', () => {
    const before = arrangeBoard([unit('deng'), unit('b')], [], empty)
    const first = death(1, ['deng', 'b'], ['deng'])
    const during = arrangeBoard([unit('b')], [first], before)
    const returned = arrangeBoard([unit('b'), unit('deng')], [first], during)
    expect(returned.slots).toEqual([null, 'b', 'deng', null, null])
    const second = death(2, ['b', 'deng'], ['deng'])
    const diedAgain = arrangeBoard([unit('b')], [first, second], returned)
    expect(diedAgain.ghosts).toEqual({ '1-deng': 0, '2-deng': 2 })
  })
  it('does not delay compaction for damage-only effects still playing', () => {
    const before = arrangeBoard(['a', 'b'].map(unit), [], empty)
    const died = death(1, ['a', 'b'], ['a'])
    const during = arrangeBoard([unit('b')], [died], before)
    const damage = death(2, ['b'], [])
    damage.slots[0]!.damage = 1
    expect(arrangeBoard([unit('b')], [damage], during).slots).toEqual(['b', null, null, null, null])
  })
  it('can initialize an already animated remote snapshot without previous UI positions', () => {
    const effect = death(1, ['a', 'b'], ['a'])
    const layout = arrangeBoard([unit('b')], [effect], empty)
    expect(layout.ghosts).toEqual({ '1-a': 0 })
    expect(layout.slots[0]).toBeNull()
    expect(layout.slots).toContain('b')
  })
})
