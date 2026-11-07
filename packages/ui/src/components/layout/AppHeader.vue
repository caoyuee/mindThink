<script setup lang="ts">
/**
 * 全局顶栏：Logo + 路由导航 + 语言切换 + 主题切换
 */
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { useUiStore } from '@/stores/ui';
import { setLocale, type AppLocale, SUPPORTED_LOCALES, LOCALE_LABELS } from '@/i18n';
import { computed } from 'vue';

const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();
const ui = useUiStore();

const currentLocale = computed(() => locale.value as AppLocale);

function changeLocale(e: Event) {
  setLocale((e.target as HTMLSelectElement).value as AppLocale);
}

function isActive(name: string): boolean {
  return route.name === name;
}
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <span class="logo">🧠</span>
      <strong>{{ t('app.name') }}</strong>
    </div>

    <nav class="nav">
      <button :class="['nav-item', { active: isActive('editor') }]" @click="router.push('/editor')">
        {{ t('menu.goEditor') }}
      </button>
      <button
        :class="['nav-item', { active: isActive('settings') }]"
        @click="router.push('/settings')"
      >
        {{ t('menu.goSettings') }}
      </button>
      <button
        :class="['nav-item', { active: isActive('shortcuts') }]"
        @click="router.push('/shortcuts')"
      >
        {{ t('menu.goShortcuts') }}
      </button>
      <button :class="['nav-item', { active: isActive('about') }]" @click="router.push('/about')">
        {{ t('menu.goAbout') }}
      </button>
    </nav>

    <div class="actions">
      <select class="locale-select" :value="currentLocale" @change="changeLocale">
        <option v-for="loc in SUPPORTED_LOCALES" :key="loc" :value="loc">
          {{ LOCALE_LABELS[loc] }}
        </option>
      </select>
      <button class="theme-btn" :title="ui.theme" @click="ui.toggleTheme()">
        {{ ui.theme === 'light' ? '🌙' : '☀️' }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: var(--bg-elev);
  border-bottom: 1px solid var(--border);
  height: 48px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo {
  font-size: 18px;
}
.nav {
  display: flex;
  gap: 4px;
}
.nav-item {
  padding: 4px 12px;
  background: transparent;
  color: var(--fg);
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.nav-item:hover {
  background: var(--bg);
}
.nav-item.active {
  background: var(--accent);
  color: var(--accent-fg);
  border-color: var(--accent);
}
.actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.locale-select,
.theme-btn {
  padding: 4px 10px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
}
.theme-btn {
  font-size: 16px;
}
</style>
