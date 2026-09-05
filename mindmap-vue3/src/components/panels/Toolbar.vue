<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useMindmapStore } from '@/stores/mindmap';
import { useUiStore } from '@/stores/ui';
import { useToastStore } from '@/composables/useToast';

const { t } = useI18n();
const store = useMindmapStore();
const ui = useUiStore();
const toast = useToastStore();

const SAMPLE_MD = `# 中心主题
- 前端架构
  - Vue 3 + Vite
  - Pinia 状态管理
  - markmap 渲染
- 后端架构
  - Tauri 2.x
  - Rust 命令
  - MCP 服务
- AI 增强
  - LLM 对话
  - 节点操作
  - 脑图生成
- 部署
  - Windows MSI
  - macOS DMG
  - Linux AppImage
`;

async function onSave() {
  const ok = await store.saveAs(t('dialog.saveMindmap'));
  if (ok) toast.success(t('toast.saved'));
}

async function onOpen() {
  const ok = await store.open(t('dialog.openMindmap'));
  if (ok) toast.success(t('toast.loaded'));
}

function addChildToSelection(): void {
  store.addChild(store.selectedId ?? store.doc.root.id, t('node.defaultName'));
}

function loadSample() {
  store.loadFromMarkdown(SAMPLE_MD);
}
</script>

<template>
  <div class="toolbar">
    <button :title="t('common.open')" @click="onOpen">
      {{ t('toolbar.open') }}
    </button>
    <button :title="t('common.save')" @click="onSave">
      {{ t('toolbar.save') }}
    </button>
    <div class="sep" />
    <button
      :title="`${t('common.undo')} (Ctrl+Z)`"
      :disabled="!store.canUndo"
      @click="store.undo()"
    >
      {{ t('toolbar.undo') }}
    </button>
    <button
      :title="`${t('common.redo')} (Ctrl+Y)`"
      :disabled="!store.canRedo"
      @click="store.redo()"
    >
      {{ t('toolbar.redo') }}
    </button>
    <div class="sep" />
    <button @click="addChildToSelection">
      {{ t('toolbar.addChild') }}
    </button>
    <div class="sep" />
    <button @click="loadSample">{{ t('toolbar.sample') }}</button>
    <button @click="store.loadBigTree()">{{ t('toolbar.bigTree') }}</button>
    <button @click="store.reset()">{{ t('toolbar.reset') }}</button>
    <div class="sep" />
    <button @click="ui.toggleTheme()">
      {{ ui.theme === 'light' ? t('toolbar.darkTheme') : t('toolbar.lightTheme') }}
    </button>
    <span class="info">
      {{ t('toolbar.nodeCount', { n: store.totalNodes }) }}
    </span>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-elev);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.toolbar button {
  padding: 6px 10px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 13px;
  white-space: nowrap;
}
.toolbar button:hover:not(:disabled) {
  background: var(--accent);
  color: var(--accent-fg);
  border-color: var(--accent);
}
.toolbar button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.toolbar .sep {
  width: 1px;
  height: 20px;
  background: var(--border);
}
.toolbar .info {
  margin-left: auto;
  color: var(--fg-mute);
  font-size: 12px;
}
</style>
