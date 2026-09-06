<script setup lang="ts">
/**
 * 快捷键帮助页
 *
 * 展示所有可用的快捷键，按使用场景分组。键位用 <kbd> 渲染，
 * 描述从 i18n 读。
 */
import { useI18n } from 'vue-i18n';

interface ShortcutItem {
  keys: string[];
  descKey: string;
}

interface ShortcutGroup {
  sectionKey: string;
  items: ShortcutItem[];
}

const { t } = useI18n();

/** 各组按用户使用顺序排列；macOS 平台的 mod 在 useShortcuts 内部已映射为 Cmd */
const groups: ShortcutGroup[] = [
  {
    sectionKey: 'shortcut.sectionHistory',
    items: [
      { keys: ['Mod', 'Z'], descKey: 'shortcut.undo' },
      { keys: ['Mod', 'Shift', 'Z'], descKey: 'shortcut.redo' },
      { keys: ['Mod', 'Y'], descKey: 'shortcut.redo' },
    ],
  },
  {
    sectionKey: 'shortcut.sectionNodeOp',
    items: [
      { keys: ['Tab'], descKey: 'shortcut.insertChild' },
      { keys: ['Shift', 'Tab'], descKey: 'shortcut.outdent' },
      { keys: ['Enter'], descKey: 'shortcut.insertSibling' },
      { keys: ['F2'], descKey: 'shortcut.insertParent' },
      { keys: ['Delete'], descKey: 'shortcut.removeNode' },
      { keys: ['↑', '↓', '←', '→'], descKey: 'shortcut.navigate' },
      { keys: ['Alt', '↑', '↓'], descKey: 'shortcut.reorder' },
      { keys: ['Space'], descKey: 'shortcut.expandCollapse' },
      { keys: ['Mod', 'Click'], descKey: 'shortcut.selectAll' },
      { keys: ['Mod', 'C'], descKey: 'shortcut.copyNode' },
      { keys: ['Mod', 'X'], descKey: 'shortcut.cutNode' },
      { keys: ['Mod', 'V'], descKey: 'shortcut.pasteNode' },
      { keys: ['Mod', 'F'], descKey: 'shortcut.findNode' },
      { keys: ['Mod', 'B'], descKey: 'shortcut.bold' },
      { keys: ['Mod', 'I'], descKey: 'shortcut.italic' },
      { keys: ['Shift', 'Enter'], descKey: 'shortcut.newline' },
    ],
  },
  {
    sectionKey: 'shortcut.sectionScope',
    items: [
      { keys: ['Drag'], descKey: 'shortcut.drag' },
      { keys: ['Right-Drag'], descKey: 'shortcut.dragRight' },
      { keys: ['Wheel'], descKey: 'shortcut.mousewheel' },
      { keys: ['Mod', 'Wheel'], descKey: 'shortcut.zoomScope' },
      { keys: ['Touchpad'], descKey: 'shortcut.touchpad' },
      { keys: ['Double-Click', 'Space'], descKey: 'shortcut.dblClickSpace' },
    ],
  },
  {
    sectionKey: 'shortcut.sectionLayout',
    items: [
      { keys: ['Mod', 'Enter'], descKey: 'shortcut.placeRoot' },
      { keys: ['Mod', '0'], descKey: 'shortcut.layoutInOrder' },
    ],
  },
];
</script>

<template>
  <div class="shortcuts-view">
    <header class="header">
      <h1>{{ t('shortcut.title') }}</h1>
      <p class="hint">{{ t('shortcut.hint') }}</p>
    </header>

    <div v-for="group in groups" :key="group.sectionKey" class="group" data-testid="shortcut-group">
      <h2>{{ t(group.sectionKey) }}</h2>
      <table>
        <tbody>
          <tr v-for="item in group.items" :key="item.descKey">
            <th scope="row">{{ t(item.descKey) }}</th>
            <td class="keys">
              <template v-for="(k, i) in item.keys" :key="k + i">
                <kbd>{{ k }}</kbd>
                <span v-if="i < item.keys.length - 1" class="plus">+</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.shortcuts-view {
  max-width: 880px;
  margin: 0 auto;
  padding: 24px 32px;
  overflow-y: auto;
  height: 100%;
}
.header {
  margin-bottom: 24px;
}
h1 {
  margin: 0 0 4px 0;
  font-size: 22px;
}
.hint {
  margin: 0;
  color: var(--fg-mute);
  font-size: 13px;
}
.group {
  padding: 12px 0;
}
.group h2 {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--fg-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  text-align: left;
  padding: 6px 12px 6px 0;
  font-weight: normal;
  font-size: 13px;
  color: var(--fg);
  width: 50%;
}
.keys {
  text-align: right;
  white-space: nowrap;
  padding: 6px 0;
}
kbd {
  display: inline-block;
  min-width: 24px;
  padding: 2px 6px;
  margin: 0 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--fg);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 3px;
  box-shadow: 0 1px 0 var(--border);
  vertical-align: middle;
}
.plus {
  color: var(--fg-mute);
  font-size: 11px;
  margin: 0 2px;
}
</style>
