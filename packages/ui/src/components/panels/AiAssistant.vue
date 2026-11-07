<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMindmapStore } from '@/stores/mindmap';
import { useConfigStore } from '@/stores/config';
import { useToastStore } from '@/composables/useToast';
import { createMcpContext } from '@/core/mcp';
import {
  classifyAiRequestFailure,
  createAiChatRequest,
  normalizeAiEndpoint,
  readAiChatResponse,
} from '@/core/ai';

const { t } = useI18n();
const mindmap = useMindmapStore();
const config = useConfigStore();
const toast = useToastStore();
const prompt = ref(t('ai.defaultPrompt'));
const answer = ref('');
const loading = ref(false);
const expanded = ref(false);
const AI_TIMEOUT_MS = 30_000;
const DRAG_THRESHOLD_PX = 4;
const FAB_SIZE = 44;
const FAB_MARGIN = 16;
let activeController: AbortController | null = null;

function cancelRequest(): void {
  activeController?.abort();
}

onBeforeUnmount(cancelRequest);

/** 浮动按钮坐标（相对视口左上角）。同步初始位置避免出现 (0, 0) 闪烁。 */
const fabLeft = ref(Math.max(0, window.innerWidth - FAB_SIZE - FAB_MARGIN));
const fabTop = ref(Math.max(0, window.innerHeight - FAB_SIZE - FAB_MARGIN));
let isDragging = false;
let didDrag = false;
let dragStartX = 0;
let dragStartY = 0;
let fabStartLeft = 0;
let fabStartTop = 0;

function clamp(value: number, size: number, axis: 'x' | 'y'): number {
  const max =
    axis === 'x'
      ? Math.max(0, window.innerWidth - size - FAB_MARGIN)
      : Math.max(0, window.innerHeight - size - FAB_MARGIN);
  return Math.min(Math.max(value, FAB_MARGIN), max);
}

const fabStyle = computed(() => ({
  left: `${fabLeft.value}px`,
  top: `${fabTop.value}px`,
}));

function onFabPointerDown(e: PointerEvent): void {
  isDragging = true;
  didDrag = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  fabStartLeft = fabLeft.value;
  fabStartTop = fabTop.value;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onFabPointerMove(e: PointerEvent): void {
  if (!isDragging) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  if (!didDrag && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) didDrag = true;
  fabLeft.value = clamp(fabStartLeft + dx, FAB_SIZE, 'x');
  fabTop.value = clamp(fabStartTop + dy, FAB_SIZE, 'y');
}

function onFabPointerUp(e: PointerEvent): void {
  if (!isDragging) return;
  isDragging = false;
  try {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  } catch {
    /* already released */
  }
  if (!didDrag) expanded.value = !expanded.value;
}

function onFabKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    expanded.value = !expanded.value;
  }
}

function closeDrawer(): void {
  expanded.value = false;
}

async function ask(): Promise<void> {
  const baseEndpoint = normalizeAiEndpoint(config.userConfig.aiEndpoint);
  if (!baseEndpoint || !config.userConfig.aiModel.trim()) {
    toast.warn(t('ai.configureFirst'));
    return;
  }
  loading.value = true;
  answer.value = '';
  const controller = new AbortController();
  activeController = controller;
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AI_TIMEOUT_MS);
  try {
    const endpoint = `${baseEndpoint}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.userConfig.aiApiKey
          ? { Authorization: `Bearer ${config.userConfig.aiApiKey}` }
          : {}),
      },
      body: JSON.stringify(
        createAiChatRequest(config.userConfig.aiModel, prompt.value, createMcpContext(mindmap.doc)),
      ),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
    answer.value = readAiChatResponse(await response.json());
  } catch (error) {
    const failure = classifyAiRequestFailure(error, timedOut);
    if (failure === 'timeout') toast.warn(t('ai.timeout'));
    else if (failure === 'cancelled') toast.info(t('ai.cancelled'));
    else toast.error(`${t('toast.error')}: ${(error as Error).message}`);
  } finally {
    window.clearTimeout(timeoutId);
    if (activeController === controller) activeController = null;
    loading.value = false;
  }
}
</script>

<template>
  <div class="ai-root">
    <button
      type="button"
      class="fab"
      :class="{ open: expanded, dragging: isDragging }"
      :aria-expanded="expanded"
      :aria-label="expanded ? t('ai.collapse') : t('ai.expand')"
      :title="expanded ? t('ai.collapse') : t('ai.expand')"
      :style="fabStyle"
      @pointerdown="onFabPointerDown"
      @pointermove="onFabPointerMove"
      @pointerup="onFabPointerUp"
      @pointercancel="onFabPointerUp"
      @keydown="onFabKeydown"
    >
      <span class="icon" aria-hidden="true">🤖</span>
    </button>

    <aside
      class="drawer"
      :class="{ open: expanded }"
      :aria-hidden="!expanded"
      role="dialog"
      :aria-label="t('ai.title')"
    >
      <header class="panel-header">
        <h3>{{ t('ai.title') }}</h3>
        <button type="button" class="close" :title="t('ai.collapse')" @click="closeDrawer">
          ✕
        </button>
      </header>
      <textarea v-model="prompt" rows="3" :placeholder="t('ai.prompt')" />
      <div class="request-actions">
        <button :disabled="loading" @click="void ask()">
          {{ loading ? t('ai.loading') : t('ai.ask') }}
        </button>
        <button v-if="loading" class="secondary" @click="cancelRequest">
          {{ t('ai.cancel') }}
        </button>
      </div>
      <pre v-if="answer" class="answer">{{ answer }}</pre>
      <button
        v-if="answer && mindmap.selectedId"
        class="secondary"
        @click="mindmap.updateNote(mindmap.selectedId, answer)"
      >
        {{ t('ai.applyNote') }}
      </button>
    </aside>
  </div>
</template>

<style scoped>
.ai-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9000;
}
.fab {
  position: fixed;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  padding: 0;
  background: var(--accent);
  color: var(--accent-fg);
  border: 0;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  cursor: grab;
  font-size: 20px;
  pointer-events: auto;
  transition:
    transform 0.15s,
    box-shadow 0.15s;
  touch-action: none;
  user-select: none;
}
.fab:hover {
  transform: scale(1.05);
}
.fab.open {
  background: var(--bg-elev);
  color: var(--fg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.fab.dragging {
  cursor: grabbing;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}
.fab .icon {
  line-height: 1;
}
.drawer {
  position: fixed;
  top: 48px;
  right: 0;
  bottom: 24px;
  width: 380px;
  max-width: calc(100vw - 32px);
  display: grid;
  grid-template-rows: auto auto auto auto 1fr auto;
  gap: 8px;
  padding: 14px;
  background: var(--bg-elev);
  border-left: 1px solid var(--border);
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.18);
  transform: translateX(100%);
  transition: transform 0.2s ease-out;
  pointer-events: auto;
  overflow: auto;
}
.drawer.open {
  transform: translateX(0);
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.panel-header h3 {
  margin: 0;
  font-size: 13px;
  color: var(--fg-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.panel-header .close {
  background: transparent;
  border: 0;
  color: var(--fg-mute);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 3px;
}
.panel-header .close:hover {
  background: var(--bg);
  color: var(--fg);
}
.request-actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
}
.drawer textarea,
.drawer button {
  font: inherit;
  padding: 6px 8px;
}
.drawer textarea {
  resize: vertical;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 3px;
  min-height: 60px;
}
.drawer button {
  background: var(--accent);
  color: var(--accent-fg);
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}
.drawer button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.drawer .secondary {
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
}
.answer {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  font: inherit;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 8px;
}
</style>
