import { describe, expect, it } from 'vitest';
import { buildDocumentTitle, documentDisplayName } from '@/core/document-title';

describe('document window title', () => {
  it('uses the basename of the current path', () => {
    expect(documentDisplayName('C:\\maps\\plan.md', 'Ignored', 'Untitled')).toBe('plan.md');
    expect(documentDisplayName('/home/user/plan.md', 'Ignored', 'Untitled')).toBe('plan.md');
  });

  it('falls back to root text and the untitled label', () => {
    expect(documentDisplayName(null, 'Roadmap', 'Untitled')).toBe('Roadmap');
    expect(documentDisplayName(null, '   ', 'Untitled')).toBe('Untitled');
  });

  it('prefixes dirty documents with an asterisk', () => {
    expect(buildDocumentTitle('/maps/plan.md', 'Ignored', true, 'DesktopNaotu', 'Untitled')).toBe(
      '* plan.md · DesktopNaotu',
    );
    expect(buildDocumentTitle('/maps/plan.md', 'Ignored', false, 'DesktopNaotu', 'Untitled')).toBe(
      'plan.md · DesktopNaotu',
    );
  });
});
