<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import { version } from '../package.json'
import Battlefield from './components/Battlefield.vue'
import CardGallery from './components/CardGallery.vue'
import GameRules from './components/GameRules.vue'
import Hand from './components/Hand.vue'
import MatchResult from './components/MatchResult.vue'
import OnlineLobby from './components/OnlineLobby.vue'
import PlayerArea from './components/PlayerArea.vue'
import ActiveEvent from './components/ActiveEvent.vue'
import SellSlot from './components/SellSlot.vue'
import { HAND_DRAG_TYPE, type CardDestination } from './presentation/cardInteraction'
import { FACTION_CLASSES } from './presentation/factions'
import { characters, definitions, cardDefinitions } from './data'
import { ABILITIES } from './data/abilities'
import { applyAction, createGame } from './game/engine'
import { AiClient } from './ai/client'
import { BOARD_LIMIT, DEFAULT_RULES, canAttackPlayer } from './game/rules'
import type { GameAction, GameEvent, GameState, PlayerId } from './game/types'
import { BATTLE_EFFECT_DURATION, createBattlePresentation } from './presentation/battle'
import type { BattleEffect } from './presentation/battle'
import { playTurnSound, prepareResultAudio, stopResultAudio } from './presentation/resultSound'
import { OnlineSession, idleStatus } from './online/session'
import type { OnlineFrame } from './online/protocol'

const game = shallowRef<GameState | null>(null)
const effects = shallowRef<BattleEffect[]>([])
const displayPlayer = ref<PlayerId>(0)
const humanPlayer = ref<PlayerId>(0)
const effectTimers = new Set<ReturnType<typeof setTimeout>>()
let nextEffectId = 0
let turnCuePending = false
let aiTimer: ReturnType<typeof setTimeout> | undefined
let ai: AiClient | null = null
const mode = ref<'online' | 'ai'>('ai')
const view = ref<'home' | 'cards' | 'rules' | 'lobby' | 'game'>('home')
const onlineStatus = shallowRef(idleStatus())
let online: OnlineSession | null = null
let onlineMatchId = ''
const selectedHand = ref<string | null>(null)
const selectedAttacker = ref<string | null>(null)
const draggedCard = ref<string | null>(null)
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
const enabled = computed(() => humanTurn.value && game.value?.winner === null &&
  (mode.value !== 'online' || (onlineStatus.value.phase === 'playing' && onlineStatus.value.ready)))
const attackReady = computed(() => enabled.value && !!current.value?.board.find(c => c.instanceId === selectedAttacker.value)?.canAttack)
const selectedCard = computed(() => {
  const id = selectedHand.value
  return id ? cardDefinitions[id] : null
})
const canSell = computed(() => enabled.value && !!selectedHand.value)
const canPlay = computed(() => enabled.value && selectedCard.value && current.value &&
  current.value.mana >= selectedCard.value.cost && (selectedCard.value.type === 'event' || current.value.board.length < BOARD_LIMIT))
const selectingCard = computed(() => enabled.value && !!selectedCard.value)
const playIssue = computed(() => {
  if (!selectedCard.value || !current.value) return ''
  if (current.value.mana < selectedCard.value.cost) return `行动力不足：需要 ${selectedCard.value.cost}，当前 ${current.value.mana}。`
  if (selectedCard.value.type === 'character' && current.value.board.length >= BOARD_LIMIT) return '己方场地已满（最多 5 人），仍可卖出手牌。'
  return ''
})
const recentLog = computed(() => game.value ? [...game.value.log].reverse() : [])
const guarded = computed(() => opponent.value && !canAttackPlayer(opponent.value, definitions))
const turnHint = computed(() => {
  if (mode.value === 'online') {
    if (onlineStatus.value.phase === 'closed') return '连接已中断，请返回首页重新联机。'
    if (!onlineStatus.value.ready) return '等待双方同步…'
    if (!humanTurn.value && game.value?.winner === null) return '等待对方行动；你的手牌保留显示。'
  }
  if (aiTurn.value && game.value?.winner === null) return 'AI 2.0 正在行动；你的手牌保留显示，操作暂停。'
  if (playIssue.value) return playIssue.value
  if (selectedCard.value) return selectedCard.value.type === 'event'
    ? '点击事件区域或将此牌拖入其中，打出后替换当前事件；点击左侧垃圾桶可卖出。'
    : '点击己方任一场地位置或将此牌拖入其中；点击左侧垃圾桶可卖出。'
  if (selectedAttacker.value && !attackReady.value) return '该角色当前不能攻击。'
  if (attackReady.value) return guarded.value
    ? `敌方「${ABILITIES.GUARD.name}」在场，不能直接攻击玩家；可以攻击任意敌方角色。`
    : '选择敌方角色，或点击“攻击玩家”。'
  return '选中手牌后点击场地、事件位或垃圾桶，也可直接拖拽；点击己方角色攻击。'
})

function clearSelection() {
  showHandReveal.value = false
  selectedHand.value = null
  selectedAttacker.value = null
  draggedCard.value = null
  error.value = ''
}
function playerName(id: PlayerId) {
  return `${id === humanPlayer.value ? '你' : mode.value === 'ai' ? 'AI 2.0' : '对方'}（玩家 ${id + 1}）`
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
    onStatus: status => { if (online === session) { onlineStatus.value = status; maybePlayTurnCue() } },
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
  if (before) {
    appendEffects(before, frame.state, frame.events)
    markTurnCue(before, frame.state)
  }
  online?.ready()
  maybePlayTurnCue()
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
  for (const timer of effectTimers) clearTimeout(timer)
  effectTimers.clear()
  clearTimeout(aiTimer)
  aiTimer = undefined
  ai?.destroy()
  ai = null
  effects.value = []
  turnCuePending = false
  if (!keepAudio) stopResultAudio()
}
function appendEffects(before: GameState, after: GameState, events: GameEvent[]) {
  const presentation = createBattlePresentation(before, after, events, definitions)
  if (!presentation) return
  const id = ++nextEffectId
  effects.value = [...effects.value, { ...presentation, id }]
  const timer = setTimeout(() => {
    effects.value = effects.value.filter(effect => effect.id !== id)
    effectTimers.delete(timer)
  }, BATTLE_EFFECT_DURATION)
  effectTimers.add(timer)
}
function boardEffects(id: PlayerId) { return effects.value.map(effect => ({ id: effect.id, slots: effect.boards[id] })) }
function playerEffects(id: PlayerId) {
  return effects.value.flatMap(effect => effect.playerDamage[id] === null ? [] : [{ id: effect.id, amount: effect.playerDamage[id]! }])
}
function markTurnCue(before: GameState, after: GameState) {
  if (before.currentPlayer !== humanPlayer.value && after.currentPlayer === humanPlayer.value && after.winner === null) turnCuePending = true
}
function maybePlayTurnCue() {
  if (turnCuePending && enabled.value) { turnCuePending = false; playTurnSound() }
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
  appendEffects(before, result.state, result.events)
  markTurnCue(before, result.state)
  maybePlayTurnCue()
  scheduleAi()
}
function scheduleAi() {
  clearTimeout(aiTimer)
  aiTimer = undefined
  if (view.value !== 'game' || !aiTurn.value || !game.value || game.value.winner !== null) return
  aiTimer = setTimeout(async () => {
    aiTimer = undefined
    if (view.value !== 'game' || !aiTurn.value || !game.value || game.value.winner !== null) return
    const before = game.value
    const client = ai ??= new AiClient()
    const action = await client.choose(before)
    if (ai === client && game.value === before && view.value === 'game' && aiTurn.value && action) perform(action)
  }, 450)
}
function selectHand(id: string) {
  if (!enabled.value) return
  const previous = selectedHand.value
  clearSelection()
  selectedHand.value = previous === id ? null : id
}
function selectAttacker(id: string) {
  const previous = selectedAttacker.value
  clearSelection()
  selectedAttacker.value = previous === id ? null : id
}
function startHandDrag(id: string, event: DragEvent) {
  if (!enabled.value || !current.value?.hand.includes(id) || !event.dataTransfer) { event.preventDefault(); return }
  clearSelection()
  selectedHand.value = id
  draggedCard.value = id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(HAND_DRAG_TYPE, id)
}
function useCardAt(destination: CardDestination, event?: DragEvent) {
  if (!enabled.value || !game.value || !selectedCard.value || !selectedHand.value || !current.value?.hand.includes(selectedHand.value)) return
  // Only a drag begun in this hand can mutate this match. Ignore external/stale drops.
  if (event && (!draggedCard.value || draggedCard.value !== selectedHand.value || event.dataTransfer?.getData(HAND_DRAG_TYPE) !== draggedCard.value)) return
  draggedCard.value = null
  if (destination.type === 'sell') {
    send({ type: 'SELL_CARD', player: game.value.currentPlayer, cardId: selectedHand.value })
    return
  }
  if (destination.type === 'battlefield') {
    if (destination.location.playerId !== displayPlayer.value) { error.value = '人物只能打到己方场地。'; return }
    if (destination.location.slot < 1 || destination.location.slot > BOARD_LIMIT) return
    if (selectedCard.value.type !== 'character') { error.value = '事件牌请放到右侧事件区域。'; return }
  } else if (selectedCard.value.type !== 'event') { error.value = '人物牌请放到己方场地。'; return }
  if (!canPlay.value) { error.value = playIssue.value; return }
  send({ type: 'PLAY_CARD', player: game.value.currentPlayer, cardId: selectedHand.value })
}
function handType(id: string) {
  const card = cardDefinitions[id]!
  return card.type === 'character' ? card.faction : '事件'
}
function handFactionClass(id: string) {
  const card = cardDefinitions[id]!
  return card.type === 'character' ? FACTION_CLASSES[card.faction] : 'faction-event'
}
function selectBoard(id: string, friendly: boolean) {
  if (!enabled.value) return
  if (friendly) selectAttacker(id)
  else attack({ type: 'character', instanceId: id })
}
function attack(target: { type: 'player' } | { type: 'character'; instanceId: string }) {
  if (attackReady.value && game.value && selectedAttacker.value) send({ type: 'ATTACK', player: game.value.currentPlayer, attackerId: selectedAttacker.value, target })
}
</script>

<template>
  <main :class="{ 'match-view': view === 'game' }">
    <header class="page-header">
      <div><span class="eyebrow">CULTURAL REVOLUTION: THE GAME · v{{ version }}</span><h1>文革杀 <span>{{ view === 'game' ? (mode === 'ai' ? '玩家 vs AI 2.0' : '双人联机') : view === 'home' ? '横扫一切牛鬼蛇神' : view === 'rules' ? '游戏规则' : view === 'lobby' ? '双人联机' : '了解卡牌' }}</span></h1></div>
      <div v-if="view !== 'home'" class="header-actions"><span v-if="view === 'game' && mode === 'online'" class="connection-status">{{ onlineStatus.phase === 'closed' ? '连接中断' : `${onlineStatus.isHost ? '房主' : '加入者'} · 已连接` }}</span><button v-if="view === 'game' && mode === 'ai'" @click="startGame">重新开始</button><button v-if="view === 'game' && mode === 'online' && onlineStatus.isHost && game?.winner !== null" :disabled="!onlineStatus.ready" @click="online?.rematch()">再来一局</button><button @click="exit">返回</button></div>
    </header>
    <section v-if="view === 'home'" class="welcome">
      <h2>一张桌面，两种对战。</h2><p>每人 24 张人物、6 张事件，均匀穿插；每回合 {{ DEFAULT_RULES.energyPerTurn }} 行动力、抽 {{ DEFAULT_RULES.drawPerTurn }} 张。</p>
      <p v-if="DEFAULT_RULES.secondPlayerOpeningBonus">后手首回合额外 +{{ DEFAULT_RULES.secondPlayerOpeningBonus }} 行动力；双方起手 5 张，首回合不额外抽牌。</p>
      <div class="mode-options">
        <button class="mode-button" @click="openOnline"><strong>双人联机</strong><span>创建房间，分享 ID，与朋友在线对战。</span><small>双方各用自己的浏览器，随机先后手。</small></button>
        <button class="mode-button" @click="startGame"><strong>AI对战</strong><span>随机先后手，与AI 2.0 对战。</span><small>AI 2.0 规划整回合行动，并考虑对手反击。</small></button>
      </div>
      <div class="welcome-actions"><button @click="view = 'rules'">游戏规则</button><button @click="view = 'cards'">了解卡牌</button></div>
      <p class="muted">基础战斗、派别克制、关系加成与全部 SR / SSR 技能已就绪。</p>
    </section>
    <CardGallery v-else-if="view === 'cards'" />
    <GameRules v-else-if="view === 'rules'" />
    <OnlineLobby v-else-if="view === 'lobby'" :status="onlineStatus" :error="error" @host="connectOnline()" @join="connectOnline" />
    <template v-else-if="game && current && opponent">
      <MatchResult v-if="game.winner !== null && effects.length === 0" :winner="game.winner" :human-player="humanPlayer" />
      <p class="orientation-hint">竖屏可左右滑动查看场牌和手牌；横屏能同时看到更多卡牌。</p>
      <p v-if="mode === 'online' && onlineStatus.phase === 'closed'" class="online-warning" role="alert">{{ onlineStatus.message }}</p>
      <div class="game-layout" @keydown.esc="clearSelection">
        <section class="table" aria-label="对战桌面">
          <div class="battle-row enemy-row">
            <PlayerArea :player="opponent" :label="playerName(opponent.id)" :active="game.currentPlayer === opponent.id && game.winner === null" :damage-effects="playerEffects(opponent.id)" :targetable="attackReady && !guarded" @attack="attack({ type: 'player' })" />
            <div class="battle-cards">
              <Battlefield :board="opponent.board" :player-id="opponent.id" :friendly="false" :selected-id="null" :enabled="enabled"
                :active-event="game.activeEvent?.id" :effects="boardEffects(opponent.id)"
                :targeting="attackReady" :selecting="selectingCard" :dragging="!!draggedCard"
                @place="(location, event) => useCardAt({ type: 'battlefield', location }, event)"
                @select="id => selectBoard(id, false)" />
            </div>
          </div>
          <div class="battle-divider">
            <div class="turn-bar"><b v-if="game.winner !== null">{{ playerName(game.winner) }} 获胜</b><b v-else>第 {{ Math.ceil(game.turn / 2) }} 轮 · {{ playerName(game.currentPlayer) }}的回合</b><small v-if="mode === 'ai'">本局{{ humanPlayer === 0 ? '你先手' : ' AI 先手' }}</small></div>
            <div class="table-status">
              <div class="hidden-hand" :class="{ revealed: !!handReveal }" :aria-label="`对方手牌 ${opponent.hand.length} 张`">
                <div class="opponent-hand-cards" :role="handReveal ? 'status' : undefined">
                  <template v-if="handReveal">
                    <span v-for="id in handReveal.cards" :key="id" class="revealed-card-name" :class="handFactionClass(id)" :title="handType(id)">{{ cardDefinitions[id]!.name }}</span>
                    <span v-if="handReveal.cards.length === 0" class="revealed-card-name">无手牌</span>
                  </template>
                  <template v-else><span v-for="n in Math.min(opponent.hand.length, 12)" :key="n" class="card-back">◆</span></template>
                </div>
                <small><template v-if="handReveal">「{{ ABILITIES.REVEAL_HAND.name }}」 · </template>对方手牌 · {{ opponent.hand.length }} 张</small>
              </div>
              <p v-if="!handReveal || error" class="turn-hint" :class="{ error: !!error || !!playIssue }" :role="error ? 'alert' : undefined" :title="error || turnHint">{{ error || turnHint }}</p>
            </div>
          </div>
          <div class="battle-row friendly-row">
            <PlayerArea :player="current" :label="playerName(current.id)" :active="game.currentPlayer === current.id && game.winner === null" :damage-effects="playerEffects(current.id)" />
            <div class="battle-cards">
              <Battlefield :board="current.board" :player-id="current.id" :friendly="true" :selected-id="selectedAttacker" :enabled="enabled"
                :active-event="game.activeEvent?.id" :effects="boardEffects(current.id)"
                :selecting="selectingCard" :accepted="!!canPlay && selectedCard?.type === 'character'" :dragging="!!draggedCard"
                @place="(location, event) => useCardAt({ type: 'battlefield', location }, event)"
                @select="id => selectBoard(id, true)" />
            </div>
          </div>
          <ActiveEvent :event="game.activeEvent" :selecting="selectingCard" :accepted="!!canPlay && selectedCard?.type === 'event'" :dragging="!!draggedCard"
            @use="useCardAt({ type: 'event' })" @drop="event => useCardAt({ type: 'event' }, event)" />
        </section>
        <section class="hand-zone" aria-label="手牌与回合操作">
          <SellSlot :enabled="canSell" :gain="selectedCard?.cost ?? null" :dragging="!!draggedCard"
            @use="useCardAt({ type: 'sell' })" @drop="event => useCardAt({ type: 'sell' }, event)" />
          <Hand :cards="current.hand" :selected-id="selectedHand" :enabled="enabled" :aria-label="`${playerName(current.id)} 的手牌`" @select="selectHand"
            @drag-start="startHandDrag" @drag-end="draggedCard = null" />
          <div class="turn-actions">
            <div class="energy-info" aria-label="当前行动力"><span>行动力</span><b>{{ current.mana }}</b><small>基础 {{ current.maxMana }}</small></div>
            <button :disabled="!enabled" class="primary-button end-turn-button" @click="send({ type: 'END_TURN', player: game.currentPlayer })">结束回合</button>
          </div>
        </section>
        <aside class="sidebar"><section><h2>对局记录</h2><ol class="game-log" aria-live="polite"><li v-for="(message, index) in recentLog" :key="`${game.turn}-${index}`">{{ message }}</li></ol></section></aside>
      </div>
    </template>
    <footer>浏览器卡牌游戏 · 无账号 · AI 可离线游玩 · 联机需要互联网</footer>
  </main>
</template>
