<script setup lang="ts">
import CharacterCard from './CharacterCard.vue'
import { definitions } from '../data'
defineProps<{ cards: string[]; selectedId: string | null; enabled: boolean }>()
defineEmits<{ select: [id: string] }>()
</script>

<template>
  <div class="hand">
    <CharacterCard v-for="id in cards" :key="id" :card="definitions[id]!"
      :selected="selectedId === id" :disabled="!enabled" @select="$emit('select', id)" />
    <p v-if="cards.length === 0" class="muted">暂无手牌</p>
  </div>
</template>
