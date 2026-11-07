import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useMindmapStore } from '@/stores/mindmap';

describe('mindmap store selection and history', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('adds to the selected parent and updates undo/redo state reactively', () => {
    const store = useMindmapStore();
    const firstId = store.addChild(store.doc.root.id, 'First');
    expect(firstId).toBeTruthy();
    expect(store.selectedId).toBe(firstId);
    expect(store.canUndo).toBe(true);

    const secondId = store.addChild(firstId!, 'Second');
    expect(store.selectedId).toBe(secondId);
    expect(store.doc.root.children[0]?.children[0]?.text).toBe('Second');

    store.undo();
    expect(store.doc.root.children[0]?.children).toHaveLength(0);
    expect(store.canRedo).toBe(true);

    store.redo();
    expect(store.doc.root.children[0]?.children[0]?.id).toBe(secondId);
    expect(store.canUndo).toBe(true);
  });

  it('does not add history for a missing parent', () => {
    const store = useMindmapStore();
    expect(store.addChild('missing', 'Ignored')).toBeNull();
    expect(store.canUndo).toBe(false);
  });

  it('reorders siblings up and down, and is undoable', () => {
    const store = useMindmapStore();
    const a = store.addChild(store.doc.root.id, 'A')!;
    const b = store.addChild(store.doc.root.id, 'B')!;
    const c = store.addChild(store.doc.root.id, 'C')!;
    expect(store.doc.root.children.map((n) => n.id)).toEqual([a, b, c]);

    store.reorderNode(b, 'up');
    expect(store.doc.root.children.map((n) => n.id)).toEqual([b, a, c]);

    store.reorderNode(b, 'down');
    store.reorderNode(b, 'down');
    expect(store.doc.root.children.map((n) => n.id)).toEqual([a, c, b]);

    store.undo();
    expect(store.doc.root.children.length).toBe(3);
    expect(store.doc.root.children.map((n) => n.id)).toEqual([a, b, c]);
  });

  it('addParent wraps the selected node under a new parent', () => {
    const store = useMindmapStore();
    const child = store.addChild(store.doc.root.id, 'Child')!;
    const wrapper = store.addParent(child, 'Group');
    expect(wrapper).toBeTruthy();
    expect(store.doc.root.children.map((n) => n.id)).toEqual([wrapper]);
    expect(store.doc.root.children[0]?.children[0]?.id).toBe(child);
    expect(store.selectedId).toBe(wrapper);
    expect(store.addParent(store.doc.root.id, 'x')).toBeNull();
  });

  it('copy/cut/paste node subtrees', () => {
    const store = useMindmapStore();
    const a = store.addChild(store.doc.root.id, 'A')!;
    const a1 = store.addChild(a, 'A1')!;
    const b = store.addChild(store.doc.root.id, 'B')!;

    expect(store.copyNode(a)).toBe(true);
    store.select(b);
    expect(store.pasteNode()).toBe(true);
    const pastedId = store.selectedId!;
    expect(store.doc.root.children[1]?.children[0]?.id).toBe(pastedId);
    expect(store.doc.root.children[1]?.children[0]?.text).toBe('A');
    expect(store.doc.root.children[1]?.children[0]?.children[0]?.id).not.toBe(a1);
    expect(store.doc.root.children[1]?.children[0]?.children[0]?.text).toBe('A1');

    const beforeCut = store.doc.root.children.length;
    expect(store.cutNode(b)).toBe(true);
    expect(store.doc.root.children.length).toBe(beforeCut - 1);
    // 剪贴板里仍有 B 子树（含一个已粘贴的 A 副本子节点），粘贴到根应成功且重贴 id
    store.select(store.doc.root.id);
    expect(store.pasteNode()).toBe(true);
    const relabeled = store.doc.root.children[store.doc.root.children.length - 1]!;
    expect(relabeled.text).toBe('B');
    expect(relabeled.id).not.toBe(b);
    expect(relabeled.children[0]?.id).not.toBe(pastedId);
  });

  it('moveSelection navigates between parent/first-child/siblings', () => {
    const store = useMindmapStore();
    const first = store.addChild(store.doc.root.id, 'First')!;
    const second = store.addChild(store.doc.root.id, 'Second')!;
    store.select(first);

    expect(store.moveSelection('next')).toBe(true);
    expect(store.selectedId).toBe(second);
    expect(store.moveSelection('prev')).toBe(true);
    expect(store.selectedId).toBe(first);
    expect(store.moveSelection('parent')).toBe(true);
    expect(store.selectedId).toBe(store.doc.root.id);
    expect(store.moveSelection('parent')).toBe(false);
    expect(store.moveSelection('firstChild')).toBe(true);
    expect(store.selectedId).toBe(first);
  });

  it('does not push an empty undo entry when removing the root or a missing node (P2-1)', () => {
    const store = useMindmapStore();
    store.addChild(store.doc.root.id, 'Child');
    const beforeTotal = store.totalNodes;
    expect(store.canUndo).toBe(true); // 来自 addChild

    store.removeNode(store.doc.root.id); // 根：前置守卫，不入栈
    expect(store.totalNodes).toBe(beforeTotal);
    expect(store.doc.root.children.map((n) => n.text)).toEqual(['Child']);

    store.undo(); // 只回退 addChild，说明 removeNode(根) 没追加历史
    expect(store.doc.root.children).toHaveLength(0);
    expect(store.canUndo).toBe(false);

    store.addChild(store.doc.root.id, 'Child');
    expect(store.canUndo).toBe(true);
    store.removeNode('missing-id'); // 不存在：前置守卫，不入栈
    store.undo();
    expect(store.canUndo).toBe(false);
  });
});
