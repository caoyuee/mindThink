/**
 * 全局"聚焦搜索框"能力
 *
 * Properties 面板在挂载时调用 register，把 input 元素注册进来；
 * MindEditor 触发快捷键 Mod+F 时调用 focus()，把焦点跳到搜索框。
 */

import { ref, type Ref } from 'vue';

const searchInputRef: Ref<HTMLInputElement | null> = ref(null);

export function registerSearchInput(el: HTMLInputElement | null): void {
  searchInputRef.value = el;
}

export function focusSearchInput(): void {
  const el = searchInputRef.value;
  if (el) {
    el.focus();
    el.select?.();
  }
}
