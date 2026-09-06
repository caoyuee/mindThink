import { describe, expect, it } from 'vitest';
import { buildMenuSpec, type MenuSpec } from '@/core/menu-spec';

/** Stub translator so the structure test is locale-independent. */
function stubT(key: string): string {
  return `[${key}]`;
}

describe('native menu spec structure (shared pure module)', () => {
  const spec = buildMenuSpec(stubT);

  function customIds(items: MenuSpec['submenus'][number]['items']): string[] {
    return items.filter((i) => i.kind === 'custom').map((i) => (i.kind === 'custom' ? i.id : ''));
  }

  it('emits app / File / Edit / View / Help in order', () => {
    expect(spec.submenus.map((s) => s.label)).toEqual([
      stubT('app.name'),
      stubT('menu.file'),
      stubT('menu.edit'),
      stubT('menu.view'),
      stubT('menu.help'),
    ]);
  });

  it('keeps stable custom ids and their accelerators', () => {
    const all = spec.submenus.flatMap((s) => s.items);
    expect(customIds(all)).toEqual([
      'new',
      'open',
      'open-recent',
      'new-window',
      'save',
      'toggle-devtools',
      'about',
    ]);

    const accel = (id: string) => {
      const item = all.find((i) => i.kind === 'custom' && i.id === id);
      return item?.kind === 'custom' ? item.accelerator : undefined;
    };
    expect(accel('new')).toBe('CmdOrCtrl+N');
    expect(accel('open')).toBe('CmdOrCtrl+O');
    expect(accel('save')).toBe('CmdOrCtrl+S');
    expect(accel('toggle-devtools')).toBe('CmdOrCtrl+Shift+D');
    expect(accel('about')).toBeUndefined();
  });

  it('Edit menu is a fixed native role sequence', () => {
    const edit = spec.submenus[2];
    expect(edit.items.map((i) => (i.kind === 'role' ? i.role : i.kind))).toEqual([
      'undo',
      'redo',
      'separator',
      'cut',
      'copy',
      'paste',
      'select_all',
    ]);
  });

  it('File menu ends with a separator then a Quit role', () => {
    const file = spec.submenus[1];
    const tail = file.items.slice(-2);
    expect(tail[0]).toEqual({ kind: 'separator' });
    expect(tail[1]).toEqual({ kind: 'role', role: 'quit', label: stubT('menu.quit') });
  });
});
