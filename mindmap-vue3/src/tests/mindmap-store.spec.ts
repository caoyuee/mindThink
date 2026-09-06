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
});
