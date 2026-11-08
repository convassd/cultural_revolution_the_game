<script setup lang="ts">
import EventCard from './EventCard.vue'
import { ref } from 'vue'
import { eventDefinitions } from '../data/events'
import type { GameState } from '../game/types'
defineProps<{ event: GameState['activeEvent']; selecting?: boolean; accepted?: boolean; dragging?: boolean }>()
const emit = defineEmits<{ use: []; drop: [event: DragEvent] }>()
const hovering = ref(false)
</script>

<template>
  <section class="active-event" aria-label="当前事件">
    <b class="active-event-label">当前事件 · 双方共享</b>
    <div class="event-drop-zone" :class="{ selecting, 'drop-ready': accepted, 'drop-hover': accepted && dragging && hovering }"
      :role="selecting ? 'button' : undefined" :tabindex="selecting ? 0 : undefined" aria-label="事件区域"
      @click="emit('use')" @keydown.enter.self.prevent="emit('use')" @keydown.space.self.prevent="emit('use')"
      @dragover.prevent="hovering = true" @dragleave="hovering = false" @drop.prevent="hovering = false; emit('drop', $event)">
      <EventCard v-if="event" :card="eventDefinitions[event.id]!" disabled />
      <div v-else class="empty-event"><b>暂无事件</b><small>选中事件牌后点击这里<br />或将事件牌拖到这里</small></div>
    </div>
    <small v-if="event" class="active-event-label">玩家 {{ event.owner + 1 }} 打出 · 持续至被替换</small>
  </section>
</template>
