import { describe, expect, it } from 'vitest';
import {
  basename,
  formatBackupStamp,
  isBackupFileName,
  selectBackupsToDelete,
  sortBackupPathsDesc,
} from '@/core/backup';

describe('backup utils', () => {
  it('formatBackupStamp produces filename-safe, orderable stamp', () => {
    const s = formatBackupStamp(new Date('2026-11-07T10:20:30.123Z'));
    expect(s).toBe('2026-11-07T10-20-30-123Z');
    expect(s).not.toMatch(/[:.]/);
  });

  it('isBackupFileName matches only <name>.backup- prefixed files', () => {
    expect(isBackupFileName('a.md', 'a.md.backup-2026-01-01T00-00-00-000Z')).toBe(true);
    expect(isBackupFileName('a.md', 'a.md')).toBe(false);
    expect(isBackupFileName('a.md', 'a.md~')).toBe(false);
    expect(isBackupFileName('a.md', 'b.md.backup-2026-01-01T00-00-00-000Z')).toBe(false);
  });

  it('sortBackupPathsDesc orders by ISO stamp descending', () => {
    const paths = [
      '/d/a.md.backup-2026-01-01T00-00-00-000Z',
      '/d/a.md.backup-2026-03-03T00-00-00-000Z',
      '/d/a.md.backup-2026-02-02T00-00-00-000Z',
    ];
    expect(sortBackupPathsDesc(paths)).toEqual([
      '/d/a.md.backup-2026-03-03T00-00-00-000Z',
      '/d/a.md.backup-2026-02-02T00-00-00-000Z',
      '/d/a.md.backup-2026-01-01T00-00-00-000Z',
    ]);
  });

  it('selectBackupsToDelete keeps newest N and returns the rest', () => {
    const sorted = [
      '/d/a.md.backup-2026-03-03T00-00-00-000Z',
      '/d/a.md.backup-2026-02-02T00-00-00-000Z',
      '/d/a.md.backup-2026-01-01T00-00-00-000Z',
    ];
    expect(selectBackupsToDelete(sorted, 2)).toEqual(['/d/a.md.backup-2026-01-01T00-00-00-000Z']);
    expect(selectBackupsToDelete(sorted, 0)).toEqual(sorted);
    expect(selectBackupsToDelete(sorted, 10)).toEqual([]);
  });

  it('basename extracts filename cross-platform', () => {
    expect(basename('/a/b/c.md')).toBe('c.md');
    expect(basename('C:\\a\\b\\c.md')).toBe('c.md');
    expect(basename('c.md')).toBe('c.md');
  });
});
