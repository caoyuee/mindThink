<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMindmapStore } from '@/stores/mindmap';
import { registerSearchInput } from '@/composables/useSearchFocus';
import { useDialog } from '@/composables/useDialog';
import OutlineTree from './OutlineTree.vue';

const { t } = useI18n();
const store = useMindmapStore();
const dialog = useDialog();
const searchQuery = ref('');
const searchResults = computed(() => store.search(searchQuery.value));
const searchInput = ref<HTMLInputElement | null>(null);

watch(
  searchInput,
  (el) => {
    registerSearchInput(el);
  },
  { immediate: true },
);
onBeforeUnmount(() => registerSearchInput(null));

function selectSearchResult(path: ReturnType<typeof store.search>[number]): void {
  const node = path[path.length - 1];
  if (node) store.select(node.id);
}

function setText(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  if (store.selectedId) store.renameNode(store.selectedId, v);
}

function setNote(e: Event): void {
  const value = (e.target as HTMLTextAreaElement).value;
  if (store.selectedId) store.updateNote(store.selectedId, value);
}

function renameRoot(e: Event) {
  store.setRootText((e.target as HTMLInputElement).value);
}

function addChild() {
  if (store.selectedId) store.addChild(store.selectedId, t('node.defaultName'));
}

async function removeSelected(): Promise<void> {
  if (!store.selectedId || store.selectedId === store.doc.root.id) return;
  const ok = await dialog.confirm({
    title: t('common.confirm'),
    message: t('node.deleteConfirm'),
    okText: t('common.ok'),
    cancelText: t('common.cancel'),
    danger: true,
  });
  if (ok) store.removeNode(store.selectedId);
}
</script>

<template>
  <div class="aside">
    <h3>{{ t('panel.properties') }}</h3>

    <div class="props">
      <div class="row">
        <label>{{ t('panel.rootText') }}</label>
        <input :value="store.doc.root.text" @change="renameRoot" />
      </div>
    </div>

    <h3 style="margin-top: 16px">{{ t('panel.currentNode') }}</h3>
    <div v-if="store.selectedNode" class="props">
      <div class="row">
        <label>{{ t('panel.id') }}</label>
        <input :value="store.selectedNode.id" readonly />
      </div>
      <div class="row">
        <label>{{ t('panel.text') }}</label>
        <input :value="store.selectedNode.text" @change="setText" />
      </div>
      <div class="row note-row">
        <label>{{ t('panel.note') }}</label>
        <textarea :value="store.selectedNode.note ?? ''" rows="4" @change="setNote" />
      </div>
      <div class="actions">
        <button @click="addChild">{{ t('panel.addChild') }}</button>
        <button
          v-if="store.selectedId !== store.doc.root.id"
          class="danger"
          @click="removeSelected"
        >
          {{ t('panel.delete') }}
        </button>
      </div>
    </div>
    <div v-else class="props">
      <p style="color: var(--fg-mute); margin: 0">
        {{ t('panel.clickPrompt') }}
      </p>
    </div>

    <h3 style="margin-top: 16px">{{ t('panel.search') }}</h3>
    <div class="search-panel">
      <input ref="searchInput" v-model="searchQuery" :placeholder="t('panel.searchPlaceholder')" />
      <button
        v-for="path in searchResults"
        :key="path[path.length - 1]?.id"
        class="search-result"
        @click="selectSearchResult(path)"
      >
        {{ path.map((node) => node.text).join(' / ') }}
      </button>
      <small v-if="searchQuery && !searchResults.length">{{ t('panel.noResults') }}</small>
    </div>

    <h3 style="margin-top: 16px">{{ t('panel.outline') }}</h3>
    <div class="outline-panel">
      <OutlineTree
        :nodes="[store.doc.root]"
        :selected-id="store.selectedId"
        @select="store.select"
      />
    </div>

    <h3 style="margin-top: 16px">{{ t('panel.dataPreview') }}</h3>
    <pre
      style="
        font-size: 11px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 8px;
        max-height: 200px;
        overflow: auto;
        margin: 0;
      "
      >{{ JSON.stringify(store.markmapData, null, 2) }}</pre>
  </div>
</template>

<style scoped>
.aside {
  background: var(--bg-elev);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 12px;
}
.aside h3 {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--fg-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.props {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 10px;
}
.props .row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.props .row label {
  width: 60px;
  color: var(--fg-mute);
  font-size: 12px;
}
.props input,
.props textarea {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 3px;
  font: inherit;
}
.note-row {
  align-items: start;
}
.note-row textarea {
  resize: vertical;
}
.props button {
  margin-top: 6px;
  padding: 5px 8px;
  background: var(--accent);
  color: var(--accent-fg);
  border: none;
  border-radius: 3px;
  cursor: pointer;
}
.props .actions {
  display: flex;
  gap: 8px;
}
.props .actions button {
  flex: 1;
  margin-top: 6px;
}
.props button.danger {
  background: var(--danger);
}
.search-panel {
  display: grid;
  gap: 6px;
}
.search-panel > input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.search-result {
  margin: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-panel small {
  color: var(--fg-mute);
}
.outline-panel {
  max-height: 240px;
  overflow: auto;
  padding: 6px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
}
</style>
