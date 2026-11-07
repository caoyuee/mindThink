import { describe, it, expect } from 'vitest';
import {
  createNode,
  cloneTree,
  findNode,
  findParent,
  findPath,
  toMarkdown,
  fromMarkdown,
  countNodes,
  generateLargeTree,
  searchNodes,
} from '@/core/tree';

describe('core/tree', () => {
  describe('createNode', () => {
    it('creates a node with text and default empty children', () => {
      const n = createNode('hello');
      expect(n.text).toBe('hello');
      expect(n.children).toEqual([]);
      expect(n.id).toMatch(/^n_/);
    });

    it('generates unique IDs', () => {
      const a = createNode('a');
      const b = createNode('b');
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('cloneTree', () => {
    it('produces a deep copy', () => {
      const original = createNode('root');
      original.children.push(createNode('a'));
      const cloned = cloneTree(original);

      cloned.children[0].text = 'changed';
      expect(original.children[0].text).toBe('a');
    });
  });

  describe('findNode / findParent / findPath', () => {
    function makeTree() {
      const root = createNode('root');
      const a = createNode('a');
      const b = createNode('b');
      const c = createNode('c');
      root.children.push(a);
      a.children.push(b);
      b.children.push(c);
      return { root, a, b, c };
    }

    it('finds nodes by id', () => {
      const { root, b } = makeTree();
      const found = findNode(root, b.id);
      expect(found?.text).toBe('b');
    });

    it('returns null for unknown id', () => {
      const { root } = makeTree();
      expect(findNode(root, 'n_does_not_exist')).toBeNull();
    });

    it('finds parent', () => {
      const { root, a, b } = makeTree();
      expect(findParent(root, b.id)?.id).toBe(a.id);
      expect(findParent(root, root.id)).toBeNull();
    });

    it('returns path from root to node', () => {
      const { root, c } = makeTree();
      const path = findPath(root, c.id);
      expect(path).not.toBeNull();
      expect(path?.map((n) => n.text)).toEqual(['root', 'a', 'b', 'c']);
    });
  });

  describe('toMarkdown / fromMarkdown', () => {
    it('serializes a simple tree to Markdown', () => {
      const root = createNode('root');
      root.children.push(createNode('a'));
      root.children.push(createNode('b'));
      const md = toMarkdown(root);
      expect(md).toContain('- root');
      expect(md).toContain('  - a');
      expect(md).toContain('  - b');
    });

    it('round-trips through toMarkdown -> fromMarkdown', () => {
      const root = createNode('root');
      root.children.push(createNode('a'));
      const a = root.children[0];
      a.children.push(createNode('a.1'));
      a.children.push(createNode('a.2'));

      const md = toMarkdown(root);
      const parsed = fromMarkdown(md);
      expect(parsed.text).toBe('root');
      expect(parsed.children[0].text).toBe('a');
      expect(parsed.children[0].children.map((c) => c.text)).toEqual(['a.1', 'a.2']);
    });
  });

  describe('searchNodes', () => {
    it('returns a root-to-match path', () => {
      const root = createNode('Root');
      const child = createNode('Design');
      root.children.push(child);
      expect(searchNodes(root, 'design')[0]?.map((node) => node.text)).toEqual(['Root', 'Design']);
    });

    it('returns no results for blank input', () => {
      expect(searchNodes(createNode('Root'), '  ')).toEqual([]);
    });
  });

  describe('countNodes', () => {
    it('counts all nodes recursively', () => {
      const root = generateLargeTree(3, 3);
      // branching=3, depth=3: 1 + 3 + 9 + 27 = 40
      expect(countNodes(root)).toBe(40);
    });

    it('counts single node', () => {
      expect(countNodes(createNode('only'))).toBe(1);
    });
  });
});
