<script setup lang="ts">
import { computed } from 'vue'
import BoardCard from './BoardCard.vue'
import { definitions } from '../data'
import { BOARD_LIMIT } from '../game/rules'
import { presentCharacter } from '../presentation/battle'
import type { PresentedCharacter } from '../presentation/battle'
import type { CharacterInstance } from '../game/types'
const props = defineProps<{ board: CharacterInstance[]; friendly: boolean; selectedId: string | null; enabled: boolean; targeting?: boolean; selectableIds?: string[]; presentation?: Array<PresentedCharacter | null> }>()
defineEmits<{ select: [id: string] }>()
const slots = computed(() => props.presentation ?? props.board.map(character => presentCharacter(character, props.board, definitions)))

function disabled(card: PresentedCharacter): boolean {
  return !props.enabled || card.dying || (props.selectableIds
    ? !props.selectableIds.includes(card.character.instanceId)
    : (props.friendly ? !card.character.canAttack : !props.targeting))
}

function details(character: CharacterInstance): string[] {
  const result: string[] = []
  if (character.countdown !== undefined) result.push(`折戟沉沙 ${character.countdown}`)
  if (character.returnCount !== undefined) result.push(`复出 ${character.returnCount} / 3`)
  if (character.commandRoll !== undefined) result.push(`指令骰 ${character.commandRoll}${character.commandRoll >= 3 && character.commandRoll <= 5 ? '' : ' · 停攻'}`)
  return result
}
</script>

<template>
  <div class="battlefield" :class="{ targeting }">
    <template v-for="slot in BOARD_LIMIT" :key="slots[slot - 1]?.character.instanceId ?? `empty-${slot}`">
      <BoardCard v-if="slots[slot - 1]" :presentation="slots[slot - 1]!"
        :details="details(slots[slot - 1]!.character)"
        :selected="selectedId === slots[slot - 1]!.character.instanceId"
        :disabled="disabled(slots[slot - 1]!)"
        :status="friendly ? (slots[slot - 1]!.character.canAttack ? '可攻击' : '休息中') : '敌方角色'"
        @select="$emit('select', slots[slot - 1]!.character.instanceId)" />
      <div v-else class="empty-slot"><span>＋</span><small>场地 {{ slot }}</small></div>
    </template>
  </div>
</template>
