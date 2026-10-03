<script setup lang="ts">
import { computed } from 'vue'
import { ABILITIES, isAbilityImplemented } from '../data/abilities'
import { GROUP_NAMES } from '../game/rules'
import type { CharacterDefinition, Faction } from '../game/types'

const props = defineProps<{
  card: CharacterDefinition
  attack?: number
  health?: number
  selected?: boolean
  disabled?: boolean
  status?: string
  faction?: Faction
  details?: string[]
}>()
defineEmits<{ select: [] }>()
const ability = computed(() => props.card.abilityId ? ABILITIES[props.card.abilityId] : null)
const factionClasses: Record<Faction, string> = {
  '保守派': 'faction-conservative', '造反派': 'faction-rebel', '军队': 'faction-military', '无派别': 'faction-neutral',
}
const currentFaction = computed(() => props.faction ?? props.card.faction)
// JSON paths stay easy to replace; the build also works below a host subdirectory.
const portrait = computed(() => `${import.meta.env.BASE_URL}${props.card.image.replace(/^\//, '')}`)
</script>

<template>
  <button type="button" class="character-card" :class="[card.rarity.toLowerCase(), factionClasses[currentFaction], { selected }]"
    :disabled="disabled" :aria-pressed="selected ?? false" :aria-label="`${card.name}，费用 ${card.cost}，攻击 ${attack ?? card.attack}，生命 ${health ?? card.health}`"
    @click="$emit('select')">
    <div class="card-heading"><span class="cost" title="费用">{{ card.cost }}</span><strong>{{ card.name }}</strong><span class="rarity">{{ card.rarity }}</span></div>
    <div class="portrait"><img :src="portrait" :alt="`${card.name}的卡牌插画`" /><span class="faction">{{ currentFaction }}</span></div>
    <div class="skill-text">
      <template v-if="ability"><strong>{{ ability.name }}</strong><span v-if="card.abilityId && !isAbilityImplemented(card.abilityId)" class="pending">暂未实现</span><p>{{ ability.description }}</p></template>
      <p v-else class="no-skill">无技能</p>
      <small v-if="card.relationGroup">{{ GROUP_NAMES[card.relationGroup] }}</small>
    </div>
    <div v-if="details?.length" class="card-state-tags"><span v-for="detail in details" :key="detail">{{ detail }}</span></div>
    <div class="card-stats"><span class="attack" :class="{ buffed: (attack ?? card.attack) > card.attack, debuffed: (attack ?? card.attack) < card.attack }" title="当前攻击力">⚔ {{ attack ?? card.attack }}</span><small>{{ status || '人物' }}</small><span class="health" title="当前生命">♥ {{ health ?? card.health }}</span></div>
  </button>
</template>
