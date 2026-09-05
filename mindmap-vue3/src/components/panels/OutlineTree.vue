<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { MindNode } from '@/core/tree';

defineOptions({ name: 'OutlineTree' });
defineProps<{ nodes: MindNode[]; selectedId: string | null }>();
const emit = defineEmits<{ select: [id: string] }>();
const { t } = useI18n();
</script>

<template>
  <ul class="outline-tree">
    <li v-for="node in nodes" :key="node.id">
      <button
        :class="['outline-node', { selected: node.id === selectedId }]"
        @click="emit('select', node.id)"
      >
        {{ node.text || t('panel.untitledNode') }}
      </button>
      <OutlineTree
        v-if="node.children.length"
        :nodes="node.children"
        :selected-id="selectedId"
        @select="emit('select', $event)"
      />
    </li>
  </ul>
</template>

<style scoped>
.outline-tree {
  list-style: none;
  margin: 0;
  padding-left: 12px;
}
.outline-tree > li {
  margin: 2px 0;
}
.outline-node {
  display: block;
  width: 100%;
  overflow: hidden;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.outline-node:hover {
  background: var(--bg);
  border-color: var(--border);
}
.outline-node.selected {
  background: var(--accent);
  color: var(--accent-fg);
}
</style>
