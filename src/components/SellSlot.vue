<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ enabled: boolean; gain: number | null; dragging: boolean }>()
const emit = defineEmits<{ use: []; drop: [event: DragEvent] }>()
const hovering = ref(false)
</script>

<template>
  <button type="button" class="sell-slot" :class="{ 'drop-ready': enabled, 'drop-hover': enabled && dragging && hovering }"
    :disabled="!enabled" aria-label="卖牌区" :title="enabled ? `永久移除选中的手牌，获得 ${gain} 行动力` : '选中手牌，点击这里或拖到这里卖出'"
    @click="emit('use')" @dragover.prevent="hovering = true" @dragleave="hovering = false" @drop.prevent="hovering = false; emit('drop', $event)">
    <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 13h28M19 7h10l2 6M14 13l2 28h16l2-28M21 20v14M27 20v14" /></svg>
    <strong>卖牌</strong>
    <span v-if="gain !== null">+{{ gain }} 行动力</span>
    <small v-else>点击或拖入手牌</small>
    <small>永久移除</small>
  </button>
</template>
