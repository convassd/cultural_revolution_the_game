<script setup lang="ts">
import { computed } from 'vue'
import CharacterCard from './CharacterCard.vue'
import { definitions } from '../data'
import type { PresentedCharacter } from '../presentation/battle'

const props = defineProps<{
  presentation: PresentedCharacter
  selected: boolean
  disabled: boolean
  status: string
  details: string[]
}>()
defineEmits<{ select: [] }>()
const cardProps = computed(() => ({
  card: definitions[props.presentation.character.definitionId]!,
  attack: props.presentation.attack,
  health: Math.max(0, props.presentation.character.health),
  faction: props.presentation.faction,
  status: props.presentation.dying ? '已死亡' : props.status,
  details: props.details,
}))
const fragments = [
  { clip: 'polygon(0 0, 50% 0, 38% 40%, 0 32%)', x: '-32px', y: '-24px', rotate: '-17deg' },
  { clip: 'polygon(50% 0, 100% 0, 100% 35%, 38% 40%)', x: '32px', y: '-28px', rotate: '16deg' },
  { clip: 'polygon(0 32%, 38% 40%, 52% 65%, 0 70%)', x: '-45px', y: '8px', rotate: '-22deg' },
  { clip: 'polygon(38% 40%, 100% 35%, 100% 65%, 52% 65%)', x: '45px', y: '12px', rotate: '23deg' },
  { clip: 'polygon(0 70%, 52% 65%, 60% 100%, 0 100%)', x: '-24px', y: '44px', rotate: '-14deg' },
  { clip: 'polygon(52% 65%, 100% 65%, 100% 100%, 60% 100%)', x: '30px', y: '48px', rotate: '20deg' },
]
</script>

<template>
  <div class="board-card" :class="{ 'taking-damage': presentation.damage !== null, dying: presentation.dying, returning: presentation.returned }">
    <CharacterCard class="board-card-face" v-bind="cardProps" :selected="selected" :disabled="disabled || presentation.dying" @select="$emit('select')" />
    <template v-if="presentation.dying">
      <svg class="death-cracks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M50 0L38 40L52 65L60 100M0 32L38 40L100 35M0 70L52 65L100 65" /></svg>
      <div class="death-fragments" aria-hidden="true" inert>
        <div v-for="(fragment, index) in fragments" :key="index" class="death-fragment"
          :style="{ clipPath: fragment.clip, '--fragment-x': fragment.x, '--fragment-y': fragment.y, '--fragment-rotate': fragment.rotate }">
          <CharacterCard v-bind="cardProps" disabled />
        </div>
      </div>
      <span class="death-label">已死亡</span>
    </template>
    <span v-if="presentation.damage !== null" class="damage-number" :class="{ blocked: presentation.damage === 0 }" role="status"
      :aria-label="`受到 ${presentation.damage} 点伤害`">{{ presentation.damage === 0 ? '0' : `−${presentation.damage}` }}</span>
    <span v-if="presentation.returned" class="return-label">复出</span>
  </div>
</template>
