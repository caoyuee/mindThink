/**
 * 全局 Toast 系统
 *
 * 设计:
 * - 单例 store, 多组件共享
 * - 4 种 level: info / success / warn / error
 * - 默认 3 秒自动消失
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { nanoid } from 'nanoid';

export type ToastLevel = 'info' | 'success' | 'warn' | 'error';

export interface ToastItem {
  id: string;
  level: ToastLevel;
  message: string;
  duration: number;
}

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([]);

  function push(message: string, level: ToastLevel = 'info', duration = 3000): string {
    const id = nanoid(8);
    items.value.push({ id, level, message, duration });
    if (duration > 0) {
      window.setTimeout(() => dismiss(id), duration);
    }
    return id;
  }

  function dismiss(id: string): void {
    items.value = items.value.filter((t) => t.id !== id);
  }

  function clear(): void {
    items.value = [];
  }

  // 便捷方法
  const info = (msg: string, dur?: number) => push(msg, 'info', dur);
  const success = (msg: string, dur?: number) => push(msg, 'success', dur);
  const warn = (msg: string, dur?: number) => push(msg, 'warn', dur);
  const error = (msg: string, dur?: number) => push(msg, 'error', dur ?? 5000);

  return { items, push, dismiss, clear, info, success, warn, error };
});
