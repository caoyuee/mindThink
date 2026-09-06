import { describe, expect, it } from 'vitest';
import { buildMenuSpec, MENU_LABEL_KEYS, type MenuSpec } from '@/core/menu-spec';
import zhCN from '../i18n/locales/zh-CN.json';
import en from '../i18n/locales/en.json';
import zhTW from '../i18n/locales/zh-TW.json';
import de from '../i18n/locales/de.json';

/** Stub translator so the structure test is locale-independent. */
function stubT(key: string): string {
  return `[${key}]`;
}

type LocaleMessages = Record<string, unknown>;

function lookup(root: LocaleMessages, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as LocaleMessages)[part];
    }
    return undefined;
  }, root);
}

describe('native menu spec structure', () => {
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
    expect(accel('open-recent')).toBeUndefined();
    expect(accel('new-window')).toBeUndefined();
    expect(accel('about')).toBeUndefined();
  });

  it('File menu ends with a separator then a Quit role', () => {
    const file = spec.submenus[1];
    const tail = file.items.slice(-2);
    expect(tail[0]).toEqual({ kind: 'separator' });
    expect(tail[1]).toEqual({ kind: 'role', role: 'quit', label: stubT('menu.quit') });
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

  it('View menu pairs toggle-devtools custom item with a Fullscreen role', () => {
    const view = spec.submenus[3];
    expect(view.items).toHaveLength(2);
    const first = view.items[0];
    expect(first.kind).toBe('custom');
    expect(first.kind === 'custom' && first.id).toBe('toggle-devtools');
    expect(view.items[1]).toEqual({
      kind: 'role',
      role: 'fullscreen',
      label: stubT('menu.fullscreen'),
    });
  });
});

describe('native menu labels are complete across all four locales', () => {
  const locales: Record<string, LocaleMessages> = {
    'zh-CN': zhCN as LocaleMessages,
    en: en as LocaleMessages,
    'zh-TW': zhTW as LocaleMessages,
    de: de as LocaleMessages,
  };

  it('resolves every label key to a non-empty string', () => {
    expect(MENU_LABEL_KEYS.length).toBeGreaterThan(0);
    for (const locale of Object.keys(locales)) {
      for (const key of MENU_LABEL_KEYS) {
        const value = lookup(locales[locale], key);
        expect(typeof value, `${locale} missing/empty ${key}`).toBe('string');
        expect((value as string).trim().length, `${locale} empty ${key}`).toBeGreaterThan(0);
      }
    }
  });
});
