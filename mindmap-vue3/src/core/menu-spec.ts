/**
 * Native menu spec builder (pure module, shared by Web + Tauri).
 *
 * This module has NO dependency on vue / vue-i18n / platform: it only turns an
 * injected translation resolver `(key) => label` into a JSON-friendly
 * {@link MenuSpec}. On the desktop shell the spec is handed to the Rust command
 * `rebuild_native_menu`, which rebuilds the native system menu from it so the
 * menu follows the current UI locale instantly.
 *
 * IDs and structure mirror the hard-coded English default menu in
 * `src-tauri/src/lib.rs::build_menu` (app / File / Edit / View / Help). Role
 * items keep Tauri's native role semantics (About metadata / Quit / Edit roles /
 * Fullscreen); they are expressed as `{ kind: 'role' }` so the Rust side never
 * degrades them to plain text items.
 */

/** Allowed native (predefined) menu roles understood by the Rust command. */
export type MenuRole =
  'about' | 'quit' | 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'select_all' | 'fullscreen';

/** A single entry inside a submenu. */
export type MenuItemSpec =
  /** Custom menu item with a stable id (emits `menu_event` with that id). */
  | { kind: 'custom'; id: string; label: string; accelerator?: string }
  /** A visual separator. */
  | { kind: 'separator' }
  /** A Tauri native/predefined role item. */
  | { kind: 'role'; role: MenuRole; label: string };

/** One top-level submenu (File / Edit / View / Help / app menu …). */
export interface MenuSubmenuSpec {
  label: string;
  items: MenuItemSpec[];
}

/** The full native menu spec sent to `rebuild_native_menu`. */
export interface MenuSpec {
  submenus: MenuSubmenuSpec[];
}

/**
 * Translation keys the builder resolves. Kept as a single source of truth so a
 * test can assert every referenced label exists in all supported locales.
 */
export const MENU_LABEL_KEYS: readonly string[] = [
  'app.name',
  'menu.file',
  'menu.edit',
  'menu.view',
  'menu.help',
  'menu.new',
  'menu.open',
  'menu.openRecent',
  'menu.newWindow',
  'menu.save',
  'menu.quit',
  'menu.about',
  'menu.undo',
  'menu.redo',
  'menu.cut',
  'menu.copy',
  'menu.paste',
  'menu.selectAll',
  'menu.toggleDevtools',
  'menu.fullscreen',
];

/** Minimal translation resolver shape injected by the caller. */
export type MenuTranslate = (key: string) => string;

/**
 * Build the full native menu for the current locale.
 *
 * Accelerators are kept identical to the previous English default:
 * New = CmdOrCtrl+N, Open = CmdOrCtrl+O, Save = CmdOrCtrl+S,
 * toggle-devtools = CmdOrCtrl+Shift+D. File menu ends with a separator + Quit.
 */
export function buildMenuSpec(t: MenuTranslate): MenuSpec {
  return {
    submenus: [
      {
        // macOS app menu (label = app name); Windows/Linux renders it first.
        label: t('app.name'),
        items: [
          { kind: 'role', role: 'about', label: t('menu.about') },
          { kind: 'separator' },
          { kind: 'role', role: 'quit', label: t('menu.quit') },
        ],
      },
      {
        label: t('menu.file'),
        items: [
          { kind: 'custom', id: 'new', label: t('menu.new'), accelerator: 'CmdOrCtrl+N' },
          { kind: 'custom', id: 'open', label: t('menu.open'), accelerator: 'CmdOrCtrl+O' },
          { kind: 'custom', id: 'open-recent', label: t('menu.openRecent') },
          { kind: 'custom', id: 'new-window', label: t('menu.newWindow') },
          { kind: 'custom', id: 'save', label: t('menu.save'), accelerator: 'CmdOrCtrl+S' },
          { kind: 'separator' },
          { kind: 'role', role: 'quit', label: t('menu.quit') },
        ],
      },
      {
        label: t('menu.edit'),
        items: [
          { kind: 'role', role: 'undo', label: t('menu.undo') },
          { kind: 'role', role: 'redo', label: t('menu.redo') },
          { kind: 'separator' },
          { kind: 'role', role: 'cut', label: t('menu.cut') },
          { kind: 'role', role: 'copy', label: t('menu.copy') },
          { kind: 'role', role: 'paste', label: t('menu.paste') },
          { kind: 'role', role: 'select_all', label: t('menu.selectAll') },
        ],
      },
      {
        label: t('menu.view'),
        items: [
          {
            kind: 'custom',
            id: 'toggle-devtools',
            label: t('menu.toggleDevtools'),
            accelerator: 'CmdOrCtrl+Shift+D',
          },
          { kind: 'role', role: 'fullscreen', label: t('menu.fullscreen') },
        ],
      },
      {
        label: t('menu.help'),
        items: [{ kind: 'custom', id: 'about', label: t('menu.about') }],
      },
    ],
  };
}
