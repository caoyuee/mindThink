import { describe, expect, it } from 'vitest';
import { createNode } from '@/core/tree';
import { fromKmJson, toKmJson } from '@/core/km';

describe('core/km', () => {
  it('imports KityMinder nodes and notes', () => {
    const root = fromKmJson(
      JSON.stringify({
        root: {
          data: { text: 'Legacy', note: 'Details' },
          children: [{ data: { text: 'Child' } }],
        },
      }),
    );
    expect(root.text).toBe('Legacy');
    expect(root.note).toBe('Details');
    expect(root.children[0]?.text).toBe('Child');
  });

  it('round-trips toKmJson(fromKmJson) preserving hierarchy', () => {
    const input =
      '{"root":{"data":{"text":"Root","note":"n"},"children":[' +
      '{"data":{"text":"A","priority":1},"children":[{"data":{"text":"A1"}}]},' +
      '{"data":{"text":"B"}}]}}';
    const root = fromKmJson(input);
    const exported = JSON.parse(toKmJson(root));
    expect(exported.template).toBe('filetree');
    expect(exported.theme).toBe('fresh-blue');
    expect(exported.root.data.text).toBe('Root');
    expect(exported.root.children).toHaveLength(2);
    expect(exported.root.children[0].children[0].data.text).toBe('A1');
    // meta 扩展字段保留
    expect(exported.root.children[0].data.priority).toBe(1);
  });

  it('omits children array for leaf nodes', () => {
    const root = createNode('Only');
    const exported = JSON.parse(toKmJson(root));
    expect(exported.root.data.text).toBe('Only');
    expect(exported.root.children).toBeUndefined();
  });

  it('rejects malformed input', () => {
    expect(() => fromKmJson('{bad')).toThrow('KM 文件不是有效 JSON');
  });
});
