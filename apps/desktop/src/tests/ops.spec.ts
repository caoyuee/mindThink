import { describe, expect, it } from 'vitest';
import { applyOpsToDoc, parseMindMapOps } from '@/core/ops';
import { createNode, findNode, type MindNode } from '@/core/tree';

let seq = 0;
const newId = () => `t_${(seq += 1)}`;

function sampleTree(): MindNode {
  // Root
  // ├─ A
  // │  └─ A1
  // └─ B
  return createNode('Root', {
    children: [createNode('A', { children: [createNode('A1')] }), createNode('B')],
  });
}

describe('parseMindMapOps', () => {
  it('accepts a valid batch', () => {
    const ops = parseMindMapOps([
      { op: 'add_child', parentId: 'r', text: '新节点', note: 'n' },
      { op: 'add_sibling', siblingId: 'a', text: 'S' },
      { op: 'update_node', nodeId: 'a', text: 'A2', note: null },
      { op: 'delete_node', nodeId: 'b' },
    ]);
    expect(typeof ops).toBe('object');
    expect((ops as unknown[]).length).toBe(4);
  });

  it('rejects malformed batches with readable messages', () => {
    expect(parseMindMapOps('nope')).toContain('数组');
    expect(parseMindMapOps([])).toContain('不能为空');
    expect(parseMindMapOps([{ op: 'destroy' }])).toContain('无效');
    expect(parseMindMapOps([{ op: 'add_child', parentId: '', text: 'x' }])).toContain('parentId');
    expect(parseMindMapOps([{ op: 'add_child', parentId: 'r', text: '  ' }])).toContain('text');
    expect(parseMindMapOps([{ op: 'update_node', nodeId: 'a' }])).toContain('text 或 note');
    expect(
      parseMindMapOps(Array.from({ length: 101 }, () => ({ op: 'delete_node', nodeId: 'x' }))),
    ).toContain('100');
  });
});

describe('applyOpsToDoc', () => {
  it('adds children and siblings with fresh ids', () => {
    const root = sampleTree();
    const a = (root.children as MindNode[])[0] as MindNode;
    const result = applyOpsToDoc(
      { root },
      [
        { op: 'add_child', parentId: a.id, text: 'A2' },
        { op: 'add_sibling', siblingId: a.id, text: 'A-plus' },
      ],
      newId,
    );
    expect(result.appliedCount).toBe(2);
    const newA2 = (result.doc.root.children[0]?.children ?? [])[1];
    expect(newA2?.text).toBe('A2');
    const sibs = result.doc.root.children.map((child) => child.text);
    expect(sibs).toEqual(['A', 'A-plus', 'B']);
    // 原文档不被修改（纯函数）
    expect(root.children.length).toBe(2);
  });

  it('updates and deletes nodes, guards root', () => {
    const root = sampleTree();
    const a = (root.children as MindNode[])[0] as MindNode;
    const a1 = (a.children as MindNode[])[0] as MindNode;
    const result = applyOpsToDoc(
      { root },
      [
        { op: 'update_node', nodeId: a1.id, text: 'A1-renamed', note: null },
        { op: 'delete_node', nodeId: root.id },
        { op: 'delete_node', nodeId: 'missing' },
      ],
      newId,
    );
    expect(result.appliedCount).toBe(1);
    const renamed = findNode(result.doc.root, a1.id);
    expect(renamed?.text).toBe('A1-renamed');
    expect(renamed?.note).toBeUndefined();
    expect(result.results[1]).toMatchObject({ ok: false });
    expect(result.results[2]).toMatchObject({ ok: false });
    expect(findNode(result.doc.root, root.id)).not.toBeNull();
  });
});
