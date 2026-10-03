<script setup lang="ts">
import type { PlayerState } from '../game/types'
defineProps<{ player: PlayerState; active: boolean; label?: string; targetable?: boolean; damage?: number | null }>()
defineEmits<{ attack: [] }>()
</script>

<template>
  <div class="player-area" :class="{ active }">
    <span v-if="damage !== undefined && damage !== null" class="damage-number player-damage-number" :class="{ blocked: damage === 0 }" role="status" :aria-label="`玩家 ${player.id + 1} 受到 ${damage} 点伤害`">{{ damage === 0 ? '0' : `−${damage}` }}</span>
    <div class="player-identity"><span class="player-avatar">P{{ player.id + 1 }}</span><div><strong>{{ label ?? `玩家 ${player.id + 1}` }}</strong><small>{{ active ? '当前回合' : '等待回合' }}</small></div></div>
    <div class="player-metrics"><span class="hp">♥ {{ player.hp }} <small>HP</small></span><span>行动力 <b>{{ player.mana }} / {{ player.maxMana }}</b></span><span>牌库 <b>{{ player.deck.length }}</b></span><span>手牌 <b>{{ player.hand.length }}</b></span><span>弃牌 <b>{{ player.discard.length }}</b></span><span v-if="player.pendingReturns.length">待复出 <b>{{ player.pendingReturns.length }}</b></span></div>
    <button v-if="targetable" class="danger-button" @click="$emit('attack')">攻击{{ label ?? `玩家 ${player.id + 1}` }}</button>
  </div>
</template>
