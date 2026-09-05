import { describe, expect, it } from 'vitest';
import { exportPng, exportSvg } from '@/core/file';

describe('core/file exports', () => {
  it('exposes SVG and PNG export functions', () => {
    expect(typeof exportSvg).toBe('function');
    expect(typeof exportPng).toBe('function');
  });
});
