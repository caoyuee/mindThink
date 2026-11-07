<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppStatusBar from '@/components/layout/AppStatusBar.vue';
import Toast from '@/components/common/Toast.vue';
import DialogHost from '@/components/dialogs/DialogHost.vue';
import { useUiStore } from '@/stores/ui';
import AiAssistant from '@/components/panels/AiAssistant.vue';

const ui = useUiStore();
const router = useRouter();

/** 全局快捷键：Mod+/ 跳转到快捷键说明页。 */
function onGlobalKeydown(e: KeyboardEvent): void {
  if (e.key !== '/') return;
  const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
  if (!mod) return;
  const target = e.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  ) {
    return;
  }
  e.preventDefault();
  void router.push('/shortcuts');
}

onMounted(() => {
  // 初始化主题（pinia store 也会做, 这里确保 DOM 已就绪）
  document.documentElement.dataset['theme'] = ui.theme;
  window.addEventListener('keydown', onGlobalKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
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
    <DialogHost />
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
