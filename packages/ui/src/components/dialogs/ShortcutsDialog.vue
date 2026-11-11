<script setup lang="ts">
/**
 * ShortcutsDialog —— 快捷键弹窗（替代原 /shortcuts 整页 ShortcutsView）。
 *
 * 数据完全来自 core/shortcuts.SHORTCUT_REGISTRY，与 useShortcuts.bindById
 * 共用同一份数据源，避免"显示的"和"实际绑定的"漂移。
 *
 * 受控组件：open 由 ui store 驱动；Esc / 遮罩点击 / 关闭按钮 → emit('close')。
 * Teleport 到 body，焦点圈闭在关闭按钮，关闭后焦点回还给触发前的元素。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { SHORTCUT_REGISTRY, SHORTCUT_SECTIONS, type ShortcutSection } from '@/core/shortcuts';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

const closeButton = ref<HTMLButtonElement | null>(null);
let returnFocus: HTMLElement | null = null;

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

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('close');
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      returnFocus = (document.activeElement as HTMLElement | null) ?? null;
      window.addEventListener('keydown', onKeydown);
      // 等 DOM 渲染完再聚焦关闭按钮
      requestAnimationFrame(() => closeButton.value?.focus());
    } else {
      window.removeEventListener('keydown', onKeydown);
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
      returnFocus = null;
    }
  },
);

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="shortcuts-backdrop"
      data-testid="shortcuts-backdrop"
      @click.self="emit('close')"
    >
      <section
        class="shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="t('shortcut.title')"
        data-testid="shortcuts-dialog"
      >
        <header class="header">
          <div>
            <h2>{{ t('shortcut.title') }}</h2>
            <p class="hint">{{ t('shortcut.hint') }}</p>
          </div>
          <button
            ref="closeButton"
            class="close-btn"
            type="button"
            data-testid="shortcuts-close"
            @click="emit('close')"
          >
            {{ t('common.close') }}
          </button>
        </header>

        <div class="body">
          <div v-for="group in groups" :key="group.key" class="group" data-testid="shortcut-group">
            <h3>{{ group.title }}</h3>
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
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.shortcuts-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}
.shortcuts-dialog {
  display: flex;
  flex-direction: column;
  width: min(720px, calc(100vw - 48px));
  max-height: min(80vh, 640px);
  padding: 16px 20px;
  background: var(--bg-elev);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}
.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
h2 {
  margin: 0 0 4px 0;
  font-size: 16px;
}
.hint {
  margin: 0;
  color: var(--fg-mute);
  font-size: 12px;
}
.close-btn {
  flex-shrink: 0;
  padding: 5px 14px;
  font: inherit;
  border-radius: 5px;
  cursor: pointer;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
}
.close-btn:hover {
  background: var(--accent);
  color: var(--accent-fg);
  border-color: var(--accent);
}
.close-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.body {
  overflow-y: auto;
  min-height: 0;
}
.group {
  padding: 12px 0 4px;
}
.group h3 {
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
  background: var(--bg);
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
  background: var(--bg);
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
