import { applyDamageBatch, recordLog, removeDead } from './effects'
import { effectiveFaction } from './rules'
import type { Definitions } from './engine'
import type { CharacterInstance, EventId, GameEvent, GameState } from './types'

// Engine-owned mutations. Attack changes apply to characters present at resolution,
// stack with other temporary modifiers, and expire at the current global turn end.
export function resolveEvent(state: GameState, id: EventId, definitions: Definitions, events: GameEvent[]) {
  const owner = state.players[state.currentPlayer]
  const all = () => state.players.flatMap(player => player.board)
  const faction = (card: CharacterInstance) => effectiveFaction(card, definitions)
  const group = (card: CharacterInstance) => definitions[card.definitionId]!.relationGroup
  const buff = (cards: CharacterInstance[], amount: number) => { for (const card of cards) card.temporaryAttack += amount }
  const rebels = (cards: CharacterInstance[]) => cards.filter(card => faction(card) === '造反派')
  const setToOne = (ids: string[]) => {
    for (const card of all().filter(card => ids.includes(card.definitionId))) {
      const lost = Math.max(0, card.health - 1)
      card.health = Math.min(card.health, 1)
      // HP-setting is not a damage hit: no Tough or Mediation. Emit its visual loss.
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
    case 'february_outline': buff(rebels(all()), -1); break
    case 'may_16_notice':
      buff(rebels(all()), 1)
      buff(all().filter(card => faction(card) === '保守派'), -1)
      break
    case 'bombard_headquarters':
      setToOne(['liu_shaoqi', 'deng_xiaoping'])
      buff(all().filter(card => faction(card) === '保守派' && !['liu_shaoqi', 'deng_xiaoping'].includes(card.definitionId)), -1)
      break
    case 'january_storm': {
      buff(rebels(owner.board), 2)
      if (owner.board.some(card => group(card) === 'gang_of_four')) {
        const cardId = owner.deck.shift()
        if (cardId) { owner.hand.push(cardId); recordLog(state, '一月风暴：己方有四人帮成员，抽 1 张人物牌。') }
        else recordLog(state, '一月风暴：牌库已空，跳过抽牌。')
      }
      break
    }
    case 'february_countercurrent':
      for (const card of all()) {
        if (faction(card) === '造反派') card.temporaryAttack--
        else if (faction(card) === '保守派' || faction(card) === '军队') card.temporaryAttack++
        if (['chen_yi', 'ye_jianying', 'xu_xiangqian', 'tan_zhenlin', 'li_fuchun', 'li_xiannian'].includes(card.definitionId)) card.temporaryAttack++
      }
      break
    case 'july_20_incident':
      setToOne(['wang_li', 'chen_zaidao'])
      buff(all().filter(card => faction(card) === '军队' || faction(card) === '造反派'), 1)
      break
    case 'wen_gong_wu_wei':
      damage(rebels(owner.board), () => 1)
      buff(rebels(owner.board), 2)
      break
    case 'purge_may_16': damage(rebels(all()), card => group(card) === 'wang_guan_qi' ? 2 : 1); break
    case 'september_13_incident':
      remove(all().filter(card => card.definitionId === 'lin_biao'))
      buff(all().filter(card => card.definitionId !== 'lin_biao' && group(card) === 'lin_group'), -2)
      break
    case 'comprehensive_rectification':
      for (const card of owner.board) {
        const printedHealth = definitions[card.definitionId]!.health
        if (card.health < printedHealth) card.health = Math.min(printedHealth, card.health + 1)
      }
      buff(owner.board.filter(card => faction(card) === '保守派'), 1)
      break
    case 'april_5_incident':
      setToOne(['deng_xiaoping'])
      damage(all().filter(card => group(card) === 'gang_of_four'), () => 1)
      buff(all().filter(card => group(card) === 'gang_of_four'), -1)
      break
    case 'huairentang_incident':
      remove(all().filter(card => group(card) === 'gang_of_four'))
      buff(rebels(all()), -1)
      break
  }
}
