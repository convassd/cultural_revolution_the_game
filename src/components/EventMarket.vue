<script setup lang="ts">
import EventCard from './EventCard.vue'
import { EVENT_UNLOCK_TURN } from '../game/rules'
import { eventDefinitions } from '../data/events'
import type { GameState } from '../game/types'
defineProps<{ pool: GameState['eventPool']; turn: number; selectedId: string | null; enabled: boolean }>()
defineEmits<{ select: [id: string] }>()
</script>

<template>
  <section class="event-market" aria-label="公共事件卡池">
    <div v-for="(id, index) in pool.slots" :key="index" class="event-slot" :class="`event-slot-${index}`">
      <EventCard v-if="id" :card="eventDefinitions[id]!" :selected="selectedId === id" :disabled="!enabled" @select="$emit('select', id)" />
      <div v-else class="empty-event"><b>公共事件</b><small><template v-if="turn < EVENT_UNLOCK_TURN">第 {{ Math.ceil(EVENT_UNLOCK_TURN / 2) }} 轮玩家 2 回合开放</template><template v-else>卡池已空</template></small></div>
    </div>
    <div class="event-market-info"><b>公共事件 · {{ pool.deck.length }} 张待补</b><small>{{ pool.usedThisTurn ? '本回合已使用' : '每回合限用 1 张' }}</small></div>
  </section>
</template>
