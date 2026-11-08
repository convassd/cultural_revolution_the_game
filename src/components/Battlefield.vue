<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import BoardCard from './BoardCard.vue'
import { definitions } from '../data'
import { ABILITIES } from '../data/abilities'
import { BOARD_LIMIT } from '../game/rules'
import { arrangeBoard, ghostKey, type BoardLayout } from '../presentation/boardLayout'
import { presentCharacter } from '../presentation/battle'
import type { BoardEffect, PresentedCharacter } from '../presentation/battle'
import type { CharacterInstance, EventId, PlayerId } from '../game/types'
import type { BattlefieldLocation } from '../presentation/cardInteraction'
const props = defineProps<{ board: CharacterInstance[]; playerId: PlayerId; friendly: boolean; selectedId: string | null; enabled: boolean; targeting?: boolean; effects?: BoardEffect[]; activeEvent?: EventId; selecting?: boolean; accepted?: boolean; dragging?: boolean }>()
const emit = defineEmits<{ select: [id: string]; place: [location: BattlefieldLocation, event?: DragEvent] }>()
const hoveredSlot = ref<number | null>(null)
const layout = shallowRef<BoardLayout>({ slots: [], ghosts: {} })
watch([() => props.board, () => props.effects], () => {
  layout.value = arrangeBoard(props.board, props.effects ?? [], layout.value)
}, { immediate: true })
const slots = computed(() => layout.value.slots.map(id => {
  const character = props.board.find(card => card.instanceId === id)
  return character ? presentCharacter(character, props.board, definitions, props.activeEvent) : null
}))
const reservedSlots = computed(() => new Set(Object.values(layout.value.ghosts)))
const overlays = computed(() => (props.effects ?? []).flatMap(effect => effect.slots.flatMap((card, index) => {
  if (!card || (card.damage === null && !card.dying && !card.returned)) return []
  const key = ghostKey(effect.id, card.character.instanceId)
  const liveIndex = layout.value.slots.indexOf(card.character.instanceId)
  return [{ key, card, index: card.dying ? (layout.value.ghosts[key] ?? index) : liveIndex >= 0 ? liveIndex : index }]
})))

function place(slot: number, event?: DragEvent) {
  if (!props.enabled || !props.selecting || slot > BOARD_LIMIT) return
  emit('place', { playerId: props.playerId, slot, instanceId: slots.value[slot - 1]?.character.instanceId }, event)
}
function slotBindings(slot: number) {
  return {
    'data-player-id': props.playerId, 'data-slot': slot <= BOARD_LIMIT ? slot : undefined,
    'data-instance-id': slots.value[slot - 1]?.character.instanceId,
    'aria-label': `${props.friendly ? '己方' : '敌方'}场地 ${slot}`,
    role: props.selecting && slot <= BOARD_LIMIT ? 'button' : undefined,
    tabindex: props.selecting && slot <= BOARD_LIMIT ? 0 : undefined,
    class: { 'card-destination': props.selecting, 'drop-ready': props.accepted && slot <= BOARD_LIMIT,
      'drop-hover': props.accepted && props.dragging && hoveredSlot.value === slot },
    onClickCapture: (event: MouseEvent) => {
      if (props.selecting) { event.stopPropagation(); place(slot) }
    },
    onKeydown: (event: KeyboardEvent) => {
      if (event.target === event.currentTarget && props.selecting && ['Enter', ' '].includes(event.key)) {
        event.preventDefault(); place(slot)
      }
    },
    onDragover: (event: DragEvent) => { if (props.dragging) { event.preventDefault(); hoveredSlot.value = slot } },
    onDragleave: () => { hoveredSlot.value = null },
    onDrop: (event: DragEvent) => { event.preventDefault(); hoveredSlot.value = null; place(slot, event) },
  }
}

function disabled(card: PresentedCharacter): boolean {
  return !props.enabled || card.dying || (props.friendly ? !card.character.canAttack : !props.targeting)
}

function details(character: CharacterInstance): string[] {
  const result: string[] = []
  if (character.countdown !== undefined) result.push(`${ABILITIES.LIN_COUNTDOWN.name} ${character.countdown}`)
  if (character.returnCount !== undefined) result.push(`复出 ${character.returnCount} / 3`)
  if (character.commandRoll !== undefined) result.push(`指令骰 ${character.commandRoll}${character.commandRoll >= 3 && character.commandRoll <= 5 ? '' : ' · 停攻'}`)
  return result
}
</script>

<template>
  <div class="battlefield" :class="{ targeting, 'has-extra-slots': slots.length > BOARD_LIMIT }" :style="{ '--battle-slot-count': slots.length }">
    <template v-for="slot in slots.length" :key="slots[slot - 1]?.character.instanceId ?? `empty-${slot}`">
      <BoardCard v-if="slots[slot - 1]" :presentation="slots[slot - 1]!" v-bind="slotBindings(slot)"
        :details="details(slots[slot - 1]!.character)"
        :selected="selectedId === slots[slot - 1]!.character.instanceId"
        :disabled="disabled(slots[slot - 1]!)"
        :status="friendly ? (slots[slot - 1]!.character.canAttack ? '可攻击' : '休息中') : '敌方角色'"
        @select="$emit('select', slots[slot - 1]!.character.instanceId)" />
      <div v-else class="empty-slot" v-bind="slotBindings(slot)" :class="{ 'reserved-slot': reservedSlots.has(slot - 1) }" :aria-hidden="reservedSlots.has(slot - 1) && !selecting || undefined"><span>＋</span><small>场地 {{ slot }}</small></div>
    </template>
    <div v-for="effect in overlays" :key="effect.key" class="battle-effect" :style="{ '--effect-slot': effect.index }" aria-live="polite">
      <BoardCard :presentation="effect.card" effect-only :details="details(effect.card.character)" :selected="false" disabled status="" />
    </div>
  </div>
</template>
