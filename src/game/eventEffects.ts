import { applyDamageBatch, recordLog, removeDead } from './effects'
import { effectiveFaction } from './rules'
import type { Definitions } from './engine'
import type { CharacterInstance, EventId, GameEvent, GameState } from './types'

// Entry effects happen once. Continuous attack auras live in rules.ts.
export function resolveEvent(state: GameState, id: EventId, definitions: Definitions, events: GameEvent[]) {
  const all = () => state.players.flatMap(player => player.board)
  const setToOne = (ids: string[]) => {
    for (const card of all().filter(card => ids.includes(card.definitionId))) {
      const lost = Math.max(0, card.health - 1)
      card.health = Math.min(card.health, 1)
      if (lost) events.push({ type: 'CHARACTER_DAMAGED', instanceId: card.instanceId, amount: lost })
    }
  }
  const damage = (cards: CharacterInstance[], amount: (card: CharacterInstance) => number) => {
    applyDamageBatch(state, cards.map(card => ({ instanceId: card.instanceId, amount: amount(card) })), definitions, [], events)
    removeDead(state, definitions, events)
  }
  const remove = (cards: CharacterInstance[]) => {
    for (const card of cards) card.health = 0
    removeDead(state, definitions, events)
  }
  switch (id) {
    case 'bombard_headquarters': setToOne(['liu_shaoqi', 'deng_xiaoping']); break
    case 'january_storm':
      for (const player of state.players) {
        if (!player.board.some(card => definitions[card.definitionId]!.relationGroup === 'gang_of_four')) continue
        const cardId = player.deck.shift()
        if (cardId) { player.hand.push(cardId); recordLog(state, `一月风暴：玩家 ${player.id + 1} 有四人帮成员，抽 1 张牌。`) }
      }
      break
    case 'july_20_incident': setToOne(['wang_li', 'chen_zaidao']); break
    case 'wen_gong_wu_wei': damage(all().filter(card => effectiveFaction(card, definitions) === '造反派'), () => 1); break
    case 'purge_may_16': damage(all().filter(card => effectiveFaction(card, definitions) === '造反派'), card => definitions[card.definitionId]!.relationGroup === 'wang_guan_qi' ? 2 : 1); break
    case 'september_13_incident': remove(all().filter(card => card.definitionId === 'lin_biao')); break
    case 'comprehensive_rectification':
      for (const card of all()) card.health += Math.min(1, Math.max(0, definitions[card.definitionId]!.health - card.health))
      break
    case 'april_5_incident':
      setToOne(['deng_xiaoping'])
      damage(all().filter(card => definitions[card.definitionId]!.relationGroup === 'gang_of_four'), () => 1)
      break
    case 'huairentang_incident': remove(all().filter(card => definitions[card.definitionId]!.relationGroup === 'gang_of_four')); break
  }
}
