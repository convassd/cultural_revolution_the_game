<script setup lang="ts">
import { computed } from 'vue'
import type { EventDefinition } from '../game/types'

const props = defineProps<{ card: EventDefinition; selected?: boolean; disabled?: boolean }>()
defineEmits<{ select: [] }>()
const image = computed(() => `${import.meta.env.BASE_URL}${props.card.image.replace(/^\//, '')}`)
</script>

<template>
  <button type="button" class="event-card" :class="{ selected }" :disabled="disabled" :aria-pressed="selected ?? false"
    :aria-label="`${card.name}，事件，费用 ${card.cost}，${card.scope}`" @click="$emit('select')">
    <div class="event-heading"><span class="event-cost">{{ card.cost }}</span><span>事件 · {{ card.scope }}</span></div>
    <strong class="event-title">{{ card.name }}</strong>
    <div class="event-portrait"><img :src="image" alt="事件插画占位" /><small>插画待补</small></div>
    <p class="event-description" :title="card.description">{{ card.description }}</p>
    <div class="event-footer">公共卡池 · 使用后弃置</div>
  </button>
</template>

<style scoped>
.event-card { width: var(--card-width); height: var(--card-height); flex: 0 0 var(--card-width); min-width: 0; padding: 6px; border: 2px solid #a597af; border-radius: 9px; background: #ddd7dd; color: #382f3b; display: flex; flex-direction: column; text-align: left; box-shadow: 0 4px 7px #071a2055; }
.event-card:hover:not(:disabled) { background: #e9e2e9; border-color: #efd298; }
.event-card.selected { outline: 3px solid #f1ce78; outline-offset: 2px; }
.event-heading { display: flex; align-items: center; gap: 7px; font-size: 11px; flex-shrink: 0; }
.event-cost { display: grid; place-items: center; width: 21px; height: 21px; background: #685474; color: white; border-radius: 4px; font-size: 14px; font-weight: 700; }
.event-title { margin: 4px 0; text-align: center; font-size: 14px; line-height: 1.3; flex-shrink: 0; }
.event-portrait { position: relative; height: calc(var(--card-height) * .18); flex-shrink: 0; overflow: hidden; border-radius: 3px; }
.event-portrait img { width: 100%; height: 100%; object-fit: cover; display: block; }
.event-portrait small { position: absolute; inset: 0; display: grid; place-items: center; color: #80786c; font-size: 10px; }
.event-description { flex: 1; min-height: 0; overflow-y: auto; margin: 5px 0; font-size: 12px; line-height: 1.45; scrollbar-width: thin; }
.event-footer { border-top: 1px solid #bcb0c2; padding-top: 3px; color: #746578; font-size: 10px; text-align: center; flex-shrink: 0; }
</style>
