import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ShortcutsView from '@/views/ShortcutsView.vue';
import { SHORTCUT_REGISTRY } from '@/core/shortcuts';

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
  insertChild: '插入子节点',
  outdent: '左缩进',
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
  dragScope: '拖动视野',
  drag: '拖动',
  dragRight: '右键拖动',
  mousewheel: '鼠标滚轮',
  touchpad: '触控板',
  dblClickSpace: '双击空白处',
  placeRoot: '根节点居中',
  zoomScope: '缩放视野',
  layoutInOrder: '整理布局',
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
});
