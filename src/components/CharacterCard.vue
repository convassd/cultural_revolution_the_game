<script setup lang="ts">
import { computed } from 'vue'
import { ABILITIES, isAbilityImplemented } from '../data/abilities'
import { FACTION_CLASSES } from '../presentation/factions'
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
const currentFaction = computed(() => props.faction ?? props.card.faction)
// JSON paths stay easy to replace; the build also works below a host subdirectory.
const portrait = computed(() => `${import.meta.env.BASE_URL}${props.card.image.replace(/^\//, '')}`)
</script>

<template>
  <button type="button" class="character-card" :class="[card.rarity.toLowerCase(), FACTION_CLASSES[currentFaction], { selected }]"
    :disabled="disabled" :aria-pressed="selected ?? false" :aria-label="`${card.name}，费用 ${card.cost}，攻击 ${attack ?? card.attack}，生命 ${health ?? card.health}`"
    @click="$emit('select')">
    <div class="card-heading"><span class="cost" title="费用">{{ card.cost }}</span><strong>{{ card.name }}</strong><span class="rarity">{{ card.rarity }}</span></div>
    <div class="portrait">
      <img :src="portrait" :alt="`${card.name}的卡牌插画`" /><span class="faction">{{ currentFaction }}</span>
      <div v-if="details?.length" class="card-state-tags"><span v-for="detail in details" :key="detail">{{ detail }}</span></div>
    </div>
    <div class="skill-text" :title="[ability ? `${ability.name}：${ability.description}` : '无技能', card.relationGroup ? `关系组：${GROUP_NAMES[card.relationGroup]}` : null].filter(Boolean).join('\n')">
      <template v-if="ability"><strong>{{ ability.name }}</strong><span v-if="card.abilityId && !isAbilityImplemented(card.abilityId)" class="pending">暂未实现</span><p>{{ ability.description }}</p></template>
      <p v-else class="no-skill">无技能</p>
      <small v-if="card.relationGroup">{{ GROUP_NAMES[card.relationGroup] }}</small>
    </div>
    <div class="card-stats"><span class="attack" :class="{ buffed: (attack ?? card.attack) > card.attack, debuffed: (attack ?? card.attack) < card.attack }" title="当前攻击力">⚔ {{ attack ?? card.attack }}</span><small>{{ status || '人物' }}</small><span class="health" title="当前生命">♥ {{ health ?? card.health }}</span></div>
  </button>
</template>

<style scoped>
/* One card-face template for the gallery, hand, battlefield and death fragments.
   Viewport dimensions are inherited from the shared variables in style.css. */
.character-card {
  --card-bg: #e5dcc7;
  --card-hover: #f1e7d0;
  width: var(--card-width);
  height: var(--card-height);
  min-width: 0;
  min-height: 0;
  padding: 4px;
  border: 2px solid #9c947e;
  border-radius: 11px;
  background: var(--card-bg);
  color: #302f29;
  text-align: left;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 7px #071a2055;
  transition: border-color .12s;
}
.character-card:hover:not(:disabled) { background: var(--card-hover); border-color: #f6d079; }
.character-card.faction-conservative { --card-bg: #d9e1e5; --card-hover: #e3e9eb; }
.character-card.faction-rebel { --card-bg: #e7d7d0; --card-hover: #eee1db; }
.character-card.faction-military { --card-bg: #dae0ce; --card-hover: #e5e8db; }
.character-card.sr { border-color: #73988f; }
.character-card.ssr { border-color: #c29b4e; }
.character-card.selected { outline: 3px solid #f1ce78; outline-offset: 2px; }
.targeting .character-card { border-color: #dc9273; }
.card-heading { display: flex; align-items: center; min-height: 22px; gap: 3px; margin-bottom: 3px; flex-shrink: 0; }
.card-heading strong { font-size: 14px; white-space: nowrap; }
.rarity { margin-left: auto; font-size: 11px; font-weight: 700; color: #726043; }
.cost { display: grid; place-items: center; background: #436a80; color: white; width: 21px; height: 21px; border-radius: 50%; font-size: 14px; font-weight: 700; flex-shrink: 0; }
.portrait { position: relative; flex-shrink: 0; height: calc(var(--card-height) * .32); background: #303a3022; border-radius: 4px; }
.portrait img { display: block; height: 100%; width: auto; max-width: 100%; margin-inline: auto; aspect-ratio: 5 / 3; object-fit: cover; border-radius: 4px; }
.faction { position: absolute; bottom: 2px; right: 2px; background: #323a30; color: #eee5c8; padding: 1px 3px; border-radius: 3px; font-size: 11px; }
.skill-text { flex: 1; min-height: 0; overflow: hidden; padding: 4px 1px 2px; font-size: 12px; line-height: 1.4; }
.skill-text p { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; font-size: 11px; line-height: 1.35; margin: 3px 0; }
.skill-text small { font-size: 11px; color: #716249; display: block; margin-top: 2px; }
.pending { display: inline-block; margin-left: 4px; padding: 1px 3px; font-size: 9px; color: #855746; background: #d9c6aa; border-radius: 3px; }
.no-skill { color: #877c66; }
.card-state-tags { display: flex; gap: 4px; position: absolute; top: 2px; left: 2px; right: 2px; flex-wrap: nowrap; overflow: hidden; padding: 0; }
.card-state-tags span { background: #fff7; color: #554e3f; border-radius: 3px; padding: 2px 4px; font-size: 10px; white-space: nowrap; }
.card-stats { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #bcb097; padding-top: 3px; flex-shrink: 0; gap: 2px; line-height: 1.2; }
.card-stats small { font-size: 11px; color: #6b695c; white-space: nowrap; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.attack, .health { font-size: 18px; font-weight: 800; white-space: nowrap; flex-shrink: 0; }
.attack { color: #856022; }
.attack.buffed { color: #2e7b45; }
.attack.debuffed { color: #a44038; }
.health { color: #9a3d34; }
@media (min-width: 900px) and (max-height: 700px) {
  .skill-text p { -webkit-line-clamp: 1; margin: 2px 0; }
  .skill-text small { display: none; }
}
@media (min-width: 900px) and (max-height: 620px) {
  .skill-text p:not(.no-skill) { display: none; }
}
</style>
