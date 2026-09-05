<script setup lang="ts">
/**
 * 编辑器主视图
 * 整合 Toolbar + Properties + MindEditor
 */
import Toolbar from '@/components/panels/Toolbar.vue';
import MindEditor from '@/components/editor/MindEditor.vue';
import Properties from '@/components/panels/Properties.vue';
import AiAssistant from '@/components/panels/AiAssistant.vue';
</script>

<template>
  <div class="editor-view">
    <Toolbar />
    <div class="workspace">
      <aside class="sidebar">
        <Properties />
        <AiAssistant />
      </aside>
      <MindEditor />
    </div>
  </div>
</template>

<style scoped>
.editor-view {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
}
.workspace {
  display: grid;
  grid-template-columns: 320px 1fr;
  overflow: hidden;
}
.sidebar {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
  background: var(--bg-elev);
  border-right: 1px solid var(--border);
}
.sidebar :deep(.aside) {
  border-right: 0;
}
</style>
