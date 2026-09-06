<script setup lang="ts">
/**
 * ConfirmDialog —— 通用确认对话框（替代 window.confirm）。
 *
 * 按键语义：Enter = 确认，Esc = 取消；破坏性(danger)时自动聚焦"取消"（安全按钮），
 * 否则聚焦"确定"。Teleport 到 body，简单焦点圈闭。焦点回还给触发前的元素。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    message: string;
    okText?: string;
    cancelText?: string;
    danger?: boolean;
  }>(),
  { okText: 'OK', cancelText: 'Cancel', danger: false },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const panel = ref<HTMLElement | null>(null);
const okButton = ref<HTMLButtonElement | null>(null);
const cancelButton = ref<HTMLButtonElement | null>(null);
let returnFocus: HTMLElement | null = null;

function restoreFocus(): void {
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  returnFocus = null;
}

onMounted(() => {
  returnFocus = (document.activeElement as HTMLElement | null) ?? null;
  // 安全按钮优先：危险操作把默认焦点放"取消"，普通操作放"确定"。
  (props.danger ? cancelButton.value : okButton.value)?.focus();
});

onBeforeUnmount(restoreFocus);

function onPanelKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('cancel');
  } else if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    emit('confirm');
  } else if (e.key === 'Tab') {
    // 简单焦点圈闭：只在"取消"与"确定"两个按钮间往返。
    const focused = document.activeElement;
    if (e.shiftKey && focused === okButton.value) {
      e.preventDefault();
      cancelButton.value?.focus();
    } else if (!e.shiftKey && focused === cancelButton.value) {
      e.preventDefault();
      okButton.value?.focus();
    }
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
        <p class="dialog-message">{{ message }}</p>
        <div class="dialog-actions">
          <button
            ref="cancelButton"
            class="btn"
            type="button"
            data-testid="dialog-cancel"
            @click="emit('cancel')"
          >
            {{ cancelText }}
          </button>
          <button
            ref="okButton"
            class="btn primary"
            :class="{ danger }"
            type="button"
            data-testid="dialog-ok"
            @click="emit('confirm')"
          >
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
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--fg-mute, #6b7280);
  overflow-wrap: break-word;
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
.btn.primary.danger {
  background: var(--danger, #dc2626);
}
.btn:focus-visible {
  outline: 2px solid var(--accent, #3b82f6);
  outline-offset: 1px;
}
</style>
