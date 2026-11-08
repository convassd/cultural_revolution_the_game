<script setup lang="ts">
import CharacterCard from './CharacterCard.vue'
import EventCard from './EventCard.vue'
import { cardDefinitions } from '../data'
import type { CharacterDefinition, EventDefinition } from '../game/types'
defineProps<{ cards: string[]; selectedId: string | null; enabled: boolean }>()
defineEmits<{ select: [id: string]; dragStart: [id: string, event: DragEvent]; dragEnd: [] }>()
</script>

<template>
  <div class="hand">
    <template v-for="id in cards" :key="id">
      <CharacterCard v-if="cardDefinitions[id]!.type === 'character'" :card="cardDefinitions[id] as CharacterDefinition"
        :selected="selectedId === id" :disabled="!enabled" :draggable="enabled" :data-card-id="id"
        @select="$emit('select', id)" @dragstart="$emit('dragStart', id, $event)" @dragend="$emit('dragEnd')" />
      <EventCard v-else :card="cardDefinitions[id] as EventDefinition"
        :selected="selectedId === id" :disabled="!enabled" :draggable="enabled" :data-card-id="id"
        @select="$emit('select', id)" @dragstart="$emit('dragStart', id, $event)" @dragend="$emit('dragEnd')" />
    </template>
    <p v-if="cards.length === 0" class="muted">暂无手牌</p>
  </div>
</template>
