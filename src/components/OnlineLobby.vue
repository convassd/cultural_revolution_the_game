<script setup lang="ts">
import { ref } from 'vue'
import type { OnlineStatus } from '../online/session'
defineProps<{ status: OnlineStatus; error: string }>()
defineEmits<{ host: []; join: [id: string] }>()
const roomId = ref('')
const copyMessage = ref('')
async function copy(id: string) {
  try { await navigator.clipboard.writeText(id); copyMessage.value = '已复制房间 ID。' }
  catch { copyMessage.value = '请选中房间 ID，手动复制。' }
}
</script>

<template>
  <section class="online-lobby">
    <h2>双人联机</h2>
    <p>一人创建房间，分享 ID；另一人输入 ID 加入。连接成功后自动开局，随机先后手。</p>
    <div v-if="status.phase === 'idle'" class="lobby-options">
      <section><h3>创建房间</h3><p>由你的浏览器主持对局，请保持页面打开。</p><button class="primary-button" @click="$emit('host')">创建房间</button></section>
      <form @submit.prevent="$emit('join', roomId)"><h3>加入朋友</h3><label for="room-id">朋友的房间 ID</label><input id="room-id" :value="roomId" @input="roomId = ($event.target as HTMLInputElement).value" placeholder="粘贴房间 ID" autocomplete="off" spellcheck="false" maxlength="100" /><button :disabled="!roomId.trim()" class="primary-button" type="submit">加入房间</button></form>
    </div>
    <div v-else class="lobby-progress" role="status">
      <p>{{ status.message }}</p>
      <template v-if="status.isHost && status.id && status.phase !== 'closed'">
        <label for="share-room-id">你的房间 ID</label><input id="share-room-id" :value="status.id" readonly />
        <button @click="copy(status.id)">复制 ID</button><small>{{ copyMessage }}</small>
      </template>
      <p v-if="status.phase === 'closed'">点击右上角“返回”后，可以重新创建或加入房间。</p>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p class="muted lobby-note">联机需要互联网。若长时间无法连接，请检查双方网络、换一个网络再试；刷新或离开页面会结束连接，暂不支持断线续局。</p>
  </section>
</template>

<style scoped>
.online-lobby { max-width: 850px; margin: 35px auto; padding: 28px; border: 1px solid #587367; border-radius: 16px; background: #203b34; }
h2 { margin: 0 0 14px; } h3 { margin: 0 0 12px; color: #f1d69d; }
p { line-height: 1.8; } .lobby-options { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 26px 0; }
.lobby-options > * { padding: 20px; background: #172f28; border: 1px solid #456153; border-radius: 10px; }
label { display: block; margin: 12px 0 6px; } input { width: 100%; padding: 10px; border: 1px solid #6d8175; border-radius: 6px; background: #102720; color: #f6dda4; font: inherit; }
button { margin-top: 12px; } .lobby-progress { padding: 20px 0; } .lobby-progress small { display: block; margin-top: 10px; }
.lobby-note { margin-top: 24px; font-size: 14px; } @media (max-width: 650px) { .lobby-options { grid-template-columns: 1fr; } .online-lobby { margin-top: 16px; padding: 20px; } }
</style>
