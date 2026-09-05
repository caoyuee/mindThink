/**
 * vue-i18n 集成
 *
 * 设计:
 * - 默认语言: zh-CN
 * - 语言探测: localStorage.userLocale > navigator.language
 * - 语言切换: 通过 ui store 的 locale + localStorage
 */

import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';
import zhTW from './locales/zh-TW.json';
import de from './locales/de.json';

export type AppLocale = 'zh-CN' | 'en' | 'zh-TW' | 'de';

export const SUPPORTED_LOCALES: readonly AppLocale[] = ['zh-CN', 'en', 'zh-TW', 'de'] as const;

export const LOCALE_LABELS: Record<AppLocale, string> = {
  'zh-CN': '简体中文',
  en: 'English',
  'zh-TW': '繁體中文',
  de: 'Deutsch',
};

/**
 * 检测浏览器首选语言
 */
function detectLocale(): AppLocale {
  try {
    const stored = localStorage.getItem('userLocale') as AppLocale | null;
    if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
  } catch {
    // localStorage 可能不可用 (隐私模式)
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'zh-CN';
  if (nav.startsWith('en')) return 'en';
  if (nav.startsWith('zh-TW') || nav.startsWith('zh-Hant')) return 'zh-TW';
  if (nav.startsWith('de')) return 'de';
  return 'zh-CN';
}

export const i18n = createI18n({
  legacy: false, // 必须 Composition 模式
  locale: detectLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en,
    'zh-TW': zhTW,
    de,
  },
  // 类型增强（暂不启用 datetime/数字格式化）
});

export function setLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale;
  try {
    localStorage.setItem('userLocale', locale);
  } catch {
    // ignore
  }
  document.documentElement.lang = locale;
}
