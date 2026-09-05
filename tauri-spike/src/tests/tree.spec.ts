import { describe, it, expect } from 'vitest';
import { fromKmJson } from '@/core/km';
import { createMcpContext, parseMcpRequest } from '@/core/mcp';
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

  describe('fromKmJson', () => {
    it('imports KityMinder data and preserves note metadata', () => {
      const root = fromKmJson(
        JSON.stringify({
          root: {
            data: { text: '旧脑图', note: '说明' },
            children: [{ data: { text: '子节点' } }],
          },
        }),
      );
      expect(root.text).toBe('旧脑图');
      expect(root.note).toBe('说明');
      expect(root.children[0]?.text).toBe('子节点');
    });

    it('rejects invalid KM JSON', () => {
      expect(() => fromKmJson('{invalid')).toThrow('KM 文件不是有效 JSON');
    });
  });

  describe('searchNodes', () => {
    it('returns matching nodes with their root paths', () => {
      const root = createNode('Root');
      const child = createNode('Design System');
      child.children.push(createNode('Tokens'));
      root.children.push(child);
      const results = searchNodes(root, 'design');
      expect(results).toHaveLength(1);
      expect(results[0]?.map((node) => node.text)).toEqual(['Root', 'Design System']);
    });

    it('returns no results for an empty query', () => {
      expect(searchNodes(createNode('Root'), '  ')).toEqual([]);
    });
  });

  describe('parseMcpRequest', () => {
    it('validates MCP request fields', () => {
      expect(parseMcpRequest({ requestId: '1', tool: 'get_current_mindmap' })).toEqual({
        requestId: '1',
        tool: 'get_current_mindmap',
        arguments: undefined,
      });
      expect(() => parseMcpRequest({ tool: 'missing-id' })).toThrow('requestId');
    });
  });

  describe('createMcpContext', () => {
    it('exposes the current markdown and supported mutation tools', () => {
      const root = createNode('Root');
      root.children.push(createNode('Child'));
      const context = createMcpContext({ root });
      expect(context.current.markdown).toContain('- Root');
      expect(context.current.nodeCount).toBe(2);
      expect(context.tools.map((tool) => tool.name)).toContain('update_node');
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
