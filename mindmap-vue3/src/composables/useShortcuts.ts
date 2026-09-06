/**
 * 快捷键系统
 *
 * 用法:
 *   const shortcuts = useShortcuts();
 *   shortcuts.bind({
 *     'ctrl+z': () => store.undo(),
 *     'mod+s': () => store.save(),  // mod = ctrl on win/linux, cmd on mac
 *   });
 *   // 组件卸载时自动解绑
 *
 * 设计:
 * - 集中管理所有快捷键, 避免分散在每个组件
 * - 支持修饰键: ctrl/cmd/alt/shift + key
 * - 输入框内按键默认不触发, 防止与文本编辑冲突
 * - 修饰键按"精确相等"匹配：需求位与事件位逐一相等，杜绝 Mod+Enter 被纯 Enter 抢占、
 *   Alt+↑ 误触 navigate、Shift+Tab 触发 indent、Ctrl+Shift+Z 触发 undo 之类误配。
 *
 * 纯逻辑（parseShortcut / matchModifier / matchShortcut）已导出，便于键盘级单测。
 */

import { onBeforeUnmount, onMounted } from 'vue';
import { SHORTCUT_REGISTRY, type ShortcutEntry } from '@/core/shortcuts';

type ShortcutHandler = (e: KeyboardEvent) => void;
export type ShortcutMap = Record<string, ShortcutHandler>;

/** bindById 的 handler 字典：id -> handler。id 对应 ShortcutEntry.id。 */
export type ShortcutHandlers = Record<string, ShortcutHandler>;

/** 匹配所需的键盘事件字段（KeyboardEvent 结构兼容，便于测试构造假事件）。 */
export type ModifierEvent = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'
>;

/**
 * 修饰键位定义：
 *   bit0(1) = Ctrl     bit1(2) = Alt
 *   bit2(4) = Shift    bit3(8) = Meta(Cmd)
 * parseShortcut 时 'mod' 已按平台解析成 Ctrl(1) 或 Meta(8)，这里不再做平台判断。
 */
const CTRL = 1;
const ALT = 2;
const SHIFT = 4;
const META = 8;

/** 把展示用符号（↑/↓/←/→/Space）映射为 KeyboardEvent.key 的小写。 */
function normalizeKey(key: string): string {
  const symbolMap: Record<string, string> = {
    '↑': 'arrowup',
    '↓': 'arrowdown',
    '←': 'arrowleft',
    '→': 'arrowright',
    space: ' ',
  };
  return symbolMap[key] ?? key;
}

/** 把 'ctrl+z' / 'mod+s' / '↑' 标准化为内部表示 */
export function parseShortcut(shortcut: string): { mod: number; key: string } {
  const parts = shortcut
    .toLowerCase()
    .split('+')
    .map((s) => s.trim());
  let mod = 0;
  let key = '';
  for (const p of parts) {
    if (p === 'ctrl' || p === 'control') mod |= CTRL;
    else if (p === 'alt' || p === 'option') mod |= ALT;
    else if (p === 'shift') mod |= SHIFT;
    else if (p === 'mod' || p === 'cmd' || p === 'meta')
      mod |= navigator.platform.includes('Mac') ? META : CTRL;
    else key = p;
  }
  return { mod, key: normalizeKey(key) };
}

/**
 * 修饰键精确匹配：需求位与事件位逐一相等。
 * 例如 mod=0（纯按键）要求 Ctrl/Alt/Shift/Meta 全部为 false，因此 Ctrl+Enter 不会命中纯 Enter。
 */
export function matchModifier(e: ModifierEvent, mod: number): boolean {
  return (
    (mod & CTRL ? e.ctrlKey : !e.ctrlKey) &&
    (mod & ALT ? e.altKey : !e.altKey) &&
    (mod & SHIFT ? e.shiftKey : !e.shiftKey) &&
    (mod & META ? e.metaKey : !e.metaKey)
  );
}

/** 一条完整快捷键（含主键与修饰键）是否匹配某次按键事件。 */
export function matchShortcut(e: ModifierEvent, shortcut: string): boolean {
  const { mod, key } = parseShortcut(shortcut);
  if (String(e.key).toLowerCase() !== key) return false;
  return matchModifier(e, mod);
}

/** 是否应该忽略（在输入控件内） */
function shouldIgnore(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useShortcuts() {
  const handlers = new Map<string, ShortcutHandler>();

  function onKeyDown(e: KeyboardEvent): void {
    if (shouldIgnore(e.target)) return;
    for (const [shortcut, handler] of handlers) {
      if (matchShortcut(e, shortcut)) {
        e.preventDefault();
        handler(e);
        return;
      }
    }
  }

  function bind(map: ShortcutMap): void {
    for (const [s, h] of Object.entries(map)) handlers.set(s, h);
  }

  /**
   * 用 SHORTCUT_REGISTRY 解析 handler 字典。
   *
   * 对于每个 entry.keys 中每个键位组合，绑定到 entry.id 对应的 handler。
   * 未在 SHORTCUT_REGISTRY 出现的 id 会被忽略。
   */
  function bindById(map: ShortcutHandlers): void {
    for (const entry of SHORTCUT_REGISTRY) {
      const h = map[entry.id];
      if (!h) continue;
      for (const keys of entry.keys) {
        if (keys.length === 0) continue;
        handlers.set(keys.join('+'), h);
      }
    }
  }

  /** 把一个 ShortcutEntry 的所有键位绑定到同一 handler（用于动态注册）。 */
  function bindEntry(entry: ShortcutEntry, h: ShortcutHandler): void {
    for (const keys of entry.keys) {
      if (keys.length === 0) continue;
      handlers.set(keys.join('+'), h);
    }
  }

  function unbind(shortcut?: string): void {
    if (shortcut) handlers.delete(shortcut);
    else handlers.clear();
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown));
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown);
    handlers.clear();
  });

  return { bind, bindById, bindEntry, unbind };
}
