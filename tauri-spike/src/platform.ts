/**
 * 平台检测
 *
 * 同时支持浏览器(纯 web)和 Tauri(桌面)两种运行模式。
 * 在 Tauri 中, window.__TAURI_INTERNALS__ 会被自动注入。
 */

export type Platform = 'web' | 'tauri' | 'unknown';

/**
 * 检测当前是否运行在 Tauri 桌面环境中
 *
 * 注: Tauri 2.x 通过 window.__TAURI_INTERNALS__ 暴露运行时标识。
 * @tauri-apps/api 也提供 isTauri() 函数, 这里直接做轻量级判断以减少包体积。
 */
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unknown';
  // Tauri 2.x: __TAURI_INTERNALS__ 存在
  if ('__TAURI_INTERNALS__' in window) return 'tauri';
  // Tauri 1.x 兼容: __TAURI__ 存在
  if ('__TAURI__' in window) return 'tauri';
  return 'web';
}

export function isTauri(): boolean {
  return detectPlatform() === 'tauri';
}
