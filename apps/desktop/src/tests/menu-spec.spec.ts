import { describe, expect, it } from 'vitest';
import {
  buildMenuSpec,
  buildRecentSubmenuItems,
  MENU_LABEL_KEYS,
  type MenuSpec,
} from '@/core/menu-spec';
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

function customIds(items: MenuSpec['submenus'][number]['items']): string[] {
  return items.filter((i) => i.kind === 'custom').map((i) => (i.kind === 'custom' ? i.id : ''));
}

function findSubmenu(spec: MenuSpec, id: string) {
  for (const s of spec.submenus) {
    const hit = s.items.find((i) => i.kind === 'submenu' && i.id === id);
    if (hit && hit.kind === 'submenu') return hit;
  }
  return undefined;
}

describe('native menu spec structure', () => {
  const spec = buildMenuSpec(stubT, []);

  it('emits app / Navigate / File / Edit / View / Help in order', () => {
    expect(spec.submenus.map((s) => s.label)).toEqual([
      stubT('app.name'),
      stubT('menu.navigate'),
      stubT('menu.file'),
      stubT('menu.edit'),
      stubT('menu.view'),
      stubT('menu.help'),
    ]);
  });

  it('Navigate submenu mirrors the removed AppHeader route tabs', () => {
    const navigate = spec.submenus[1];
    expect(customIds(navigate.items)).toEqual([
      'nav:editor',
      'nav:settings',
      'nav:shortcuts',
      'nav:about',
    ]);
    expect(navigate.items.map((i) => (i.kind === 'separator' ? '' : i.label))).toEqual([
      stubT('menu.goEditor'),
      stubT('menu.goSettings'),
      stubT('menu.goShortcuts'),
      stubT('menu.goAbout'),
    ]);
  });

  it('keeps stable top-level custom ids and their accelerators', () => {
    const all = spec.submenus.flatMap((s) => s.items);
    expect(customIds(all)).toEqual([
      'nav:editor',
      'nav:settings',
      'nav:shortcuts',
      'nav:about',
      'new',
      'open',
      'new-window',
      'save',
      'toggle-devtools',
      'theme-toggle',
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
    expect(accel('new-window')).toBeUndefined();
    expect(accel('theme-toggle')).toBeUndefined();
    expect(accel('about')).toBeUndefined();
  });

  it('File menu exposes Open Recent as a nested submenu', () => {
    const recent = findSubmenu(spec, 'open-recent');
    expect(recent).toBeDefined();
    expect(recent?.kind === 'submenu' && recent.label).toBe(stubT('menu.openRecent'));
  });

  it('File menu ends with a separator then a Quit role', () => {
    const file = spec.submenus[2];
    const tail = file.items.slice(-2);
    expect(tail[0]).toEqual({ kind: 'separator' });
    expect(tail[1]).toEqual({ kind: 'role', role: 'quit', label: stubT('menu.quit') });
  });

  it('Edit menu is a fixed native role sequence', () => {
    const edit = spec.submenus[3];
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

  it('View menu hosts devtools / fullscreen / theme toggle / language submenu', () => {
    const view = spec.submenus[4];
    expect(view.items).toHaveLength(6);
    expect(view.items[0]).toMatchObject({ kind: 'custom', id: 'toggle-devtools' });
    expect(view.items[1]).toEqual({ kind: 'separator' });
    expect(view.items[2]).toEqual({
      kind: 'role',
      role: 'fullscreen',
      label: stubT('menu.fullscreen'),
    });
    expect(view.items[3]).toEqual({ kind: 'separator' });
    expect(view.items[4]).toMatchObject({ kind: 'custom', id: 'theme-toggle' });
    const language = view.items[5];
    expect(language.kind).toBe('submenu');
    if (language.kind === 'submenu') {
      expect(language.id).toBe('language');
      expect(language.label).toBe(stubT('menu.language'));
      // 语言名是各语言原生拼写，永不翻译
      expect(language.items.map((i) => (i.kind === 'custom' ? i.id : ''))).toEqual([
        'lang:zh-CN',
        'lang:zh-TW',
        'lang:en',
        'lang:de',
      ]);
      expect(language.items.map((i) => (i.kind === 'custom' ? i.label : ''))).toEqual([
        '简体中文',
        '繁體中文',
        'English',
        'Deutsch',
      ]);
    }
  });
});

describe('Open Recent submenu contents', () => {
  it('shows a placeholder when there are no recent files', () => {
    const items = buildRecentSubmenuItems(stubT, []);
    expect(items).toEqual([{ kind: 'custom', id: 'recent-none', label: stubT('menu.noRecent') }]);
  });

  it('lists recent:<path> items, a separator, then recent-clear', () => {
    const items = buildRecentSubmenuItems(stubT, ['/a/b/one.md', '/a/two.md']);
    expect(items).toEqual([
      { kind: 'custom', id: 'recent:/a/b/one.md', label: 'one.md' },
      { kind: 'custom', id: 'recent:/a/two.md', label: 'two.md' },
      { kind: 'separator' },
      { kind: 'custom', id: 'recent-clear', label: stubT('menu.clearRecent') },
    ]);
  });

  it('uses the file basename as the menu label', () => {
    const items = buildRecentSubmenuItems(stubT, ['C:\\Users\\me\\Doc.md']);
    expect(items[0]).toEqual({
      kind: 'custom',
      id: 'recent:C:\\Users\\me\\Doc.md',
      label: 'Doc.md',
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
