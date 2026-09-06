import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ShortcutsView from '@/views/ShortcutsView.vue';
import { SHORTCUT_REGISTRY } from '@/core/shortcuts';
import {
  matchModifier,
  matchShortcut,
  parseShortcut,
  type ModifierEvent,
} from '@/composables/useShortcuts';

const shortcutMessages = {
  title: '快捷键',
  hint: 'macOS 上 Mod 即 Cmd',
  todo: '待实现',
  sectionNodeOp: '节点操作',
  sectionScope: '视野控制',
  sectionLayout: '布局',
  sectionHistory: '撤销/重做',
  undo: '撤销',
  redo: '重做',
  indent: '向右缩进',
  outdent: '向左缩进',
  insertChild: '插入子节点',
  insertSibling: '插入兄弟节点',
  insertParent: '插入父节点',
  removeNode: '删除节点',
  navigate: '上下左右移动',
  reorder: '重排节点',
  expandCollapse: '展开或折叠',
  selectAll: '全选',
  copyNode: '复制节点',
  cutNode: '剪切节点',
  pasteNode: '粘贴节点',
  bold: '加粗',
  italic: '斜体',
  findNode: '查找节点',
  newline: '换行',
  statusPlanned: '规划中',
  dragScope: '拖动视野',
  drag: '拖动',
  dragRight: '右键拖动',
  mousewheel: '鼠标滚轮',
  touchpad: '触摸板',
  dblClickSpace: '双击空白处',
  placeRoot: '根节点居中',
  zoomScope: '缩放视野',
};

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  // 测试用 messages 仅为 zh-CN，但 vue-i18n 会用 'zh' 触发查找，
  // 关掉警告避免 stderr 噪音。
  silentTranslationWarn: true,
  messages: {
    'zh-CN': { shortcut: shortcutMessages },
    zh: { shortcut: shortcutMessages },
  },
});

function mountView() {
  return mount(ShortcutsView, {
    global: { plugins: [i18n] },
  });
}

describe('ShortcutsView', () => {
  it('renders all 4 sections (history, node, scope, layout)', () => {
    const groups = mountView().findAll('[data-testid="shortcut-group"]');
    expect(groups.length).toBe(4);
  });

  it('renders every registry entry as a row', () => {
    const wrapper = mountView();
    const rows = wrapper.findAll('[data-shortcut-id]');
    expect(rows.length).toBe(SHORTCUT_REGISTRY.length);
  });

  it('marks todo entries with the todo tag and data-status', () => {
    const wrapper = mountView();
    const todoRow = wrapper.find('[data-shortcut-id="bold"]');
    expect(todoRow.attributes('data-status')).toBe('todo');
    expect(todoRow.find('[data-testid="todo-tag"]').exists()).toBe(true);
    const readyRow = wrapper.find('[data-shortcut-id="undo"]');
    expect(readyRow.attributes('data-status')).toBe('ready');
    expect(readyRow.find('[data-testid="todo-tag"]').exists()).toBe(false);
  });

  it('renders <kbd> for each key segment', () => {
    const wrapper = mountView();
    const kbds = wrapper.findAll('kbd');
    expect(kbds.length).toBeGreaterThan(0);
  });

  // C3: 每个 descKey 都必须能在 mock i18n 中命中，否则 ShortcutsView 会显示原始 key
  // 文本（如 "shortcut.layoutInOrder"）。本测试把 registry 中所有 descKey 全部遍历一遍。
  it('every registry descKey resolves to a non-key text (no "shortcut.xxx" leak)', () => {
    const wrapper = mountView();
    const html = wrapper.html();
    // registry 涉及的 shortcut.* 键不能以原始字符串形式出现在 th 文本中
    for (const entry of SHORTCUT_REGISTRY) {
      const keyLeak = entry.descKey;
      // 找到对应行，断言它文本里不包含 "shortcut.xxx" 这类原始 key
      const row = wrapper.find(`[data-shortcut-id="${entry.id}"]`);
      expect(row.exists()).toBe(true);
      const thText = row.find('th').text();
      expect(thText, `${entry.id} leaked raw key ${keyLeak}`).not.toContain(keyLeak);
    }
    // 同时确保 layoutInOrder 已被删除（registry 不再含此 id）
    expect(SHORTCUT_REGISTRY.find((e) => e.id === 'layoutInOrder')).toBeUndefined();
    // 防止万一 html 里还残留旧文案
    expect(html).not.toContain('shortcut.layoutInOrder');
  });
});

/**
 * 键盘级匹配测试（P0-1）：修饰键必须"精确相等"，避免组合键互相抢占。
 * 测试在 Windows 语义下进行（Mod = Ctrl）；parseShortcut 按 navigator.platform 决定。
 */
function ev(
  key: string,
  mods: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {},
): ModifierEvent {
  return {
    key,
    ctrlKey: Boolean(mods.ctrl),
    altKey: Boolean(mods.alt),
    shiftKey: Boolean(mods.shift),
    metaKey: Boolean(mods.meta),
  };
}

describe('useShortcuts keyboard matching (Mod=Ctrl semantics)', () => {
  const originalPlatform = navigator.platform;

  beforeAll(() => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
  });
  afterAll(() => {
    Object.defineProperty(navigator, 'platform', { value: originalPlatform, configurable: true });
  });

  it('Ctrl+Enter → placeRoot；纯 Enter 不再被 Ctrl+Enter 抢占', () => {
    const ctrlEnter = ev('Enter', { ctrl: true });
    const plainEnter = ev('Enter');
    expect(matchShortcut(ctrlEnter, 'Mod+Enter')).toBe(true);
    expect(matchShortcut(ctrlEnter, 'Enter')).toBe(false); // P0：原实现会命中纯 Enter(addSibling)
    expect(matchShortcut(plainEnter, 'Enter')).toBe(true);
    expect(matchShortcut(plainEnter, 'Mod+Enter')).toBe(false);
  });

  it('Alt+↓ → reorder；纯 ↓ 不再被 Alt+↓ 抢占', () => {
    const altDown = ev('ArrowDown', { alt: true });
    const plainDown = ev('ArrowDown');
    expect(matchShortcut(altDown, 'Alt+↓')).toBe(true);
    expect(matchShortcut(altDown, '↓')).toBe(false); // P0：原实现会命中 navigate
    expect(matchShortcut(plainDown, '↓')).toBe(true);
    expect(matchShortcut(plainDown, 'Alt+↓')).toBe(false);
  });

  it('Shift+Tab → outdent；Tab → indent，方向不反', () => {
    const shiftTab = ev('Tab', { shift: true });
    const plainTab = ev('Tab');
    expect(matchShortcut(shiftTab, 'Shift+Tab')).toBe(true);
    expect(matchShortcut(shiftTab, 'Tab')).toBe(false); // P0：原实现命中 indent
    expect(matchShortcut(plainTab, 'Tab')).toBe(true);
    expect(matchShortcut(plainTab, 'Shift+Tab')).toBe(false);
  });

  it('Ctrl+Shift+Z → redo；Ctrl+Z → undo', () => {
    const redoEv = ev('z', { ctrl: true, shift: true });
    const undoEv = ev('z', { ctrl: true });
    expect(matchShortcut(redoEv, 'Mod+Shift+Z')).toBe(true);
    expect(matchShortcut(redoEv, 'Mod+Z')).toBe(false); // P0：原实现命中 undo
    expect(matchShortcut(undoEv, 'Mod+Z')).toBe(true);
    expect(matchShortcut(undoEv, 'Mod+Shift+Z')).toBe(false);
  });

  it('多余修饰键不会命中无修饰/少修饰条目（Ctrl+Shift+C 不触发 copyNode）', () => {
    expect(matchShortcut(ev('c', { ctrl: true, shift: true }), 'Mod+C')).toBe(false);
    expect(matchShortcut(ev('c', { ctrl: true }), 'Mod+C')).toBe(true);
    expect(matchShortcut(ev('Enter', { ctrl: true, alt: true }), 'Enter')).toBe(false);
  });

  it('parseShortcut 正确解析位标记', () => {
    expect(parseShortcut('ctrl+shift+z')).toEqual({ mod: 5, key: 'z' });
    expect(parseShortcut('alt+↑')).toEqual({ mod: 2, key: 'arrowup' });
    expect(parseShortcut('mod+z')).toEqual({ mod: 1, key: 'z' }); // Win32 语义
  });

  it('matchModifier 精确相等（mod=0 需要所有修饰键为 false）', () => {
    expect(matchModifier(ev('x'), 0)).toBe(true);
    expect(matchModifier(ev('x', { ctrl: true }), 0)).toBe(false);
    expect(matchModifier(ev('x', { alt: true }), 2)).toBe(true);
    expect(matchModifier(ev('x', { alt: true, shift: true }), 2)).toBe(false);
  });
});
