/**
 * UI store：主题、布局等瞬时 UI 状态
 */

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'ui.theme';

function detectInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  // 系统偏好
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

export const useUiStore = defineStore('ui', () => {
  const theme = ref<Theme>(detectInitialTheme());

  // 持久化 & DOM 同步
  watch(
    theme,
    (t) => {
      document.documentElement.dataset['theme'] = t;
      try {
        localStorage.setItem(THEME_KEY, t);
      } catch {
        // ignore
      }
    },
    { immediate: true },
  );

  function toggleTheme(): void {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
  }

  function setTheme(t: Theme): void {
    theme.value = t;
  }

  return { theme, toggleTheme, setTheme };
});
