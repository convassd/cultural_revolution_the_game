<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { PlayerId } from '../game/types'
import { playResultSound } from '../presentation/resultSound'

const props = defineProps<{ winner: PlayerId; humanPlayer: PlayerId }>()
const victory = computed(() => props.winner === props.humanPlayer)
const title = computed(() => victory.value ? '全面胜利' : '退出舞台')

onMounted(() => playResultSound(victory.value))
</script>

<template>
  <div class="match-result" :class="{ defeat: !victory }" role="status" aria-live="polite">
    <div class="result-banner">
      <span class="result-caption">对局结束</span>
      <h2>{{ title }}</h2>
      <span class="result-rule" aria-hidden="true"></span>
    </div>
  </div>
</template>

<style scoped>
.match-result {
  position: fixed; inset: 0; z-index: 100; display: grid; place-items: center;
  pointer-events: none; color: #ffe1a0;
  background: radial-gradient(ellipse at center, #171e20d9 0%, #10191b66 48%, transparent 75%);
  animation: result-fade 3.6s ease-out both;
}
.result-banner { text-align: center; padding: 32px 56px; animation: result-arrive 650ms cubic-bezier(.16, 1, .3, 1) both; }
.result-caption { font-size: 13px; letter-spacing: .45em; color: #cdb88c; }
h2 { margin: 14px 0 20px; font-size: clamp(44px, 7vw, 86px); font-weight: 900; letter-spacing: .15em; text-shadow: 0 3px 0 #4a3823, 0 0 36px #d3a04b88; }
.result-rule { display: block; height: 2px; background: linear-gradient(90deg, transparent, #e0b76f, transparent); }
.defeat { color: #d6dce1; }
.defeat .result-caption { color: #9faeb9; }
.defeat h2 { text-shadow: 0 3px 0 #28323b, 0 0 32px #829cb466; }
.defeat .result-rule { background: linear-gradient(90deg, transparent, #90a1b1, transparent); }
@keyframes result-arrive {
  from { opacity: 0; transform: translateY(20px) scale(.85); filter: blur(5px); }
  to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
@keyframes result-fade {
  0% { opacity: 0; } 12%, 78% { opacity: 1; } 100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) { .result-banner { animation: none; } }
</style>
