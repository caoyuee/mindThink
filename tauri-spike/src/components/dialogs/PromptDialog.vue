<script setup lang="ts">
/**
 * PromptDialog —— 单行输入对话框（替代 window.prompt，如重命名节点）。
 *
 * 挂载后自动聚焦输入框并全选初值；Enter = 提交，Esc = 取消。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    message?: string;
    initialValue?: string;
    okText?: string;
    cancelText?: string;
  }>(),
  { message: '', initialValue: '', okText: 'OK', cancelText: 'Cancel' },
);

const emit = defineEmits<{ confirm: [value: string]; cancel: [] }>();

const panel = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const value = ref(props.initialValue);
let returnFocus: HTMLElement | null = null;

function submit(): void {
  emit('confirm', value.value);
}

function restoreFocus(): void {
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  returnFocus = null;
}

onMounted(() => {
  returnFocus = (document.activeElement as HTMLElement | null) ?? null;
  const el = input.value;
  el?.focus();
  // 全选初值：happy-dom 等测试环境未必实现 select()，做能力守卫（非吞错）。
  if (el && typeof el.select === 'function') el.select();
});

onBeforeUnmount(restoreFocus);

// Enter 与 Esc 在 panel 层统一处理，避免输入框自身再绑一遍造成重复提交。
function onPanelKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('cancel');
  } else if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault();
    e.stopPropagation();
    submit();
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="dialog-backdrop" data-testid="dialog-backdrop" @click.self="emit('cancel')">
      <section
        ref="panel"
        class="dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        data-testid="dialog-panel"
        @keydown="onPanelKeydown"
      >
        <h2 class="dialog-title">{{ title }}</h2>
        <p v-if="message" class="dialog-message">{{ message }}</p>
        <input
          ref="input"
          v-model="value"
          class="dialog-input"
          type="text"
          data-testid="dialog-prompt-input"
        />
        <div class="dialog-actions">
          <button class="btn" type="button" data-testid="dialog-cancel" @click="emit('cancel')">
            {{ cancelText }}
          </button>
          <button class="btn primary" type="button" data-testid="dialog-ok" @click="submit">
            {{ okText }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}
.dialog {
  min-width: 320px;
  max-width: 440px;
  padding: 16px;
  background: var(--bg-elev, #fff);
  color: var(--fg, #1f2937);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}
.dialog-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
}
.dialog-message {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--fg-mute, #6b7280);
}
.dialog-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  margin-bottom: 14px;
  font: inherit;
  background: var(--bg, #f9fafb);
  color: var(--fg, #1f2937);
  border: 1px solid var(--border, #d1d5db);
  border-radius: 5px;
}
.dialog-input:focus {
  outline: 2px solid var(--accent, #3b82f6);
  outline-offset: 0;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn {
  padding: 6px 14px;
  font: inherit;
  border-radius: 5px;
  cursor: pointer;
  background: var(--bg-elev, #fff);
  color: var(--fg, #1f2937);
  border: 1px solid var(--border, #d1d5db);
}
.btn.primary {
  background: var(--accent, #3b82f6);
  color: var(--accent-fg, #fff);
  border-color: transparent;
}
.btn:focus-visible {
  outline: 2px solid var(--accent, #3b82f6);
  outline-offset: 1px;
}
</style>
