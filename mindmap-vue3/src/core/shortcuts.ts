/**
 * 快捷键注册表
 *
 * ShortcutsView 与 useShortcuts 共用此模块，避免"显示的快捷键"和"实际绑定"
 * 两边数据漂移。
 *
 * 用法:
 *   - ShortcutsView 直接读 SHORTCUT_REGISTRY + SHORTCUT_SECTIONS 渲染。
 *   - useShortcuts.bindById(handlers) 按 id 把 handler 展开为可识别格式。
 *
 * 每条 entry:
 *   - id: 稳定 id，与 command stack 命名保持一致
 *   - section: 分组（'history' | 'node' | 'scope' | 'layout'）
 *   - descKey: i18n 描述
 *   - keys: 同一动作可以绑定多个键位组合，例如 undo 同时支持 Mod+Z 与 Mod+Shift+Z
 *   - status: 'ready' 已实现 / 'todo' UI 展示但暂不绑定
 */

export type ShortcutSection = 'history' | 'node' | 'scope' | 'layout';

export type ShortcutStatus = 'ready' | 'todo';

export interface ShortcutEntry {
  id: string;
  section: ShortcutSection;
  descKey: string;
  /** 每个数组项是同一动作的一组键，e.g. ['Mod', 'Z']。空数组表示"仅占位待实现"。 */
  keys: string[][];
  status: ShortcutStatus;
}

export const SHORTCUT_SECTIONS: { key: ShortcutSection; i18nKey: string }[] = [
  { key: 'history', i18nKey: 'shortcut.sectionHistory' },
  { key: 'node', i18nKey: 'shortcut.sectionNodeOp' },
  { key: 'scope', i18nKey: 'shortcut.sectionScope' },
  { key: 'layout', i18nKey: 'shortcut.sectionLayout' },
];

/** 全局快捷键注册表，id 唯一。 */
export const SHORTCUT_REGISTRY: ShortcutEntry[] = [
  // ─── History ───────────────────────────────────────────
  {
    id: 'undo',
    section: 'history',
    descKey: 'shortcut.undo',
    keys: [['Mod', 'Z']],
    status: 'ready',
  },
  {
    id: 'redo',
    section: 'history',
    descKey: 'shortcut.redo',
    keys: [
      ['Mod', 'Shift', 'Z'],
      ['Mod', 'Y'],
    ],
    status: 'ready',
  },

  // ─── Node operations ───────────────────────────────────
  {
    id: 'indent',
    section: 'node',
    descKey: 'shortcut.insertChild',
    keys: [['Tab']],
    status: 'ready',
  },
  {
    id: 'outdent',
    section: 'node',
    descKey: 'shortcut.outdent',
    keys: [['Shift', 'Tab']],
    status: 'ready',
  },
  {
    id: 'addSibling',
    section: 'node',
    descKey: 'shortcut.insertSibling',
    keys: [['Enter']],
    status: 'ready',
  },
  {
    id: 'addParent',
    section: 'node',
    descKey: 'shortcut.insertParent',
    keys: [['F2']],
    status: 'ready',
  },
  {
    id: 'removeNode',
    section: 'node',
    descKey: 'shortcut.removeNode',
    keys: [['Delete']],
    status: 'ready',
  },
  {
    id: 'navigate',
    section: 'node',
    descKey: 'shortcut.navigate',
    keys: [['↑'], ['↓'], ['←'], ['→']],
    status: 'ready',
  },
  {
    id: 'reorder',
    section: 'node',
    descKey: 'shortcut.reorder',
    keys: [
      ['Alt', '↑'],
      ['Alt', '↓'],
    ],
    status: 'ready',
  },
  {
    id: 'expandCollapse',
    section: 'node',
    descKey: 'shortcut.expandCollapse',
    keys: [['Space']],
    status: 'ready',
  },
  {
    id: 'selectAll',
    section: 'node',
    descKey: 'shortcut.selectAll',
    keys: [['Mod', 'A']],
    status: 'todo',
  },
  {
    id: 'copyNode',
    section: 'node',
    descKey: 'shortcut.copyNode',
    keys: [['Mod', 'C']],
    status: 'ready',
  },
  {
    id: 'cutNode',
    section: 'node',
    descKey: 'shortcut.cutNode',
    keys: [['Mod', 'X']],
    status: 'ready',
  },
  {
    id: 'pasteNode',
    section: 'node',
    descKey: 'shortcut.pasteNode',
    keys: [['Mod', 'V']],
    status: 'ready',
  },
  {
    id: 'findNode',
    section: 'node',
    descKey: 'shortcut.findNode',
    keys: [['Mod', 'F']],
    status: 'ready',
  },
  {
    id: 'bold',
    section: 'node',
    descKey: 'shortcut.bold',
    keys: [['Mod', 'B']],
    status: 'todo',
  },
  {
    id: 'italic',
    section: 'node',
    descKey: 'shortcut.italic',
    keys: [['Mod', 'I']],
    status: 'todo',
  },
  {
    id: 'newline',
    section: 'node',
    descKey: 'shortcut.newline',
    keys: [['Shift', 'Enter']],
    status: 'todo',
  },

  // ─── View control ──────────────────────────────────────
  {
    id: 'placeRoot',
    section: 'layout',
    descKey: 'shortcut.placeRoot',
    keys: [['Mod', 'Enter']],
    status: 'ready',
  },
  {
    id: 'layoutInOrder',
    section: 'layout',
    descKey: 'shortcut.layoutInOrder',
    keys: [['Mod', '0']],
    status: 'todo',
  },
  {
    id: 'dblClickSpace',
    section: 'scope',
    descKey: 'shortcut.dblClickSpace',
    keys: [],
    status: 'todo',
  },
];

/** 取得一个 id 对应的 entry，便于 useShortcuts.bindById 解析。 */
export function getShortcutById(id: string): ShortcutEntry | undefined {
  return SHORTCUT_REGISTRY.find((e) => e.id === id);
}
