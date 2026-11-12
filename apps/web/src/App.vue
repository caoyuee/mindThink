<script setup lang="ts">
/**
 * Web 端应用外壳：单页结构（编辑器）+ 弹窗层。
 * 设置/快捷键/关于均为弹窗（ui store 开关），不再有次级路由页。
 */
import { onBeforeUnmount, onMounted } from 'vue';
import EditorView from '@/views/EditorView.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppStatusBar from '@/components/layout/AppStatusBar.vue';
import Toast from '@/components/common/Toast.vue';
import DialogHost from '@/components/dialogs/DialogHost.vue';
import ShortcutsDialog from '@/components/dialogs/ShortcutsDialog.vue';
import SettingsDialog from '@/components/dialogs/SettingsDialog.vue';
import AboutDialog from '@/components/dialogs/AboutDialog.vue';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

/** 全局快捷键：Mod+/ 打开快捷键弹窗。 */
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
  ui.openShortcuts();
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
      <EditorView />
    </main>
    <AppStatusBar />
    <Toast />
    <DialogHost />
    <ShortcutsDialog :open="ui.shortcutsOpen" @close="ui.closeShortcuts()" />
    <SettingsDialog :open="ui.settingsOpen" @close="ui.closeSettings()" />
    <AboutDialog :open="ui.aboutOpen" @close="ui.closeAbout()" />
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
