<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="not-found">
    <h1>404</h1>
    <p>页面不存在</p>
    <button @click="router.push('/editor')">返回编辑器</button>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}
.not-found h1 {
  margin: 0;
  font-size: 72px;
  color: var(--fg-mute);
}
.not-found p {
  margin: 0;
  color: var(--fg-mute);
}
.not-found button {
  padding: 8px 16px;
  background: var(--accent);
  color: var(--accent-fg);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
