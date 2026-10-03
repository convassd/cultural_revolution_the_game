<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import Battlefield from './components/Battlefield.vue'
import CardGallery from './components/CardGallery.vue'
import Hand from './components/Hand.vue'
import MatchResult from './components/MatchResult.vue'
import PlayerArea from './components/PlayerArea.vue'
import { characters, definitions } from './data'
import { applyAction, createGame } from './game/engine'
import { chooseGreedyAction } from './game/ai'
import { BOARD_LIMIT, canAttackPlayer } from './game/rules'
import type { GameAction, GameState, PlayerId } from './game/types'
import { BATTLE_EFFECT_DURATION, createBattlePresentation } from './presentation/battle'
import type { BattlePresentation } from './presentation/battle'
import { prepareResultAudio, stopResultAudio } from './presentation/resultSound'

const game = shallowRef<GameState | null>(null)
const presentation = shallowRef<BattlePresentation | null>(null)
const displayPlayer = ref<PlayerId>(0)
const humanPlayer = ref<PlayerId>(0)
let effectTimer: ReturnType<typeof setTimeout> | undefined
let aiTimer: ReturnType<typeof setTimeout> | undefined
const mode = ref<'hotseat' | 'ai'>('hotseat')
const view = ref<'home' | 'cards' | 'game'>('home')
const selectedHand = ref<string | null>(null)
const selectedAttacker = ref<string | null>(null)
const passing = ref(false)
const error = ref('')
const current = computed(() => game.value?.players[displayPlayer.value])
const opponent = computed(() => game.value?.players[displayPlayer.value === 0 ? 1 : 0])
const aiTurn = computed(() => mode.value === 'ai' && !!game.value && game.value.currentPlayer !== humanPlayer.value)
const humanTurn = computed(() => !!game.value && !aiTurn.value)
const enabled = computed(() => humanTurn.value && game.value?.winner === null && !passing.value && !presentation.value)
const pendingTarget = computed(() => game.value?.pendingPlayTarget)
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
  if (aiTurn.value && game.value?.winner === null) return '贪心 AI 正在行动；你的手牌保留显示，操作暂停。'
  if (pendingTarget.value) return selectedCard.value?.abilityId === 'BUFF_ONE'
    ? '鼓舞：点击另一名己方角色（休息中的角色也可以）。'
    : '大字报：点击一名敌方角色。'
  if (selectedAttacker.value && !attackReady.value) return '该角色当前不能攻击。'
  if (attackReady.value) return guarded.value
    ? '敌方保卫在场，不能直接攻击玩家；可以攻击任意敌方角色。'
    : '选择敌方角色，或点击“攻击玩家”。'
  return '点击手牌打出；点击己方角色攻击。'
})

function clearSelection() {
  selectedHand.value = null
  selectedAttacker.value = null
  error.value = ''
}
function playerName(id: PlayerId) {
  return mode.value === 'ai' ? `${id === humanPlayer.value ? '你' : '贪心 AI'}（玩家 ${id + 1}）` : `玩家 ${id + 1}`
}
function startGame(nextMode: 'hotseat' | 'ai' = mode.value) {
  resetPresentation()
  prepareResultAudio()
  mode.value = nextMode
  // Seat 0 always opens in the engine; randomly assign the human to either seat.
  humanPlayer.value = nextMode === 'ai' && Math.random() < 0.5 ? 1 : 0
  game.value = createGame(characters)
  displayPlayer.value = nextMode === 'ai' ? humanPlayer.value : game.value.currentPlayer
  view.value = 'game'
  passing.value = false
  clearSelection()
  scheduleAi()
}
function exit() {
  resetPresentation()
  game.value = null
  view.value = 'home'
  passing.value = false
  clearSelection()
}
function resetPresentation() {
  clearTimeout(effectTimer)
  clearTimeout(aiTimer)
  effectTimer = undefined
  aiTimer = undefined
  presentation.value = null
  stopResultAudio()
}
onUnmounted(resetPresentation)
function send(action: GameAction) {
  if (!enabled.value || !game.value) return
  perform(action)
}
function perform(action: GameAction) {
  if (!game.value) return
  const before = game.value
  const result = applyAction(before, action, definitions)
  if (result.error) { error.value = result.error; return }
  game.value = result.state
  clearSelection()
  if (action.type === 'END_TURN' && mode.value === 'hotseat' && result.state.winner === null) passing.value = true
  presentation.value = createBattlePresentation(before, result.state, result.events, definitions)
  if (presentation.value) {
    effectTimer = setTimeout(() => {
      presentation.value = null
      effectTimer = undefined
      if (game.value && mode.value === 'hotseat') displayPlayer.value = game.value.currentPlayer
      scheduleAi()
    }, BATTLE_EFFECT_DURATION)
  } else {
    if (mode.value === 'hotseat') displayPlayer.value = result.state.currentPlayer
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
  if (pendingTarget.value) return
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
  <main>
    <header class="page-header">
      <div><span class="eyebrow">LOCAL CARD DUEL · v0.0</span><h1>文革杀 <span>{{ view === 'game' ? (mode === 'ai' ? '玩家 vs 贪心 AI' : '本地双人对战') : '本地卡牌对战' }}</span></h1></div>
      <div v-if="view !== 'home'" class="header-actions"><button v-if="view === 'game'" @click="startGame(mode)">重新开始</button><button @click="exit">退出</button></div>
    </header>
    <section v-if="view === 'home'" class="welcome">
      <h2>一张桌面，两种对战。</h2><p>48 张人物牌随机分配，行动力从 2 开始。</p>
      <div class="mode-options">
        <button class="mode-button" @click="startGame('hotseat')"><strong>双人对战</strong><span>与朋友在同一浏览器轮流操作。</span><small>交接时隐藏手牌，准备好再开始回合。</small></button>
        <button class="mode-button" @click="startGame('ai')"><strong>AI对战</strong><span>随机先后手，与贪心 AI 对战。</span><small>AI 单步评估出牌、换怪与打脸，择优行动。</small></button>
      </div>
      <div class="welcome-actions"><button @click="view = 'cards'">了解卡牌</button></div>
      <p class="muted">基础战斗、派别克制、关系加成与全部 SR / SSR 技能已就绪。</p>
    </section>
    <CardGallery v-else-if="view === 'cards'" />
    <template v-else-if="game && current && opponent">
      <MatchResult v-if="game.winner !== null && !presentation" :winner="game.winner" :mode="mode" :human-player="humanPlayer" />
      <div class="game-layout">
        <section class="table" aria-label="对战桌面">
          <PlayerArea :player="opponent" :label="playerName(opponent.id)" :active="game.currentPlayer === opponent.id && game.winner === null" :damage="presentation?.playerDamage[opponent.id]" :targetable="attackReady && !guarded && !pendingTarget" @attack="attack({ type: 'player' })" />
          <div class="hidden-hand" :aria-label="`对方手牌 ${opponent.hand.length} 张`"><span v-for="n in Math.min(opponent.hand.length, 12)" :key="n" class="card-back">◆</span><small>对方手牌 · {{ opponent.hand.length }} 张</small></div>
          <Battlefield :board="opponent.board" :friendly="false" :selected-id="null" :enabled="enabled"
            :presentation="presentation?.boards[opponent.id]"
            :targeting="attackReady || (!!pendingTarget && selectedCard?.abilityId === 'WEAKEN')"
            :selectable-ids="pendingTarget ? (selectedCard?.abilityId === 'WEAKEN' ? legalTargets : []) : undefined"
            @select="id => selectBoard(id, false)" />
          <div class="turn-bar"><div><b v-if="game.winner !== null">{{ playerName(game.winner) }} 获胜</b><b v-else-if="presentation">战斗结算中</b><b v-else>第 {{ game.turn }} 回合 · {{ playerName(game.currentPlayer) }}</b><small v-if="mode === 'ai'">本局{{ humanPlayer === 0 ? '你先手' : ' AI 先手' }}</small><small>{{ turnHint }}</small></div><button :disabled="!enabled || !!pendingTarget" class="primary-button" @click="send({ type: 'END_TURN', player: game.currentPlayer })">结束回合 / End Turn</button></div>
          <Battlefield :board="current.board" :friendly="true" :selected-id="selectedAttacker" :enabled="enabled"
            :presentation="presentation?.boards[current.id]"
            :targeting="!!pendingTarget && selectedCard?.abilityId === 'BUFF_ONE'"
            :selectable-ids="pendingTarget ? (selectedCard?.abilityId === 'BUFF_ONE' ? legalTargets : []) : undefined"
            @select="id => selectBoard(id, true)" />
          <PlayerArea :player="current" :label="playerName(current.id)" :active="game.currentPlayer === current.id && game.winner === null" :damage="presentation?.playerDamage[current.id]" />
          <div class="hand-toolbar"><b>{{ playerName(current.id) }} 的手牌</b><span v-if="selectedCard">{{ selectedCard.name }} · 费用 {{ selectedCard.cost }}</span><button :disabled="!canPlay" @click="play">打出人物</button></div>
          <p v-if="pendingTarget" class="target-prompt" role="status">{{ turnHint }} 人物已登场并支付费用，请完成目标选择。</p>
          <p v-if="selectedCard && !canPlay && !pendingTarget && !presentation" class="muted selection-hint">{{ current.board.length >= BOARD_LIMIT ? '场地已满（最多 5 人）' : `行动力不足：需要 ${selectedCard.cost}` }}</p>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <Hand v-if="!passing" :cards="current.hand" :selected-id="selectedHand" :enabled="enabled && !pendingTarget" @select="selectHand" />
          <div v-else class="handoff"><h2>请将操作交给玩家 {{ game.currentPlayer + 1 }}</h2><p>{{ presentation ? '正在显示战斗效果，结束后可交接。' : '准备好后再显示自己的手牌。' }}</p><button class="primary-button" :disabled="!!presentation" @click="passing = false">我是玩家 {{ game.currentPlayer + 1 }}，开始回合</button></div>
          <section v-if="!passing && game.revealedHand?.viewer === current.id" class="revealed-hand">
            <h2>洞察 · 玩家 {{ game.revealedHand.owner + 1 }} 的手牌快照</h2>
            <p class="muted">显示技能触发时的手牌，结束本回合后隐藏。</p>
            <Hand :cards="game.revealedHand.cards" :selected-id="null" :enabled="false" />
          </section>
        </section>
        <aside class="sidebar"><section><h2>对局记录</h2><ol class="game-log" aria-live="polite"><li v-for="(message, index) in recentLog" :key="`${game.turn}-${index}`">{{ message }}</li></ol></section><section class="rule-note"><h2>桌面规则</h2><p>造反派 → 保守派 → 军队 → 造反派：克制伤害 +1；无派别不参与克制。</p><p>同组 2 人攻击 +1，3 人以上 +2；成员离场后即时重算。</p><p>新登场角色先休息（冲锋除外）；每回合每人攻击一次。互殴同时结算，反击也计算克制。</p><p>保卫阻止直接攻击玩家，但不限制攻击其它角色。申辩每个玩家回合重置。</p><p>鼓舞 / 大字报在本回合结束时消失。SSR 技能自动触发，骰点、折戟沉沙、复出次数显示在卡面。</p><p class="muted">阵营是游戏机制分类；稀有度表示机制复杂度与收藏层级，不是历史评价。</p></section></aside>
      </div>
    </template>
    <footer>纯本地运行 · 无账号 · 无后端 · 图片可在 public/portraits 中替换</footer>
  </main>
</template>
