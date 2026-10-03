<script setup lang="ts">
import CharacterCard from './CharacterCard.vue'
import { computed, ref } from 'vue'
import { characters } from '../data'
import { queryCards } from '../data/catalog'
import type { CardSortKey, SortDirection } from '../data/catalog'
import { FACTIONS } from '../game/rules'
import type { Faction } from '../game/types'

const faction = ref<Faction | 'all'>('all')
const sortKey = ref<CardSortKey>('rarity')
const direction = ref<SortDirection>('desc')
const visibleCards = computed(() => queryCards(characters, faction.value, sortKey.value, direction.value))
</script>

<template>
  <section class="card-gallery" aria-label="全部人物卡牌">
    <div class="gallery-heading"><h2>了解卡牌</h2><p>全部 {{ characters.length }} 张人物卡 · R / SR / SSR</p></div>
    <p class="muted">SR / SSR 技能均已实现。排序使用卡牌原始属性，同组加成和复出变化只在对局中计算。</p>
    <div class="gallery-controls">
      <label>派别<select v-model="faction"><option value="all">全部派别</option><option v-for="item in FACTIONS" :key="item" :value="item">{{ item }}</option></select></label>
      <label>排序<select v-model="sortKey"><option value="rarity">稀有度</option><option value="cost">cost / 费用</option><option value="attack">attack / 攻击</option><option value="health">health / 生命</option></select></label>
      <label>顺序<select v-model="direction"><option value="desc">从高到低</option><option value="asc">从低到高</option></select></label>
      <span class="muted" role="status">显示 {{ visibleCards.length }} / {{ characters.length }} 张</span>
    </div>
    <div class="gallery-grid"><CharacterCard v-for="card in visibleCards" :key="card.id" :card="card" disabled /></div>
    <p v-if="visibleCards.length === 0" class="muted">没有符合条件的卡牌。</p>
  </section>
</template>
