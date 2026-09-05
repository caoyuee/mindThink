import { describe, expect, it } from 'vitest';
import { fromKmJson } from '@/core/km';

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

  it('rejects malformed input', () => {
    expect(() => fromKmJson('{bad')).toThrow('KM 文件不是有效 JSON');
  });
});
