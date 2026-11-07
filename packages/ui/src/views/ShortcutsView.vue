<script setup lang="ts">
/**
 * 快捷键帮助页
 *
 * 数据完全来自 core/shortcuts.SHORTCUT_REGISTRY，与 useShortcuts.bindById
 * 共用同一份数据源，避免"显示的"和"实际绑定的"漂移。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { SHORTCUT_REGISTRY, SHORTCUT_SECTIONS, type ShortcutSection } from '@/core/shortcuts';

const { t } = useI18n();

interface GroupViewModel {
  key: ShortcutSection;
  title: string;
  items: typeof SHORTCUT_REGISTRY;
}

const groups = computed<GroupViewModel[]>(() =>
  SHORTCUT_SECTIONS.map((section) => ({
    key: section.key,
    title: t(section.i18nKey),
    items: SHORTCUT_REGISTRY.filter((e) => e.section === section.key),
  })).filter((g) => g.items.length > 0),
);
</script>

<template>
  <div class="shortcuts-view">
    <header class="header">
      <h1>{{ t('shortcut.title') }}</h1>
      <p class="hint">{{ t('shortcut.hint') }}</p>
    </header>

    <div v-for="group in groups" :key="group.key" class="group" data-testid="shortcut-group">
      <h2>{{ group.title }}</h2>
      <table>
        <tbody>
          <tr
            v-for="item in group.items"
            :key="item.id"
            :data-status="item.status"
            :data-shortcut-id="item.id"
            class="shortcut-row"
          >
            <th scope="row">
              {{ t(item.descKey) }}
              <span v-if="item.status === 'todo'" class="todo-tag" data-testid="todo-tag">
                {{ t('shortcut.todo') }}
              </span>
            </th>
            <td class="keys">
              <template v-if="item.keys.length === 0">
                <span class="muted">—</span>
              </template>
              <template v-else>
                <span
                  v-for="(combo, ci) in item.keys"
                  :key="ci"
                  class="combo"
                  data-testid="shortcut-keys"
                >
                  <template v-for="(k, ki) in combo" :key="k + ki">
                    <kbd>{{ k }}</kbd>
                    <span v-if="ki < combo.length - 1" class="plus">+</span>
                  </template>
                  <span v-if="ci < item.keys.length - 1" class="or">/</span>
                </span>
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
.combo {
  margin-left: 6px;
}
.combo:first-child {
  margin-left: 0;
}
.or {
  color: var(--fg-mute);
  font-size: 11px;
  margin: 0 4px;
}
.muted {
  color: var(--fg-mute);
}
.todo-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  font-size: 10px;
  color: var(--fg-mute);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.shortcut-row[data-status='todo'] th {
  color: var(--fg-mute);
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
