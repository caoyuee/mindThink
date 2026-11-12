<script setup lang="ts">
/**
 * 核心: markmap 渲染 + 交互层（点击选中、右键菜单、双击就地编辑）
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
import { findNode } from '@/core/tree';
import { useToastStore } from '@/composables/useToast';
import { useDialog } from '@/composables/useDialog';
import { focusSearchInput } from '@/composables/useSearchFocus';
import type { MarkmapRuntimeNode } from '@/types/markmap';

const { t } = useI18n();
const store = useMindmapStore();
const ui = useUiStore();
const shortcuts = useShortcuts();
const toast = useToastStore();
const dialog = useDialog();

const svgRef = ref<SVGSVGElement | null>(null);
const canvasRef = ref<HTMLDivElement | null>(null);
const menu = ref<{ x: number; y: number; targetId: string; isRoot: boolean } | null>(null);
const selectedMarkmapNode = ref<MarkmapRuntimeNode | null>(null);

/** 就地编辑状态：null = 未编辑。坐标为相对 .canvas 容器的像素值 */
const editing = ref<{
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  value: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  color: string;
} | null>(null);
const editInput = ref<HTMLTextAreaElement | null>(null);

/** 节点悬浮提示：画布为截断文本，悬浮展示全量（支持换行） */
const tooltip = ref<{ x: number; y: number; text: string } | null>(null);
const TOOLTIP_MAX_WIDTH = 360;

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
  hideTooltip();
  await mm.setData(store.markmapData, opts);
  await nextTick();
  bindNodeEvents();
  await syncSelectionHighlight();
}

/**
 * 在 markmap 当前数据树中按 payload.id 查找运行时节点对象。
 *
 * 不能用 DOM g 元素上的 __data__ 代替：节点文本变化后 markmap 以
 * state.key（含内容哈希）做数据 join，旧 g 进入 exit 过渡期间仍留在
 * DOM 且 __data__ 指向旧节点对象（state.rect 停留在旧尺寸），把它传给
 * setHighlight 会导致选中背景卡在旧文本大小。
 */
function findRuntimeNode(id: string): MarkmapRuntimeNode | null {
  let found: MarkmapRuntimeNode | null = null;
  const visit = (node: MarkmapRuntimeNode | undefined): void => {
    if (found || !node) return;
    if (node.payload?.id === id) {
      found = node;
      return;
    }
    for (const child of node.children ?? []) visit(child as MarkmapRuntimeNode);
  };
  visit((mm?.state as { data?: MarkmapRuntimeNode } | undefined)?.data);
  return found;
}

async function syncSelectionHighlight(): Promise<void> {
  if (!mm || !svgRef.value || !store.selectedId) {
    selectedMarkmapNode.value = null;
    if (mm) await mm.setHighlight(null);
    return;
  }
  const node = findRuntimeNode(store.selectedId);
  selectedMarkmapNode.value = node;
  await mm.setHighlight(node as never);
}

/** 给 markmap 节点挂事件 */
function bindNodeEvents(): void {
  if (!svgRef.value) return;
  const svg = svgRef.value;
  // dblclick 必须走捕获阶段：markmap-view 在节点 foreignObject 上注册了
  // 冒泡阶段的 dblclick + stopPropagation，普通监听收不到节点上的双击事件
  svg.removeEventListener('click', onSvgClick);
  svg.removeEventListener('contextmenu', onSvgContextMenu);
  svg.removeEventListener('dblclick', onSvgDblClick, true);
  svg.removeEventListener('mouseover', onSvgMouseOver);
  svg.removeEventListener('mouseleave', hideTooltip);
  svg.addEventListener('click', onSvgClick);
  svg.addEventListener('contextmenu', onSvgContextMenu);
  svg.addEventListener('dblclick', onSvgDblClick, true);
  svg.addEventListener('mouseover', onSvgMouseOver);
  svg.addEventListener('mouseleave', hideTooltip);
}

/** 从 SVG 元素提取 payload.id（仅取 id，节点对象一律经 findRuntimeNode 解析） */
function payloadOf(target: EventTarget | null): { id: string; isRoot: boolean } | null {
  if (!target) return null;
  const el = (target as Element).closest?.('g.markmap-node') as SVGGElement | null;
  if (!el) return null;
  // markmap 0.18 直接把运行时 INode 挂在 g.markmap-node.__data__ 上。
  const node = (el as { __data__?: MarkmapRuntimeNode }).__data__;
  const id = node?.payload?.id;
  if (!node || !id) return null;
  return { id, isRoot: id === store.doc.root.id };
}

function onSvgClick(e: MouseEvent): void {
  const p = payloadOf(e.target);
  if (!p) return;
  store.select(p.id);
  selectedMarkmapNode.value = findRuntimeNode(p.id);
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

function onSvgDblClick(e: MouseEvent): void {
  const p = payloadOf(e.target);
  if (!p) return;
  e.preventDefault();
  // 捕获阶段拦截后续传播：既挡掉 markmap foreignObject 上的 stopPropagation，
  // 也挡掉 d3-zoom 在同一 svg 冒泡阶段注册的双击缩放（否则编辑框弹出时画布还会放大）
  e.stopPropagation();
  store.select(p.id);
  startInlineEdit(p.id);
}

/** 鼠标悬浮节点：显示全量文本提示（截断展示的补充），不悬浮节点时隐藏 */
function onSvgMouseOver(e: MouseEvent): void {
  const p = payloadOf(e.target);
  if (!p || !canvasRef.value) {
    tooltip.value = null;
    return;
  }
  const g = (e.target as Element).closest?.('g.markmap-node');
  const fo = g?.querySelector('foreignObject');
  if (!fo) return;
  const canvasRect = canvasRef.value.getBoundingClientRect();
  const rect = fo.getBoundingClientRect();
  const canvasWidth = canvasRef.value.clientWidth;
  const width = Math.min(TOOLTIP_MAX_WIDTH, canvasWidth - 16);
  // 水平方向夹在画布内，垂直方向放到节点上方（-100% 由 CSS transform 完成）
  tooltip.value = {
    x: Math.max(8, Math.min(rect.left - canvasRect.left, canvasWidth - width - 8)),
    y: rect.top - canvasRect.top - 8,
    text: findNode(store.doc.root, p.id)?.text ?? '',
  };
}

function hideTooltip(): void {
  tooltip.value = null;
}

function closeMenu(): void {
  menu.value = null;
}

/**
 * 就地编辑：把 textarea 覆盖在节点 foreignObject 的位置上。
 * 字体样式从 markmap 渲染出的 div 上拷贝，保证视觉一致。
 */
function startInlineEdit(id: string): void {
  if (!mm || !canvasRef.value || editing.value) return;
  // 经 findRuntimeNode + findElement 定位当前数据树对应的 g 元素，
  // 避免命中 exit 过渡期间残留的旧 g（其 rect 是旧尺寸）
  const runtimeNode = findRuntimeNode(id);
  const g = runtimeNode ? mm.findElement(runtimeNode as never)?.g : undefined;
  const fo = g?.querySelector('foreignObject');
  const inner = fo?.querySelector('div');
  if (!fo || !inner) return;

  const canvasRect = canvasRef.value.getBoundingClientRect();
  const rect = fo.getBoundingClientRect();
  const cs = getComputedStyle(inner);

  closeMenu();
  editing.value = {
    id,
    x: rect.left - canvasRect.left - 6,
    // 上移避开节点下方的横线，不留边框时也保持与文本视觉对齐
    y: rect.top - canvasRect.top - 9,
    w: Math.max(rect.width + 12, 120),
    h: rect.height + 10,
    value: findNode(store.doc.root, id)?.text ?? '',
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    color: cs.color,
  };
  void nextTick(() => {
    editInput.value?.focus();
    editInput.value?.select();
  });
}

function commitInlineEdit(): void {
  const state = editing.value;
  if (!state) return;
  editing.value = null;
  // 内容未变化则不动命令栈，避免产生空撤销记录
  if (state.value === (findNode(store.doc.root, state.id)?.text ?? '')) return;
  if (state.id === store.doc.root.id) {
    store.setRootText(state.value);
  } else {
    store.renameNode(state.id, state.value);
  }
}

function cancelInlineEdit(): void {
  editing.value = null;
}

function onEditKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    commitInlineEdit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancelInlineEdit();
  }
}

async function confirmRemove(id: string): Promise<void> {
  const ok = await dialog.confirm({
    title: t('common.confirm'),
    message: t('node.deleteConfirm'),
    okText: t('common.ok'),
    cancelText: t('common.cancel'),
    danger: true,
  });
  if (ok) store.removeNode(id);
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
  const ok = await exportSvg(
    serializedSvg(),
    `${store.doc.root.text || 'mindmap'}.svg`,
    t('dialog.exportSvg'),
  );
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
    const ok = await exportPng(
      png,
      `${store.doc.root.text || 'mindmap'}.png`,
      t('dialog.exportPng'),
    );
    if (ok) toast.success(t('toast.exported'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function toggleSelectedNode(): Promise<void> {
  if (!mm || !selectedMarkmapNode.value) return;
  await mm.toggleNode(selectedMarkmapNode.value as never, false);
}

async function exportCurrentKm(): Promise<void> {
  const ok = await exportKm(
    toKmJson(store.doc.root),
    `${store.doc.root.text || 'mindmap'}.km`,
    t('dialog.exportKm'),
  );
  if (ok) toast.success(t('toast.exported'));
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
      startInlineEdit(id);
      break;
    case 'indent':
      store.indentNode(id);
      break;
    case 'outdent':
      store.outdentNode(id);
      break;
    case 'remove':
      void confirmRemove(id);
      break;
  }
}

// 响应 store 数据变化
watch(
  () => store.markmapData,
  () => {
    // 文档被外部修改（MCP/撤销重做等）时关闭编辑框，避免 overlay 悬空
    if (editing.value) cancelInlineEdit();
    hideTooltip();
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
      // 居中根节点：markmap.fit 会重置 zoom/pan 并把所有内容装入视口
      void store.markmap?.fit?.();
    },
    findNode: () => focusSearchInput(),
    addSibling: () => {
      if (store.selectedId) store.addSibling(store.selectedId, t('node.defaultName'));
    },
    insertChild: () => {
      // 未选中节点时 fallback 到根节点（与 Toolbar.addChildToSelection 一致）
      store.addChild(store.selectedId ?? store.doc.root.id, t('node.defaultName'));
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
  <div ref="canvasRef" class="canvas" @click="closeMenu">
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
    <div
      v-if="tooltip"
      class="node-tooltip"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
    >
      {{ tooltip.text }}
    </div>
    <textarea
      v-if="editing"
      ref="editInput"
      v-model="editing.value"
      class="inline-editor"
      :style="{
        left: `${editing.x}px`,
        top: `${editing.y}px`,
        width: `${editing.w}px`,
        height: `${editing.h}px`,
        fontFamily: editing.fontFamily,
        fontSize: editing.fontSize,
        fontWeight: editing.fontWeight,
        color: editing.color,
      }"
      @keydown="onEditKeydown"
      @blur="commitInlineEdit"
      @click.stop
      @dblclick.stop
    />
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
/* 双击就地编辑覆盖层：定位由内联样式给出 */
.inline-editor {
  position: absolute;
  z-index: 3;
  box-sizing: border-box;
  margin: 0;
  padding: 2px 4px;
  background: var(--bg-elev);
  border: none;
  border-radius: 4px;
  resize: none;
  outline: none;
  overflow: auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.14);
}
/* 节点全量文本悬浮提示：长文本自动换行，定位在节点上方 */
.node-tooltip {
  position: absolute;
  z-index: 3;
  transform: translateY(calc(-100% - 8px));
  box-sizing: border-box;
  max-width: 360px;
  padding: 8px 10px;
  background: var(--bg-elev);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  font-size: 13px;
  line-height: 1.5;
  /* pre-wrap 保留 Shift+Enter 换行，超宽自动折行 */
  white-space: pre-wrap;
  word-break: break-word;
  pointer-events: none;
}
</style>
