/**
 * Pinia store: 脑图状态 + 命令栈 + markmap 桥接
 *
 * 满足 AGENTS.md:
 * - 1.4 所有 doc.value 修改集中到 _replaceDoc()
 * - 1.6 走 core/logger, 不裸用 console
 * - 4 命令栈纪律: 所有修改经 applyEdit()
 */

import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { nanoid } from 'nanoid';
import { Transformer } from 'markmap-lib';
import type { IPureNode } from '@/types/markmap';

import {
  type MindDoc,
  type MindNode,
  cloneTree,
  createNode,
  findNode,
  findParent,
  fromMarkdown,
  toMarkdown,
  countNodes,
  generateLargeTree,
  searchNodes,
} from '@/core/tree';
import { CommandStack, docOf } from '@/core/commands';
import { saveFile, saveFileAtPath, backupFile, openFile, openFileAtPath } from '@/core/file';
import { logger } from '@/core/logger';
import { useConfigStore } from './config';
import { fromKmJson } from '@/core/km';

const transformer = new Transformer();

/** MindNode -> markmap IPureNode（保留 id 用于命令定位） */
function toMarkmapNode(n: MindNode): IPureNode {
  return {
    content: n.text,
    children: n.children.map(toMarkmapNode),
    payload: { id: n.id, note: n.note },
  };
}

/** 创建带稳定 ID 的节点 */
export function newNodeId(): string {
  return `n_${nanoid(10)}`;
}

export const useMindmapStore = defineStore('mindmap', () => {
  // 状态
  const config = useConfigStore();
  const doc = ref<MindDoc>(docOf(createNode('中心主题')));
  const selectedId = ref<string | null>(null);
  const documentPath = ref<string | null>(null);
  const isDirty = ref(false);
  const historyRevision = ref(0);

  /** markmap 实例（不参与响应式追踪） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markmap = shallowRef<any>(null);

  // 命令栈
  const stack = new CommandStack(
    () => doc.value,
    (d) => {
      _replaceDoc(d, { resetHistory: false });
    },
  );

  // 计算
  const markmapData = computed<IPureNode>(() => toMarkmapNode(doc.value.root));
  const totalNodes = computed(() => countNodes(doc.value.root));
  const selectedNode = computed<MindNode | null>(() =>
    selectedId.value ? findNode(doc.value.root, selectedId.value) : null,
  );
  const search = (query: string): MindNode[][] => searchNodes(doc.value.root, query);
  const canUndo = computed(() => {
    void historyRevision.value;
    return stack.canUndo();
  });
  const canRedo = computed(() => {
    void historyRevision.value;
    return stack.canRedo();
  });
  const lastUndoName = computed(() => {
    void historyRevision.value;
    return stack.peekUndoName();
  });
  const lastRedoName = computed(() => {
    void historyRevision.value;
    return stack.peekRedoName();
  });

  /**
   * ⭐ 私有: 唯一可直接修改 doc.value 的入口
   *
   * 使用场景:
   * 1. 命令栈回放（撤销/重做）→ resetHistory: false
   * 2. 文件加载（Markdown → 树）→ resetHistory: true
   * 3. 重置/演示 → resetHistory: true
   *
   * 禁止在 store 之外直接 doc.value = ...
   */
  function _replaceDoc(newDoc: MindDoc, opts: { resetHistory: boolean }): void {
    doc.value = newDoc;
    if (opts.resetHistory) {
      stack.clear();
      historyRevision.value += 1;
      selectedId.value = null;
    }
  }

  //#region 工具: 所有修改都先记录 before 状态
  function applyEdit(doIt: (d: MindDoc) => MindDoc, name: string): void {
    const before = cloneDoc(doc.value);
    const after = doIt(cloneDoc(doc.value));
    stack.executeWith(before, after, name);
    historyRevision.value += 1;
    isDirty.value = true;
  }

  function cloneDoc(d: MindDoc): MindDoc {
    return { root: cloneTree(d.root), meta: d.meta ? { ...d.meta } : undefined };
  }

  //#region 节点操作（每个都是一个可撤销命令）
  function setRootText(text: string): void {
    applyEdit((d) => {
      d.root.text = text;
      return d;
    }, 'command.setRootText');
  }

  function renameNode(id: string, text: string): void {
    applyEdit((d) => {
      const n = findNode(d.root, id);
      if (n) n.text = text;
      return d;
    }, 'command.renameNode');
  }

  function updateNote(id: string, note: string): void {
    applyEdit((d) => {
      const n = findNode(d.root, id);
      if (n) n.note = note || undefined;
      return d;
    }, 'command.updateNote');
  }

  function addChild(parentId: string, text: string): string | null {
    if (!findNode(doc.value.root, parentId)) return null;
    const child = createNode(text);
    applyEdit((d) => {
      const parent = findNode(d.root, parentId);
      if (parent) parent.children.push(child);
      return d;
    }, 'command.addChild');
    selectedId.value = child.id;
    return child.id;
  }

  function addSibling(nodeId: string, text: string): void {
    applyEdit((d) => {
      const node = findNode(d.root, nodeId);
      if (!node || node === d.root) return d;
      const parent = findParent(d.root, nodeId);
      if (!parent) return d;
      const idx = parent.children.findIndex((c) => c.id === nodeId);
      parent.children.splice(idx + 1, 0, createNode(text));
      return d;
    }, 'command.addSibling');
  }

  function removeNode(id: string): void {
    // 前置守卫：根节点或找不到节点时直接返回，不产生空撤销命令（与 reorderNode 等一致）。
    if (id === doc.value.root.id || !findNode(doc.value.root, id)) return;
    applyEdit((d) => {
      if (id === d.root.id) return d; // 双保险，不允许删除根
      const parent = findParent(d.root, id);
      if (!parent) return d;
      parent.children = parent.children.filter((c) => c.id !== id);
      return d;
    }, 'command.removeNode');
    if (selectedId.value === id) selectedId.value = null;
  }

  function indentNode(id: string): void {
    // 把节点变成前一个兄弟的子节点
    applyEdit((d) => {
      if (id === d.root.id) return d;
      const parent = findParent(d.root, id);
      if (!parent) return d;
      const idx = parent.children.findIndex((c) => c.id === id);
      if (idx <= 0) return d;
      const prev = parent.children[idx - 1];
      const node = parent.children.splice(idx, 1)[0];
      prev.children.push(node);
      return d;
    }, 'command.indentNode');
  }

  function outdentNode(id: string): void {
    // 把节点提升到祖父节点下，与父节点同级
    applyEdit((d) => {
      if (id === d.root.id) return d;
      const parent = findParent(d.root, id);
      if (!parent || parent === d.root) return d;
      const grand = findParent(d.root, parent.id);
      if (!grand) return d;
      const pIdx = grand.children.findIndex((c) => c.id === parent.id);
      const idx = parent.children.findIndex((c) => c.id === id);
      const node = parent.children.splice(idx, 1)[0];
      grand.children.splice(pIdx + 1, 0, node);
      return d;
    }, 'command.outdentNode');
  }

  /**
   * 在同级中上下移动节点。
   * dir: 'up' | 'down'。根节点不可移动。
   * 边界情况（根、越界、找不到）不入命令栈。
   */
  function reorderNode(id: string, dir: 'up' | 'down'): void {
    if (id === doc.value.root.id) return;
    const parent = findParent(doc.value.root, id);
    if (!parent) return;
    const idx = parent.children.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= parent.children.length) return;
    applyEdit((d) => {
      const p = findParent(d.root, id);
      if (!p) return d;
      const i = p.children.findIndex((c) => c.id === id);
      if (i < 0) return d;
      const t = dir === 'up' ? i - 1 : i + 1;
      if (t < 0 || t >= p.children.length) return d;
      const node = p.children.splice(i, 1)[0];
      p.children.splice(t, 0, node);
      return d;
    }, 'command.reorderNode');
  }

  /**
   * 为选中节点插入一个父节点（原父级的兄弟位置放新父级，选中节点移为新父级子节点）。
   * 返回新父节点 id；根节点不可操作。失败返回 null。
   */
  function addParent(id: string, text: string): string | null {
    if (id === doc.value.root.id) return null;
    const parent = findParent(doc.value.root, id);
    if (!parent) return null;
    const parentId = parent.id;
    const idx = parent.children.findIndex((c) => c.id === id);
    if (idx < 0) return null;
    const wrapper = createNode(text);
    const wrapperId = wrapper.id;
    applyEdit((d) => {
      const p = findNode(d.root, parentId);
      if (!p) return d;
      const i = p.children.findIndex((c) => c.id === id);
      if (i < 0) return d;
      const moved = p.children.splice(i, 1)[0];
      const w = findNode(d.root, wrapperId) ?? wrapper;
      w.children = [moved];
      p.children.splice(i, 0, w);
      return d;
    }, 'command.addParent');
    selectedId.value = wrapperId;
    return wrapperId;
  }

  // 模块级剪贴板缓存（cut 后原节点删除，这里保留 deep clone 以便 paste）
  let clipboard: MindNode | null = null;

  /** 复制节点子树到内部剪贴板（不依赖系统剪贴板，保证同文档语义）。 */
  function copyNode(id: string): boolean {
    const node = findNode(doc.value.root, id);
    if (!node) return false;
    clipboard = cloneTree(node);
    return true;
  }

  /** 剪切：复制 + 删除原节点。 */
  function cutNode(id: string): boolean {
    if (id === doc.value.root.id) return false;
    if (!copyNode(id)) return false;
    removeNode(id);
    return true;
  }

  /** 粘贴：把剪贴板节点作为当前选中节点的子节点插入，并选中新节点。 */
  function pasteNode(parentId: string | null = null): boolean {
    const target = parentId ?? selectedId.value;
    if (!target || !clipboard) return false;
    // 复制后重新生成整棵子树的 id，避免同一文档出现重复 id
    const child = cloneTree(clipboard);
    relabelSubtree(child);
    const newId = child.id;
    applyEdit((d) => {
      const p = findNode(d.root, target);
      if (!p) return d;
      p.children.push(child);
      return d;
    }, 'command.pasteNode');
    selectedId.value = newId;
    return true;
  }

  /** 为节点及其子树生成全新 id（粘贴时避免重复）。 */
  function relabelSubtree(node: MindNode): void {
    node.id = newNodeId();
    node.children.forEach(relabelSubtree);
  }

  /**
   * 键盘方向导航：按当前选中节点上下文移动选区。
   * dir: 'parent' 父节点 / 'firstChild' 首个子节点 / 'prev' 前一兄弟 / 'next' 后一兄弟。
   */
  function moveSelection(dir: 'parent' | 'firstChild' | 'prev' | 'next'): boolean {
    const current = selectedId.value;
    if (!current) return false;
    if (dir === 'parent') {
      if (current === doc.value.root.id) return false;
      const parent = findParent(doc.value.root, current);
      if (parent) selectedId.value = parent.id;
      return !!parent;
    }
    if (dir === 'firstChild') {
      const node = findNode(doc.value.root, current);
      if (node && node.children.length) {
        selectedId.value = node.children[0].id;
        return true;
      }
      return false;
    }
    const parent = findParent(doc.value.root, current);
    if (!parent) return false;
    const idx = parent.children.findIndex((c) => c.id === current);
    if (idx < 0) return false;
    const target = dir === 'prev' ? idx - 1 : idx + 1;
    if (target < 0 || target >= parent.children.length) return false;
    selectedId.value = parent.children[target].id;
    return true;
  }

  //#endregion

  //#region 撤销/重做
  function undo(): void {
    if (stack.undo()) {
      historyRevision.value += 1;
      isDirty.value = true;
      // 选中可能失效
      if (selectedId.value && !findNode(doc.value.root, selectedId.value)) {
        selectedId.value = null;
      }
    }
  }
  function redo(): void {
    if (stack.redo()) {
      historyRevision.value += 1;
      isDirty.value = true;
      if (selectedId.value && !findNode(doc.value.root, selectedId.value)) {
        selectedId.value = null;
      }
    }
  }

  //#endregion

  //#region 文件
  function markdown(): string {
    return toMarkdownForMarkmap(doc.value.root);
  }

  async function save(options: { backup?: boolean } = {}): Promise<boolean> {
    if (!documentPath.value) return saveAs();
    if (options.backup) await backupFile(documentPath.value);
    await saveFileAtPath(documentPath.value, markdown());
    isDirty.value = false;
    return true;
  }

  async function saveAs(dialogTitle = 'Save Mind map'): Promise<boolean> {
    const r = await saveFile(markdown(), `${doc.value.root.text || 'untitled'}.md`, dialogTitle);
    if (!r.ok) return false;
    documentPath.value = r.path ?? null;
    isDirty.value = false;
    if (r.path) config.addRecentFile(r.path);
    return true;
  }

  async function open(dialogTitle = 'Open Mind map'): Promise<boolean> {
    const r = await openFile(dialogTitle);
    if (!r) return false;
    loadOpenedFile(r);
    return true;
  }

  function loadOpenedFile(result: { content: string; path?: string; name: string }): void {
    if (/\.km$/i.test(result.name)) loadFromKm(result.content);
    else loadFromMarkdown(result.content, result.path ?? null);
    if (result.path) config.addRecentFile(result.path);
  }

  async function openRecent(path: string): Promise<boolean> {
    try {
      const r = await openFileAtPath(path);
      loadOpenedFile(r);
      config.addRecentFile(path);
      return true;
    } catch (error) {
      logger.warn('最近文件无法打开，将从列表移除', error);
      config.removeRecentFile(path);
      return false;
    }
  }

  function loadFromKm(md: string): void {
    _replaceDoc(docOf(fromKmJson(md)), { resetHistory: true });
    documentPath.value = null;
    isDirty.value = true;
  }

  function loadFromMarkdown(md: string, path: string | null = null): void {
    // 优先用 markmap-lib 解析，能保留富文本
    try {
      const { root: mmRoot } = transformer.transform(md);
      _replaceDoc(docOf(mmToMind(mmRoot)), { resetHistory: true });
      documentPath.value = path;
      isDirty.value = path === null;
    } catch (e) {
      // DEBUG: markmap-lib 解析失败时降级为简化解析（保留只 - 文本 - 缩进）
      logger.warn('markmap-lib 解析失败，回退为简化解析', e);
      _replaceDoc(docOf(fromMarkdown(md)), { resetHistory: true });
      documentPath.value = path;
      isDirty.value = path === null;
    }
  }

  /** markmap IPureNode -> MindNode（生成稳定 id，保留 payload 元数据） */
  function mmToMind(n: IPureNode): MindNode {
    const payload = n.payload ?? {};
    const id = (payload['id'] as string | undefined) || newNodeId();
    return {
      id,
      text: n.content,
      note: payload['note'] as string | undefined,
      meta: { ...payload },
      children: (n.children || []).map(mmToMind),
    };
  }

  /** MindNode -> markmap Markdown（用 toMarkdown 后喂给 markmap-lib） */
  function toMarkdownForMarkmap(root: MindNode): string {
    // 直接用我们的 toMarkdown，保留纯文本结构（markmap 也能渲染纯文本）
    return toMarkdown(root);
  }

  //#endregion

  //#region 测试/性能
  function loadBigTree(): void {
    _replaceDoc(docOf(generateLargeTree(4, 5)), { resetHistory: true });
    documentPath.value = null;
    isDirty.value = true;
  }
  function reset(): void {
    _replaceDoc(docOf(createNode('中心主题')), { resetHistory: true });
    documentPath.value = null;
    isDirty.value = false;
  }
  //#endregion

  // 选中
  function select(id: string | null): void {
    selectedId.value = id;
  }

  // 键盘快捷键：已由 useShortcuts + SHORTCUT_REGISTRY 统一接管，此处的重复分发逻辑已删除。

  return {
    // state
    doc,
    selectedId,
    documentPath,
    isDirty,
    markmap,
    // computed
    markmapData,
    totalNodes,
    selectedNode,
    canUndo,
    canRedo,
    lastUndoName,
    lastRedoName,
    // actions
    setRootText,
    renameNode,
    updateNote,
    addChild,
    addSibling,
    addParent,
    removeNode,
    indentNode,
    outdentNode,
    reorderNode,
    copyNode,
    cutNode,
    pasteNode,
    moveSelection,
    undo,
    redo,
    save,
    saveAs,
    open,
    openRecent,
    search,
    loadFromKm,
    loadFromMarkdown,
    loadBigTree,
    reset,
    select,
  };
});
