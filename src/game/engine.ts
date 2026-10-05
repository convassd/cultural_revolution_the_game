import { resolveCombat } from './combat'
import { BOARD_LIMIT, canAttackPlayer, effectiveAttack, effectiveFaction, INITIAL_HP, INITIAL_MANA, MAX_MANA, playTargets } from './rules'
import { applyDamageBatch, beginCharacterTurn, createCharacter, endCharacterTurn, recordLog as log, removeDead } from './effects'
import { ABILITIES } from '../data/abilities'
import type { ActionResult, CharacterDefinition, GameAction, GameEvent, GameState, PlayerId, PlayerState } from './types'

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
  } else {
    log(state, `玩家 ${player.id + 1} 牌库已空，跳过抽牌。`)
  }
}

function startTurn(state: GameState, definitions: Definitions, random: RandomSource, events: GameEvent[] = []) {
  const player = state.players[state.currentPlayer]
  player.maxMana = player.maxMana === 0 ? INITIAL_MANA : Math.min(MAX_MANA, player.maxMana + 1)
  player.mana = player.maxMana
  log(state, `第 ${state.turn} 回合：玩家 ${player.id + 1}，行动力 ${player.mana}。`)
  draw(state, player)
  beginCharacterTurn(state, definitions, random, events)
}

export function createGame(cards: readonly CharacterDefinition[], random: RandomSource = Math.random): GameState {
  if (cards.length !== 48 || new Set(cards.map(c => c.id)).size !== 48) {
    throw new Error('新游戏需要 48 张不同的人物卡。')
  }
  const ids = shuffle(cards.map(c => c.id), random)
  function player(id: PlayerId): PlayerState {
    const deck = ids.slice(id * 24, (id + 1) * 24)
    return { id, hp: INITIAL_HP, mana: 0, maxMana: 0,
      hand: deck.splice(0, id === 0 ? 3 : 4), deck, board: [], discard: [], pendingReturns: [], mediationUsed: false }
  }
  const state: GameState = {
    players: [player(0), player(1)], currentPlayer: 0, turn: 1,
    winner: null, nextInstanceId: 1, revealedHand: null,
    pendingPlayTarget: null,
    log: ['新游戏：双方各 24 张牌；先手起手 3 张，后手起手 4 张。'],
  }
  // The opening turn follows the same draw rule as every later turn.
  startTurn(state, Object.fromEntries(cards.map(card => [card.id, card])), random)
  return state
}

function applyTargetedEntry(state: GameState, card: CharacterDefinition, targetId: string, definitions: Definitions) {
  const owner = card.abilityId === 'BUFF_ONE' ? state.currentPlayer : state.currentPlayer === 0 ? 1 : 0
  const target = state.players[owner].board.find(c => c.instanceId === targetId)!
  const change = card.abilityId === 'BUFF_ONE' ? 1 : -1
  target.temporaryAttack += change
  log(state, `${card.name}：${definitions[target.definitionId]!.name} 本回合攻击 ${change > 0 ? '+1' : '-1'}。`)
}

export function applyAction(state: GameState, action: GameAction, definitions: Definitions, random: RandomSource = Math.random): ActionResult {
  const reject = (error: string): ActionResult => ({ state, error, events: [] })
  if (action.player !== state.currentPlayer) return reject('尚未轮到该玩家。')
  if (state.winner !== null) return reject('对局已经结束，请开始新游戏。')
  if (state.pendingPlayTarget && action.type !== 'SELECT_PLAY_TARGET') return reject('请先选择登场技能的目标。')
  // All mutations below affect a fresh copy; the input snapshot stays intact.
  const next: GameState = structuredClone(state)
  const events: GameEvent[] = []
  const player = next.players[action.player]
  const enemy = next.players[action.player === 0 ? 1 : 0]

  switch (action.type) {
    case 'PLAY_CARD': {
      const index = player.hand.indexOf(action.cardId)
      const card = definitions[action.cardId]
      if (index < 0 || !card) return reject('这张牌不在你的手牌中。')
      if (player.board.length >= BOARD_LIMIT) return reject('己方场地已满。')
      if (player.mana < card.cost) return reject('行动力不足。')
      const targets = playTargets(card, player, enemy)
      if (action.targetId !== undefined && !targets.includes(action.targetId)) return reject('该登场技能没有这个合法目标。')
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
          const index = player.deck.findIndex(id => definitions[id]!.faction === '造反派')
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
          if (action.targetId !== undefined) applyTargetedEntry(next, card, action.targetId, definitions)
          else if (targets.length) next.pendingPlayTarget = { cardId: card.id, targetIds: targets }
          else log(next, `${card.name}：没有合法目标，跳过登场技能。`)
          break
        }
        case 'REVEAL_HAND':
          next.revealedHand = { viewer: player.id, owner: enemy.id, cards: [...enemy.hand] }
          log(next, `${card.name}：玩家 ${player.id + 1} 查看了对方当前手牌。`)
          break
      }
      break
    }
    case 'SELECT_PLAY_TARGET': {
      const pending = next.pendingPlayTarget
      if (!pending || !pending.targetIds.includes(action.targetId)) return reject('请选择合法的登场技能目标。')
      const card = definitions[pending.cardId]!
      const targetBoard = card.abilityId === 'BUFF_ONE' ? player.board : enemy.board
      if (!targetBoard.some(c => c.instanceId === action.targetId)) return reject('目标已经离场。')
      applyTargetedEntry(next, card, action.targetId, definitions)
      next.pendingPlayTarget = null
      break
    }
    case 'ATTACK': {
      const attacker = player.board.find(c => c.instanceId === action.attackerId)
      if (!attacker) return reject('攻击者不在己方场上。')
      if (!attacker.canAttack) return reject('该角色本回合不能攻击或已经攻击。')
      const attack = effectiveAttack(attacker, player.board, definitions)
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
          { attack: effectiveAttack(defender, enemy.board, definitions), health: defender.health, faction: effectiveFaction(defender, definitions) },
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
  }
  return { state: next, error: null, events }
}
