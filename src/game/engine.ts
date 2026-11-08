import { resolveCombat } from './combat'
import { BOARD_LIMIT, CHARACTERS_PER_EVENT, DEFAULT_RULES, canAttackPlayer, effectiveAttack, effectiveFaction, INITIAL_HAND_SIZE, INITIAL_HP } from './rules'
import { applyDamageBatch, beginCharacterTurn, createCharacter, endCharacterTurn, recordLog as log, removeDead } from './effects'
import { ABILITIES } from '../data/abilities'
import { eventCards, eventDefinitions } from '../data/events'
import { resolveEvent } from './eventEffects'
import type { ActionResult, CardDefinition, CharacterDefinition, CharacterInstance, GameAction, GameEvent, GameState, GameRules, PlayerId, PlayerState } from './types'

export type RandomSource = () => number
export type Definitions = Readonly<Record<string, CharacterDefinition>>

export function shuffle<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  return shuffled
}

function draw(state: GameState, player: PlayerState) {
  const cardId = player.deck.shift()
  if (cardId) {
    player.hand.push(cardId)
    log(state, `玩家 ${player.id + 1} 抽了 1 张牌。`)
    return true
  } else {
    log(state, `玩家 ${player.id + 1} 牌库已空，跳过抽牌。`)
    return false
  }
}

function startTurn(state: GameState, definitions: Definitions, random: RandomSource, events: GameEvent[] = []) {
  // Expire longer effects before draws, returns and other turn-start triggers.
  for (const owner of state.players) {
    for (const character of owner.board) {
      if (character.attackModifiers) character.attackModifiers = character.attackModifiers.filter(effect => effect.expiresAtTurn > state.turn)
    }
  }
  const player = state.players[state.currentPlayer]
  player.maxMana = state.rules.energyPerTurn
  const openingBonus = state.turn === 2 ? (state.rules.secondPlayerOpeningBonus ?? 0) : 0
  player.mana = player.maxMana + openingBonus
  log(state, `第 ${Math.ceil(state.turn / 2)} 轮：玩家 ${player.id + 1} 的回合，行动力 ${player.mana}。`)
  if (openingBonus) log(state, `后手首回合补偿：额外 ${openingBonus} 行动力，仅本回合可用。`)
  for (let i = 0; state.turn > 2 && i < state.rules.drawPerTurn; i++) {
    if (!draw(state, player)) break
  }
  beginCharacterTurn(state, definitions, random, events)
}

export function createGame(cards: readonly CharacterDefinition[], random: RandomSource = Math.random, rules: GameRules = DEFAULT_RULES): GameState {
  if (!Number.isInteger(rules.energyPerTurn) || rules.energyPerTurn < 1 || !Number.isInteger(rules.drawPerTurn) || rules.drawPerTurn < 0) throw new Error("E 必须为正整数，K 必须为非负整数。")
  if (!Number.isInteger(rules.secondPlayerOpeningBonus ?? 0) || (rules.secondPlayerOpeningBonus ?? 0) < 0) throw new Error('后手首回合补偿必须为非负整数。')
  if (cards.length !== 48 || new Set(cards.map(c => c.id)).size !== 48) {
    throw new Error('新游戏需要 48 张不同的人物卡。')
  }
  const characterIds = shuffle(cards.map(c => c.id), random)
  const eventIds = shuffle(eventCards.map(c => c.id), random)
  function player(id: PlayerId): PlayerState {
    const charactersPerPlayer = characterIds.length / 2, eventsPerPlayer = eventIds.length / 2
    const ownCharacters = characterIds.slice(id * charactersPerPlayer, (id + 1) * charactersPerPlayer)
    const ownEvents = eventIds.slice(id * eventsPerPlayer, (id + 1) * eventsPerPlayer)
    const deck = ownEvents.flatMap((eventId, index) => [
      ...ownCharacters.slice(index * CHARACTERS_PER_EVENT, (index + 1) * CHARACTERS_PER_EVENT), eventId,
    ])
    return { id, hp: INITIAL_HP, mana: 0, maxMana: rules.energyPerTurn,
      hand: deck.splice(0, INITIAL_HAND_SIZE), deck, board: [], discard: [], removed: [], pendingReturns: [], mediationUsed: false }
  }
  const state: GameState = {
    rules: { ...rules }, activeEvent: null,
    players: [player(0), player(1)], currentPlayer: 0, turn: 1,
    winner: null, nextInstanceId: 1, revealedHand: null,
    log: [`新游戏：双方各 24 张人物、6 张事件，每 ${CHARACTERS_PER_EVENT} 张人物穿插 1 张事件；起手 ${INITIAL_HAND_SIZE} 张，之后每回合抽 ${rules.drawPerTurn} 张，行动力重置为 ${rules.energyPerTurn}。`],
  }
  // startTurn skips each player's opening draw; the opening hand stays at five.
  startTurn(state, Object.fromEntries(cards.map(card => [card.id, card])), random)
  return state
}

function applyAutomaticEntry(state: GameState, card: CharacterDefinition, sourceId: string, definitions: Definitions) {
  const owner = card.abilityId === 'BUFF_ONE' ? state.currentPlayer : state.currentPlayer === 0 ? 1 : 0
  const board = state.players[owner].board
  let target: CharacterInstance | undefined
  let highestAttack = -Infinity
  // Strictly greater preserves the leftmost tie. Use live attack after entry/aura updates.
  for (const candidate of board) {
    if (candidate.instanceId === sourceId || candidate.health <= 0) continue
    const attack = effectiveAttack(candidate, board, definitions, state.activeEvent?.id)
    if (attack > highestAttack) { target = candidate; highestAttack = attack }
  }
  if (!target) { log(state, `${card.name}：没有合法目标，跳过登场技能。`); return }
  const change = card.abilityId === 'BUFF_ONE' ? 1 : -1
  if (card.abilityId === 'WEAKEN') {
    target.attackModifiers ??= []
    target.attackModifiers.push({ amount: change, expiresAtTurn: state.turn + 2 })
  } else target.temporaryAttack += change
  const duration = card.abilityId === 'WEAKEN' ? '直到施放者的下个回合开始' : '仅持续本回合'
  log(state, `${card.name}「${ABILITIES[card.abilityId!].name}」：${definitions[target.definitionId]!.name} 攻击 ${change > 0 ? '+1' : '-1'}，${duration}。`)
}

export function applyAction(state: GameState, action: GameAction, definitions: Definitions, random: RandomSource = Math.random): ActionResult {
  const reject = (error: string): ActionResult => ({ state, error, events: [] })
  if (action.player !== state.currentPlayer) return reject('尚未轮到该玩家。')
  if (state.winner !== null) return reject('对局已经结束，请开始新游戏。')
  // All mutations below affect a fresh copy; the input snapshot stays intact.
  const next: GameState = structuredClone(state)
  const events: GameEvent[] = []
  const player = next.players[action.player]
  const enemy = next.players[action.player === 0 ? 1 : 0]

  switch (action.type) {
    case 'SELL_CARD': {
      const index = player.hand.indexOf(action.cardId)
      const card = (definitions[action.cardId] as CardDefinition | undefined) ?? eventDefinitions[action.cardId]
      if (index < 0 || !card) return reject('这张牌不在你的手牌中。')
      player.hand.splice(index, 1)
      player.removed.push(card.id)
      player.mana += card.cost
      log(next, `玩家 ${player.id + 1} 卖出 ${card.name}，获得 ${card.cost} 行动力；该牌永久移除。`)
      break
    }
    case 'PLAY_CARD': {
      const index = player.hand.indexOf(action.cardId)
      const card = (definitions[action.cardId] as CardDefinition | undefined) ?? eventDefinitions[action.cardId]
      if (index < 0 || !card) return reject('这张牌不在你的手牌中。')
      if (player.mana < card.cost) return reject('行动力不足。')
      if (card.type === 'event') {
        player.mana -= card.cost
        player.hand.splice(index, 1)
        if (next.activeEvent) next.players[next.activeEvent.owner].discard.push(next.activeEvent.id)
        next.activeEvent = { id: card.id, owner: player.id }
        log(next, `玩家 ${player.id + 1} 打出事件「${card.name}」：${card.description}`)
        resolveEvent(next, card.id, definitions, events)
        break
      }
      if (player.board.length >= BOARD_LIMIT) return reject('己方场地已满。')
      const hadGroupMember = !!card.relationGroup && player.board.some(c =>
        definitions[c.definitionId]!.relationGroup === card.relationGroup)
      player.mana -= card.cost
      player.hand.splice(index, 1)
      const instanceId = `character-${next.nextInstanceId++}`
      player.board.push(createCharacter(card, instanceId))
      log(next, `玩家 ${player.id + 1} 打出 ${card.name}（${card.cost} 行动力）。`)
      switch (card.abilityId) {
        case 'MAO_RANDOM_COMMAND':
          player.hp += 5
          log(next, `${card.name}「${ABILITIES.MAO_RANDOM_COMMAND.name}」：玩家 ${player.id + 1} 恢复 5 HP，当前 ${player.hp} HP。`)
          break
        case 'JIANG_BORROW_POWER': {
          const index = player.deck.findIndex(id => definitions[id]?.faction === '造反派')
          if (index >= 0) {
            player.hand.push(player.deck.splice(index, 1)[0]!)
            log(next, `${card.name}「${ABILITIES.JIANG_BORROW_POWER.name}」：抽了 1 张造反派。`)
          } else log(next, `${card.name}「${ABILITIES.JIANG_BORROW_POWER.name}」：牌库没有造反派，跳过抽牌。`)
          break
        }
        case 'DRAW_ONE':
          draw(next, player)
          break
        case 'GROUP_DRAW':
          if (hadGroupMember) draw(next, player)
          else log(next, `${card.name}：没有已有同组成员，未触发协同。`)
          break
        case 'BUFF_ONE':
        case 'WEAKEN': {
          applyAutomaticEntry(next, card, instanceId, definitions)
          break
        }
        case 'REVEAL_HAND':
          next.revealedHand = { viewer: player.id, owner: enemy.id, cards: [...enemy.hand] }
          log(next, `${card.name}：玩家 ${player.id + 1} 查看了对方当前手牌。`)
          break
      }
      break
    }
    case 'ATTACK': {
      const attacker = player.board.find(c => c.instanceId === action.attackerId)
      if (!attacker) return reject('攻击者不在己方场上。')
      if (!attacker.canAttack) return reject('该角色本回合不能攻击或已经攻击。')
      const attack = effectiveAttack(attacker, player.board, definitions, next.activeEvent?.id)
      const attackerDefinition = definitions[attacker.definitionId]!
      if (action.target.type === 'player') {
        if (!canAttackPlayer(enemy, definitions)) return reject('敌方保卫在场，不能直接攻击玩家。')
        enemy.hp = Math.max(0, enemy.hp - attack)
        events.push({ type: 'PLAYER_DAMAGED', playerId: enemy.id, amount: attack })
        log(next, `${attackerDefinition.name} 对玩家 ${enemy.id + 1} 造成 ${attack} 点伤害。`)
      } else {
        const targetId = action.target.instanceId
        const defender = enemy.board.find(c => c.instanceId === targetId)
        if (!defender) return reject('目标不在敌方场上。')
        const defenderDefinition = definitions[defender.definitionId]!
        const result = resolveCombat(
          { attack, health: attacker.health, faction: effectiveFaction(attacker, definitions) },
          { attack: effectiveAttack(defender, enemy.board, definitions, next.activeEvent?.id), health: defender.health, faction: effectiveFaction(defender, definitions) },
        )
        const applied = applyDamageBatch(next, [
          { instanceId: attacker.instanceId, amount: result.toAttacker },
          { instanceId: defender.instanceId, amount: result.toDefender },
        ], definitions, [], events)
        log(next, `${attackerDefinition.name} 攻击 ${defenderDefinition.name}：造成 ${applied.get(defender.instanceId)}，受到 ${applied.get(attacker.instanceId)} 点伤害。`)
      }
      attacker.canAttack = false
      removeDead(next, definitions, events)
      if (enemy.hp <= 0) {
        next.winner = player.id
        log(next, `玩家 ${player.id + 1} 获胜！`)
      }
      break
    }
    case 'END_TURN':
      endCharacterTurn(next, definitions, events)
      for (const owner of next.players) {
        for (const character of owner.board) character.temporaryAttack = 0
      }
      next.revealedHand = null
      next.currentPlayer = enemy.id
      next.turn += 1
      startTurn(next, definitions, random, events)
      break
    default: return reject('无效操作。')
  }
  return { state: next, error: null, events }
}
