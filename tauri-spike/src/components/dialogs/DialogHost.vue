<script setup lang="ts">
/**
 * DialogHost —— 全局单例对话框宿主。
 *
 * 在 App 根挂载一份。订阅 useDialog 的模块级 request 状态，按 kind 渲染
 * ConfirmDialog / PromptDialog，并把用户选择 settle 回对应的 Promise。
 */
import { computed, onErrorCaptured } from 'vue';
import {
  dialogState,
  failDialog,
  settleDialog,
  type ConfirmOptions,
  type PromptOptions,
} from '@/composables/useDialog';
import ConfirmDialog from './ConfirmDialog.vue';
import PromptDialog from './PromptDialog.vue';

const confirmOptions = computed<ConfirmOptions | null>(() => {
  const active = dialogState.active;
  return active && active.payload.kind === 'confirm' ? active.payload.options : null;
});

const promptOptions = computed<PromptOptions | null>(() => {
  const active = dialogState.active;
  return active && active.payload.kind === 'prompt' ? active.payload.options : null;
});

function onConfirmOk(): void {
  settleDialog(true);
}

function onConfirmCancel(): void {
  settleDialog(false);
}

function onPromptOk(value: string): void {
  settleDialog(value);
}

function onPromptCancel(): void {
  settleDialog(null);
}

// 子组件渲染出错时拒绝挂起的弹窗，避免 Promise 永不 settle。
onErrorCaptured((error: unknown) => {
  failDialog(error);
  return false;
});
</script>

<template>
  <ConfirmDialog
    v-if="confirmOptions"
    :title="confirmOptions.title"
    :message="confirmOptions.message"
    :ok-text="confirmOptions.okText"
    :cancel-text="confirmOptions.cancelText"
    :danger="confirmOptions.danger"
    @confirm="onConfirmOk"
    @cancel="onConfirmCancel"
  />
  <PromptDialog
    v-else-if="promptOptions"
    :title="promptOptions.title"
    :message="promptOptions.message"
    :initial-value="promptOptions.initialValue"
    :ok-text="promptOptions.okText"
    :cancel-text="promptOptions.cancelText"
    @confirm="onPromptOk"
    @cancel="onPromptCancel"
  />
</template>
