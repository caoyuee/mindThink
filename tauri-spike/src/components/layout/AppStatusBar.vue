<script setup lang="ts">
/**
 * 全局底栏：撤销/重做状态 + 文档概要
 */
import { useI18n } from 'vue-i18n';
import { useMindmapStore } from '@/stores/mindmap';
import { computed } from 'vue';

const { t } = useI18n();
const mindmap = useMindmapStore();

const docSummary = computed(() =>
  t('statusbar.docSummary', {
    title: mindmap.doc.root.text,
    n: mindmap.totalNodes,
  }),
);
</script>

<template>
  <div class="statusbar">
    <span class="ok">● {{ t('app.name') }}</span>
    <span>{{
      t('statusbar.undoStack', {
        state: mindmap.canUndo ? t('statusbar.stackOk') : t('statusbar.stackEmpty'),
      })
    }}</span>
    <span>{{
      t('statusbar.redoStack', {
        state: mindmap.canRedo ? t('statusbar.stackOk') : t('statusbar.stackEmpty'),
      })
    }}</span>
    <span class="spacer">{{ docSummary }}</span>
    <span v-if="mindmap.isDirty" class="dirty">{{ t('statusbar.unsaved') }}</span>
  </div>
</template>

<style scoped>
.statusbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 4px 12px;
  background: var(--bg-elev);
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--fg-mute);
  height: 24px;
}
.ok {
  color: #16a34a;
}
.spacer {
  margin-left: auto;
}
.dirty {
  color: var(--danger);
}
</style>
