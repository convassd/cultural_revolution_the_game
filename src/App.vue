<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import Battlefield from './components/Battlefield.vue'
import CardGallery from './components/CardGallery.vue'
import GameRules from './components/GameRules.vue'
import Hand from './components/Hand.vue'
import MatchResult from './components/MatchResult.vue'
import OnlineLobby from './components/OnlineLobby.vue'
import PlayerArea from './components/PlayerArea.vue'
import { characters, definitions } from './data'
import { ABILITIES } from './data/abilities'
import { applyAction, createGame } from './game/engine'
import { chooseGreedyAction } from './game/ai'
import { BOARD_LIMIT, canAttackPlayer } from './game/rules'
import type { GameAction, GameState, PlayerId } from './game/types'
import { BATTLE_EFFECT_DURATION, createBattlePresentation } from './presentation/battle'
import type { BattlePresentation } from './presentation/battle'
import { prepareResultAudio, stopResultAudio } from './presentation/resultSound'
import { OnlineSession, idleStatus } from './online/session'
import type { OnlineFrame } from './online/protocol'

const game = shallowRef<GameState | null>(null)
const presentation = shallowRef<BattlePresentation | null>(null)
const displayPlayer = ref<PlayerId>(0)
const humanPlayer = ref<PlayerId>(0)
let effectTimer: ReturnType<typeof setTimeout> | undefined
let aiTimer: ReturnType<typeof setTimeout> | undefined
const mode = ref<'online' | 'ai'>('ai')
const view = ref<'home' | 'cards' | 'rules' | 'lobby' | 'game'>('home')
const onlineStatus = shallowRef(idleStatus())
let online: OnlineSession | null = null
let onlineMatchId = ''
const selectedHand = ref<string | null>(null)
const selectedAttacker = ref<string | null>(null)
const error = ref('')
const showHandReveal = ref(false)
const current = computed(() => game.value?.players[displayPlayer.value])
const opponent = computed(() => game.value?.players[displayPlayer.value === 0 ? 1 : 0])
const handReveal = computed(() => {
  const snapshot = game.value?.revealedHand
  return snapshot && showHandReveal.value && snapshot.viewer === displayPlayer.value ? snapshot : null
})
const aiTurn = computed(() => mode.value === 'ai' && !!game.value && game.value.currentPlayer !== humanPlayer.value)
const humanTurn = computed(() => !!game.value && game.value.currentPlayer === humanPlayer.value)
const enabled = computed(() => humanTurn.value && game.value?.winner === null && !presentation.value &&
  (mode.value !== 'online' || (onlineStatus.value.phase === 'playing' && onlineStatus.value.ready)))
const pendingTarget = computed(() => humanTurn.value ? game.value?.pendingPlayTarget : null)
const attackReady = computed(() => enabled.value && !pendingTarget.value && !!current.value?.board.find(c => c.instanceId === selectedAttacker.value)?.canAttack)
const selectedCard = computed(() => {
  const id = pendingTarget.value?.cardId ?? selectedHand.value
  return id ? definitions[id] : null
})
const canPlay = computed(() => enabled.value && !pendingTarget.value && selectedCard.value && current.value &&
  current.value.mana >= selectedCard.value.cost && current.value.board.length < BOARD_LIMIT)
const recentLog = computed(() => game.value ? [...game.value.log].reverse() : [])
const legalTargets = computed(() => pendingTarget.value?.targetIds ?? [])
const guarded = computed(() => opponent.value && !canAttackPlayer(opponent.value, definitions))
const turnHint = computed(() => {
  if (presentation.value) return '正在显示伤害与离场效果，请稍候。'
  if (mode.value === 'online') {
    if (onlineStatus.value.phase === 'closed') return '连接已中断，请返回首页重新联机。'
    if (!onlineStatus.value.ready) return '等待双方同步…'
    if (!humanTurn.value && game.value?.winner === null) return '等待对方行动；你的手牌保留显示。'
  }
  if (aiTurn.value && game.value?.winner === null) return '贪心 AI 正在行动；你的手牌保留显示，操作暂停。'
  if (pendingTarget.value) return selectedCard.value?.abilityId === 'BUFF_ONE'
    ? `「${ABILITIES.BUFF_ONE.name}」：点击另一名己方角色（休息中的角色也可以）。`
    : `「${ABILITIES.WEAKEN.name}」：点击一名敌方角色。`
  if (selectedAttacker.value && !attackReady.value) return '该角色当前不能攻击。'
  if (attackReady.value) return guarded.value
    ? `敌方「${ABILITIES.GUARD.name}」在场，不能直接攻击玩家；可以攻击任意敌方角色。`
    : '选择敌方角色，或点击“攻击玩家”。'
  return '点击手牌打出；点击己方角色攻击。'
})

function clearSelection() {
  showHandReveal.value = false
  selectedHand.value = null
  selectedAttacker.value = null
  error.value = ''
}
function playerName(id: PlayerId) {
  return `${id === humanPlayer.value ? '你' : mode.value === 'ai' ? '贪心 AI' : '对方'}（玩家 ${id + 1}）`
}
function startGame() {
  online?.destroy()
  online = null
  resetPresentation()
  prepareResultAudio()
  mode.value = 'ai'
  // Seat 0 always opens in the engine; randomly assign the human to either seat.
  humanPlayer.value = Math.random() < 0.5 ? 1 : 0
  game.value = createGame(characters)
  displayPlayer.value = humanPlayer.value
  view.value = 'game'
  clearSelection()
  scheduleAi()
}
function openOnline() {
  exit()
  mode.value = 'online'
  onlineStatus.value = idleStatus()
  view.value = 'lobby'
}
function connectOnline(roomId?: string) {
  prepareResultAudio()
  clearSelection()
  online?.destroy()
  const session = new OnlineSession({
    onStatus: status => { if (online === session) onlineStatus.value = status },
    onFrame: frame => { if (online === session) receiveOnline(frame) },
    onError: message => { if (online === session) error.value = message },
  })
  online = session
  if (roomId === undefined) session.host()
  else session.join(roomId)
}
function receiveOnline(frame: OnlineFrame) {
  const newMatch = frame.matchId !== onlineMatchId
  const before = newMatch ? null : game.value
  if (newMatch) {
    resetPresentation(true)
    onlineMatchId = frame.matchId
  }
  humanPlayer.value = displayPlayer.value = frame.seat
  game.value = frame.state
  view.value = 'game'
  clearSelection()
  showHandReveal.value = frame.reveal
  presentation.value = before ? createBattlePresentation(before, frame.state, frame.events, definitions) : null
  if (presentation.value) {
    effectTimer = setTimeout(() => {
      presentation.value = null
      effectTimer = undefined
      online?.ready()
    }, BATTLE_EFFECT_DURATION)
  } else online?.ready()
}
function exit() {
  online?.destroy()
  online = null
  onlineMatchId = ''
  onlineStatus.value = idleStatus()
  resetPresentation()
  game.value = null
  view.value = 'home'
  clearSelection()
}
function resetPresentation(keepAudio = false) {
  clearTimeout(effectTimer)
  clearTimeout(aiTimer)
  effectTimer = undefined
  aiTimer = undefined
  presentation.value = null
  if (!keepAudio) stopResultAudio()
}
onUnmounted(() => { online?.destroy(); resetPresentation() })
function send(action: GameAction) {
  if (!enabled.value || !game.value) return
  showHandReveal.value = false
  if (mode.value === 'online') online?.submit(action)
  else perform(action)
}
function perform(action: GameAction) {
  if (!game.value) return
  const before = game.value
  const result = applyAction(before, action, definitions)
  if (result.error) { error.value = result.error; return }
  game.value = result.state
  clearSelection()
  showHandReveal.value = action.type === 'PLAY_CARD' && definitions[action.cardId]?.abilityId === 'REVEAL_HAND'
  presentation.value = createBattlePresentation(before, result.state, result.events, definitions)
  if (presentation.value) {
    effectTimer = setTimeout(() => {
      presentation.value = null
      effectTimer = undefined
      scheduleAi()
    }, BATTLE_EFFECT_DURATION)
  } else {
    scheduleAi()
  }
}
function scheduleAi() {
  clearTimeout(aiTimer)
  aiTimer = undefined
  if (view.value !== 'game' || !aiTurn.value || !game.value || game.value.winner !== null || presentation.value) return
  aiTimer = setTimeout(() => {
    aiTimer = undefined
    if (view.value !== 'game' || !aiTurn.value || !game.value || game.value.winner !== null || presentation.value) return
    const action = chooseGreedyAction(game.value, definitions)
    if (action) perform(action)
  }, 450)
}
function selectHand(id: string) {
  if (!enabled.value || pendingTarget.value) return
  clearSelection()
  selectedHand.value = id
}
function selectAttacker(id: string) {
  const previous = selectedAttacker.value
  clearSelection()
  selectedAttacker.value = previous === id ? null : id
}
function play() {
  if (canPlay.value && game.value && selectedHand.value) send({ type: 'PLAY_CARD', player: game.value.currentPlayer, cardId: selectedHand.value })
}
function selectBoard(id: string, friendly: boolean) {
  if (!enabled.value) return
  if (pendingTarget.value) {
    if (game.value && legalTargets.value.includes(id)) send({ type: 'SELECT_PLAY_TARGET', player: game.value.currentPlayer, targetId: id })
  } else if (friendly) selectAttacker(id)
  else attack({ type: 'character', instanceId: id })
}
function attack(target: { type: 'player' } | { type: 'character'; instanceId: string }) {
  if (attackReady.value && game.value && selectedAttacker.value) send({ type: 'ATTACK', player: game.value.currentPlayer, attackerId: selectedAttacker.value, target })
}
</script>

<template>
  <main :class="{ 'match-view': view === 'game' }">
    <header class="page-header">
      <div><span class="eyebrow">CARD DUEL · v0.1</span><h1>文革杀 <span>{{ view === 'game' ? (mode === 'ai' ? '玩家 vs 贪心 AI' : '双人联机') : view === 'home' ? '横扫一切牛鬼蛇神' : view === 'rules' ? '游戏规则' : view === 'lobby' ? '双人联机' : '了解卡牌' }}</span></h1></div>
      <div v-if="view !== 'home'" class="header-actions"><span v-if="view === 'game' && mode === 'online'" class="connection-status">{{ onlineStatus.phase === 'closed' ? '连接中断' : `${onlineStatus.isHost ? '房主' : '加入者'} · 已连接` }}</span><button v-if="view === 'game' && mode === 'ai'" @click="startGame">重新开始</button><button v-if="view === 'game' && mode === 'online' && onlineStatus.isHost && game?.winner !== null" :disabled="!onlineStatus.ready" @click="online?.rematch()">再来一局</button><button @click="exit">返回</button></div>
    </header>
    <section v-if="view === 'home'" class="welcome">
      <h2>一张桌面，两种对战。</h2><p>48 张人物牌随机分配，行动力从 2 开始。</p>
      <div class="mode-options">
        <button class="mode-button" @click="openOnline"><strong>双人联机</strong><span>创建房间，分享 ID，与朋友在线对战。</span><small>双方各用自己的浏览器，随机先后手。</small></button>
        <button class="mode-button" @click="startGame"><strong>AI对战</strong><span>随机先后手，与贪心 AI 对战。</span><small>AI 单步评估出牌、换怪与打脸，择优行动。</small></button>
      </div>
      <div class="welcome-actions"><button @click="view = 'rules'">游戏规则</button><button @click="view = 'cards'">了解卡牌</button></div>
      <p class="muted">基础战斗、派别克制、关系加成与全部 SR / SSR 技能已就绪。</p>
    </section>
    <CardGallery v-else-if="view === 'cards'" />
    <GameRules v-else-if="view === 'rules'" />
    <OnlineLobby v-else-if="view === 'lobby'" :status="onlineStatus" :error="error" @host="connectOnline()" @join="connectOnline" />
    <template v-else-if="game && current && opponent">
      <MatchResult v-if="game.winner !== null && !presentation" :winner="game.winner" :human-player="humanPlayer" />
      <p class="orientation-hint">竖屏可左右滑动查看场牌和手牌；横屏能同时看到更多卡牌。</p>
      <p v-if="mode === 'online' && onlineStatus.phase === 'closed'" class="online-warning" role="alert">{{ onlineStatus.message }}</p>
      <div class="game-layout">
        <section class="table" aria-label="对战桌面">
          <div class="battle-row enemy-row">
            <PlayerArea :player="opponent" :label="playerName(opponent.id)" :active="game.currentPlayer === opponent.id && game.winner === null" :damage="presentation?.playerDamage[opponent.id]" :targetable="attackReady && !guarded && !pendingTarget" @attack="attack({ type: 'player' })" />
            <div class="battle-cards">
              <Battlefield :board="opponent.board" :friendly="false" :selected-id="null" :enabled="enabled"
                :presentation="presentation?.boards[opponent.id]"
                :targeting="attackReady || (!!pendingTarget && selectedCard?.abilityId === 'WEAKEN')"
                :selectable-ids="pendingTarget ? (selectedCard?.abilityId === 'WEAKEN' ? legalTargets : []) : undefined"
                @select="id => selectBoard(id, false)" />
            </div>
          </div>
          <div class="battle-divider">
            <div class="turn-bar"><b v-if="game.winner !== null">{{ playerName(game.winner) }} 获胜</b><b v-else-if="presentation">战斗结算中</b><b v-else>第 {{ game.turn }} 回合 · {{ playerName(game.currentPlayer) }}</b><small v-if="mode === 'ai'">本局{{ humanPlayer === 0 ? '你先手' : ' AI 先手' }}</small></div>
            <div class="table-status">
              <div class="hidden-hand" :class="{ revealed: !!handReveal }" :aria-label="`对方手牌 ${opponent.hand.length} 张`">
                <div class="opponent-hand-cards" :role="handReveal ? 'status' : undefined">
                  <template v-if="handReveal">
                    <span v-for="id in handReveal.cards" :key="id" class="revealed-card-name">{{ definitions[id]!.name }}</span>
                    <span v-if="handReveal.cards.length === 0" class="revealed-card-name">无手牌</span>
                  </template>
                  <template v-else><span v-for="n in Math.min(opponent.hand.length, 12)" :key="n" class="card-back">◆</span></template>
                </div>
                <small><template v-if="handReveal">「{{ ABILITIES.REVEAL_HAND.name }}」 · </template>对方手牌 · {{ opponent.hand.length }} 张</small>
              </div>
              <p v-if="!handReveal" class="turn-hint" :title="turnHint">{{ turnHint }}</p>
            </div>
          </div>
          <div class="battle-row friendly-row">
            <PlayerArea :player="current" :label="playerName(current.id)" :active="game.currentPlayer === current.id && game.winner === null" :damage="presentation?.playerDamage[current.id]" />
            <div class="battle-cards">
              <Battlefield :board="current.board" :friendly="true" :selected-id="selectedAttacker" :enabled="enabled"
                :presentation="presentation?.boards[current.id]"
                :targeting="!!pendingTarget && selectedCard?.abilityId === 'BUFF_ONE'"
                :selectable-ids="pendingTarget ? (selectedCard?.abilityId === 'BUFF_ONE' ? legalTargets : []) : undefined"
                @select="id => selectBoard(id, true)" />
            </div>
          </div>
        </section>
        <section class="hand-zone" aria-label="手牌与回合操作">
          <Hand :cards="current.hand" :selected-id="selectedHand" :enabled="enabled && !pendingTarget" @select="selectHand" />
          <div class="turn-actions">
            <div class="play-controls">
              <div class="play-info"><b v-if="selectedCard" :title="`${selectedCard.name} · 费用 ${selectedCard.cost}`">{{ selectedCard.name }} · 费用 {{ selectedCard.cost }}</b><b v-else :title="`${playerName(current.id)} 的手牌`">{{ playerName(current.id) }} 的手牌</b><span>行动力 {{ current.mana }} / {{ current.maxMana }}</span></div>
              <button :disabled="!canPlay" @click="play">打出人物</button>
            </div>
            <div v-if="pendingTarget || error || (selectedCard && !canPlay && !presentation)" class="action-feedback">
              <p v-if="pendingTarget" class="target-prompt" role="status">{{ turnHint }} 人物已登场并支付费用，请完成目标选择。</p>
              <p v-else-if="selectedCard && !canPlay && !presentation" class="muted selection-hint">{{ current.board.length >= BOARD_LIMIT ? '场地已满（最多 5 人）' : `行动力不足：需要 ${selectedCard.cost}` }}</p>
              <p v-if="error" class="error" role="alert">{{ error }}</p>
            </div>
            <button :disabled="!enabled || !!pendingTarget" class="primary-button end-turn-button" @click="send({ type: 'END_TURN', player: game.currentPlayer })">结束回合</button>
          </div>
        </section>
        <aside class="sidebar"><section><h2>对局记录</h2><ol class="game-log" aria-live="polite"><li v-for="(message, index) in recentLog" :key="`${game.turn}-${index}`">{{ message }}</li></ol></section></aside>
      </div>
    </template>
    <footer>浏览器卡牌游戏 · 无账号 · AI 可离线游玩 · 联机需要互联网</footer>
  </main>
</template>
