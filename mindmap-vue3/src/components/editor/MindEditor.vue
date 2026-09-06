<script setup lang="ts">
/**
 * 核心: markmap 渲染 + 交互层（点击选中、右键菜单）
 *
 * AGENTS.md 1.3: markmap 集成的唯一入口
 */
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import { Markmap, deriveOptions } from 'markmap-view';
import { useI18n } from 'vue-i18n';
import { useMindmapStore } from '@/stores/mindmap';
import { useUiStore } from '@/stores/ui';
import { useShortcuts } from '@/composables/useShortcuts';
import NodeContextMenu from './NodeContextMenu.vue';
import { exportKm, exportPng, exportSvg } from '@/core/file';
import { toKmJson } from '@/core/km';
import { useToastStore } from '@/composables/useToast';
import { focusSearchInput } from '@/composables/useSearchFocus';
import type { MarkmapRuntimeNode } from '@/types/markmap';

const { t } = useI18n();
const store = useMindmapStore();
const ui = useUiStore();
const shortcuts = useShortcuts();
const toast = useToastStore();

const svgRef = ref<SVGSVGElement | null>(null);
const menu = ref<{ x: number; y: number; targetId: string; isRoot: boolean } | null>(null);
const selectedMarkmapNode = ref<MarkmapRuntimeNode | null>(null);

/** markmap 实例。组件外闭包变量, 不进响应式 */
let mm: InstanceType<typeof Markmap> | null = null;

const PALETTE: Record<'light' | 'dark', string[]> = {
  light: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
  dark: ['#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#34d399'],
};

/** 创建/初始化 markmap */
function ensureMarkmap(): void {
  if (mm || !svgRef.value) return;
  const palette = PALETTE[ui.theme];
  mm = Markmap.create(svgRef.value, {
    autoFit: true,
    zoom: true,
    pan: true,
    color: (node: unknown) => {
      const depth = (node as { state?: { depth?: number } })?.state?.depth ?? 0;
      return palette[depth % palette.length] as string;
    },
  });
  store.markmap = mm;
}

/** 把数据喂给 markmap 并绑定交互 */
async function render(): Promise<void> {
  ensureMarkmap();
  if (!mm) return;
  const opts = deriveOptions();
  selectedMarkmapNode.value = null;
  await mm.setData(store.markmapData, opts);
  await nextTick();
  bindNodeEvents();
  await syncSelectionHighlight();
}

async function syncSelectionHighlight(): Promise<void> {
  if (!mm || !svgRef.value || !store.selectedId) {
    selectedMarkmapNode.value = null;
    if (mm) await mm.setHighlight(null);
    return;
  }
  const element = Array.from(svgRef.value.querySelectorAll<SVGGElement>('g.markmap-node')).find(
    (candidate) =>
      (candidate as SVGGElement & { __data__?: MarkmapRuntimeNode }).__data__?.payload?.id ===
      store.selectedId,
  ) as (SVGGElement & { __data__?: MarkmapRuntimeNode }) | undefined;
  selectedMarkmapNode.value = element?.__data__ ?? null;
  await mm.setHighlight(selectedMarkmapNode.value as never);
}

/** 给 markmap 节点挂事件 */
function bindNodeEvents(): void {
  if (!svgRef.value) return;
  const svg = svgRef.value;
  svg.removeEventListener('click', onSvgClick);
  svg.removeEventListener('contextmenu', onSvgContextMenu);
  svg.addEventListener('click', onSvgClick);
  svg.addEventListener('contextmenu', onSvgContextMenu);
}

/** 从 SVG 元素提取我们注入的 payload.id */
function payloadOf(target: EventTarget | null): { id: string; isRoot: boolean } | null {
  if (!target) return null;
  const el = (target as Element).closest?.('g.markmap-node') as SVGGElement | null;
  if (!el) return null;
  const node = (el as { __data__?: MarkmapRuntimeNode }).__data__;
  const id = node?.payload?.id;
  if (!node || !id) return null;
  selectedMarkmapNode.value = node;
  return { id, isRoot: id === store.doc.root.id };
}

function onSvgClick(e: MouseEvent): void {
  const p = payloadOf(e.target);
  if (!p) return;
  store.select(p.id);
  if (mm && selectedMarkmapNode.value) void mm.setHighlight(selectedMarkmapNode.value as never);
  closeMenu();
}

function onSvgContextMenu(e: MouseEvent): void {
  const p = payloadOf(e.target);
  if (!p) return;
  e.preventDefault();
  store.select(p.id);
  menu.value = {
    x: e.clientX,
    y: e.clientY,
    targetId: p.id,
    isRoot: p.isRoot,
  };
}

function closeMenu(): void {
  menu.value = null;
}

function promptRename(id: string): void {
  const current = store.selectedNode?.text ?? '';
  const next = window.prompt(t('node.rename'), current);
  if (next !== null && next !== current) {
    store.renameNode(id, next);
  }
}

function serializedSvg(): string {
  if (!svgRef.value) throw new Error('脑图尚未渲染');
  const clone = svgRef.value.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(svgRef.value.clientWidth));
  clone.setAttribute('height', String(svgRef.value.clientHeight));
  return new XMLSerializer().serializeToString(clone);
}

async function exportCurrentSvg(): Promise<void> {
  const ok = await exportSvg(serializedSvg(), `${store.doc.root.text || 'mindmap'}.svg`);
  if (ok) toast.success(t('toast.exported'));
}

async function exportCurrentPng(): Promise<void> {
  const svg = serializedSvg();
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('SVG 无法转换为 PNG'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = svgRef.value?.clientWidth || 1200;
    canvas.height = svgRef.value?.clientHeight || 800;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器不支持 Canvas');
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas');
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('PNG 导出失败'))),
        'image/png',
      ),
    );
    if (await exportPng(png, `${store.doc.root.text || 'mindmap'}.png`))
      toast.success(t('toast.exported'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function exportCurrentKm(): Promise<void> {
  const ok = await exportKm(toKmJson(store.doc.root), `${store.doc.root.text || 'mindmap'}.km`);
  if (ok) toast.success(t('toast.exported'));
}

async function toggleSelectedNode(): Promise<void> {
  if (!mm || !selectedMarkmapNode.value) return;
  await mm.toggleNode(selectedMarkmapNode.value as never, false);
}

function onMenuAction(action: string, id: string): void {
  switch (action) {
    case 'add-child':
      store.addChild(id, t('node.defaultName'));
      break;
    case 'add-sibling':
      store.addSibling(id, t('node.defaultName'));
      break;
    case 'rename':
      promptRename(id);
      break;
    case 'indent':
      store.indentNode(id);
      break;
    case 'outdent':
      store.outdentNode(id);
      break;
    case 'remove':
      if (window.confirm(t('node.deleteConfirm'))) store.removeNode(id);
      break;
  }
}

// 响应 store 数据变化
watch(
  () => store.markmapData,
  () => {
    void render();
  },
  { deep: false },
);

watch(
  () => store.selectedId,
  () => {
    void syncSelectionHighlight();
  },
);

// 主题切换：重建 markmap（color 函数依赖 theme）
watch(
  () => ui.theme,
  () => {
    if (mm) {
      mm.destroy();
      mm = null;
      store.markmap = null;
      void render();
    }
  },
);

onMounted(() => {
  void render();
  // 注册快捷键：通过 SHORTCUT_REGISTRY 统一驱动，UI 显示和实际绑定同一份数据
  shortcuts.bindById({
    undo: () => store.undo(),
    redo: () => store.redo(),
    indent: () => store.selectedId && store.indentNode(store.selectedId),
    outdent: () => store.selectedId && store.outdentNode(store.selectedId),
    removeNode: () => store.selectedId && store.removeNode(store.selectedId),
    reorder: (e) => {
      if (!store.selectedId) return;
      const dir = e.key === 'ArrowUp' ? 'up' : 'down';
      store.reorderNode(store.selectedId, dir);
    },
    placeRoot: () => {
      void store.markmap?.fit?.();
    },
    findNode: () => focusSearchInput(),
    addSibling: () => {
      if (store.selectedId) store.addSibling(store.selectedId, t('node.defaultName'));
    },
    addParent: () => {
      if (store.selectedId) store.addParent(store.selectedId, t('node.defaultName'));
    },
    copyNode: () => store.selectedId && store.copyNode(store.selectedId),
    cutNode: () => store.selectedId && store.cutNode(store.selectedId),
    pasteNode: () => store.pasteNode(),
    expandCollapse: () => {
      if (mm && selectedMarkmapNode.value)
        void mm.toggleNode(selectedMarkmapNode.value as never, false);
    },
    navigate: (e) => {
      if (!store.selectedId) return;
      const dir =
        e.key === 'ArrowUp'
          ? 'prev'
          : e.key === 'ArrowDown'
            ? 'next'
            : e.key === 'ArrowLeft'
              ? 'parent'
              : 'firstChild';
      store.moveSelection(dir);
    },
  });
});

onBeforeUnmount(() => {
  if (mm) {
    mm.destroy();
    mm = null;
  }
});

defineExpose({ closeMenu });
</script>

<template>
  <div class="canvas" @click="closeMenu">
    <div class="export-actions">
      <button :title="t('toolbar.exportSvg')" @click.stop="void exportCurrentSvg()">
        {{ t('toolbar.exportSvg') }}
      </button>
      <button :title="t('toolbar.exportPng')" @click.stop="void exportCurrentPng()">
        {{ t('toolbar.exportPng') }}
      </button>
      <button :title="t('toolbar.exportKm')" @click.stop="void exportCurrentKm()">
        {{ t('toolbar.exportKm') }}
      </button>
      <button
        :title="t('toolbar.toggleNode')"
        :disabled="!selectedMarkmapNode"
        @click.stop="void toggleSelectedNode()"
      >
        {{ t('toolbar.toggleNode') }}
      </button>
    </div>
    <svg ref="svgRef" />
    <NodeContextMenu
      v-if="menu"
      :x="menu.x"
      :y="menu.y"
      :target-id="menu.targetId"
      :is-root="menu.isRoot"
      @action="onMenuAction"
      @close="closeMenu"
    />
  </div>
</template>

<style scoped>
.canvas {
  background: var(--bg-canvas);
  position: relative;
  overflow: hidden;
}
.export-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: flex;
  gap: 6px;
}
.export-actions button {
  padding: 5px 8px;
  background: var(--bg-elev);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
}
.canvas > svg {
  width: 100%;
  height: 100%;
  display: block;
}
.canvas > svg :deep(g.markmap-node) {
  cursor: pointer;
}
.canvas > svg :deep(g.markmap-node circle),
.canvas > svg :deep(g.markmap-node rect) {
  cursor: pointer;
}
/* 覆盖 markmap 默认几乎透明的 #ff02 高亮，只填充背景色，无边框 */
.canvas > svg :deep(.markmap) {
  --markmap-highlight-node-bg: rgba(59, 130, 246, 0.28);
}
.canvas > svg :deep(.markmap-dark .markmap) {
  --markmap-highlight-node-bg: rgba(96, 165, 250, 0.32);
}
</style>
