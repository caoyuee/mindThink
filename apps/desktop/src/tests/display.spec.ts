import { describe, expect, it } from 'vitest';
import { truncateForDisplay } from '@/core/display';

describe('truncateForDisplay', () => {
  it('returns short text unchanged', () => {
    expect(truncateForDisplay('你好世界')).toBe('你好世界');
    expect(truncateForDisplay('short text')).toBe('short text');
    expect(truncateForDisplay('')).toBe('');
  });

  it('truncates CJK text at the width budget (wide char counts as 2)', () => {
    // 10 个汉字 = 20 单位，正好在预算内不截断
    expect(truncateForDisplay('一二三四五六七八九十')).toBe('一二三四五六七八九十');
    // 11 个汉字超出 → 保留 9 个 + 省略号
    expect(truncateForDisplay('一二三四五六七八九十百')).toBe('一二三四五六七八九…');
  });

  it('truncates latin text at the width budget (narrow char counts as 1)', () => {
    const long = 'a'.repeat(30);
    // 超预算时回退一个字符给省略号留位 → 19 个字符 + …
    expect(truncateForDisplay(long)).toBe(`${'a'.repeat(19)}…`);
    expect(truncateForDisplay('b'.repeat(20))).toBe('b'.repeat(20));
  });

  it('handles mixed width text', () => {
    // abc(3) + 一二三(6) = 9 单位，预算内
    expect(truncateForDisplay('abc一二三')).toBe('abc一二三');
    // abc(3) + 10 个汉字(20) = 23 单位超预算
    const mixed = `abc${'汉'.repeat(10)}`;
    const result = truncateForDisplay(mixed);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThan(mixed.length);
  });

  it('honors a custom budget', () => {
    expect(truncateForDisplay('abcdef', 3)).toBe('ab…');
    expect(truncateForDisplay('一二三', 4)).toBe('一…');
  });
});
