<script setup lang="ts">
import { onMounted } from 'vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppStatusBar from '@/components/layout/AppStatusBar.vue';
import Toast from '@/components/common/Toast.vue';
import { useUiStore } from '@/stores/ui';
import AiAssistant from '@/components/panels/AiAssistant.vue';

const ui = useUiStore();

onMounted(() => {
  // 初始化主题（pinia store 也会做, 这里确保 DOM 已就绪）
  document.documentElement.dataset['theme'] = ui.theme;
});
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main class="app-main">
      <RouterView />
    </main>
    <AppStatusBar />
    <AiAssistant />
    <Toast />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
}
.app-main {
  overflow: hidden;
  min-height: 0;
}
</style>
