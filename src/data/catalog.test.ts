import { describe, expect, it } from 'vitest'
import { characters, definitions } from './index'
import { queryCards } from './catalog'
import type { CardSortKey } from './catalog'

describe('card catalog', () => {
  it('shows all 48 by default and orders rarity SSR > SR > R', () => {
    const cards = queryCards(characters, 'all', 'rarity', 'desc')
    expect(cards).toHaveLength(48)
    expect(cards.slice(0, 5).every(c => c.rarity === 'SSR')).toBe(true)
    expect(cards.slice(5, 19).every(c => c.rarity === 'SR')).toBe(true)
    expect(cards.slice(19).every(c => c.rarity === 'R')).toBe(true)
  })
  it.each(['cost', 'attack', 'health'] as const)('sorts %s both ways without modifying definitions or source order', key => {
    const before = structuredClone(characters)
    for (const direction of ['asc', 'desc'] as const) {
      const cards = queryCards(characters, 'all', key, direction)
      for (let i = 1; i < cards.length; i++) {
        const delta = cards[i]![key] - cards[i - 1]![key]
        expect(direction === 'asc' ? delta >= 0 : delta <= 0).toBe(true)
      }
    }
    expect(characters).toEqual(before)
  })
  it('uses numerical rarity levels when sorting ascending', () => {
    expect(queryCards([definitions.mao_zedong!, definitions.liu_shaoqi!, definitions.wu_han!], 'all', 'rarity', 'asc')
      .map(c => c.rarity)).toEqual(['R', 'SR', 'SSR'])
  })
  it('combines faction filtering with every sort key and preserves ties', () => {
    for (const key of ['rarity', 'cost', 'attack', 'health'] as CardSortKey[]) {
      const cards = queryCards(characters, '无派别', key, 'desc')
      expect(cards).toHaveLength(4)
      expect(cards.every(c => c.faction === '无派别')).toBe(true)
    }
    const sameCost = [definitions.zhang_yufeng!, definitions.wu_han!, definitions.yao_dengshan!]
    expect(queryCards(sameCost, 'all', 'cost', 'asc')).toEqual(sameCost)
    expect(queryCards(sameCost, 'all', 'cost', 'desc')).toEqual(sameCost)
  })
})
