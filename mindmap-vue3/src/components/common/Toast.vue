<script setup lang="ts">
/**
 * 全局 Toast 容器
 * 监听 useToastStore.items, 自动渲染
 */
import { useToastStore } from '@/composables/useToast';

const toast = useToastStore();
</script>

<template>
  <div v-if="toast.items.length > 0" class="toast-container" role="status" aria-live="polite">
    <div v-for="item in toast.items" :key="item.id" :class="['toast', `toast-${item.level}`]">
      <span class="toast-msg">{{ item.message }}</span>
      <button class="toast-close" aria-label="close" @click="toast.dismiss(item.id)">×</button>
    </div>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 64px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 2000;
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 240px;
  max-width: 480px;
  padding: 10px 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: var(--shadow);
  pointer-events: auto;
  font-size: 13px;
}
.toast-info {
  border-left: 4px solid var(--accent);
}
.toast-success {
  border-left: 4px solid #16a34a;
}
.toast-warn {
  border-left: 4px solid #f59e0b;
}
.toast-error {
  border-left: 4px solid var(--danger);
}
.toast-msg {
  flex: 1;
}
.toast-close {
  background: transparent;
  color: var(--fg-mute);
  border: none;
  cursor: pointer;
  padding: 0 4px;
  font-size: 18px;
  line-height: 1;
}
.toast-close:hover {
  color: var(--fg);
}
</style>
