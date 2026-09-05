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
 */

import { onBeforeUnmount, onMounted } from 'vue';

type ShortcutHandler = (e: KeyboardEvent) => void;
export type ShortcutMap = Record<string, ShortcutHandler>;

/** 把 'ctrl+z' / 'mod+s' 标准化为内部表示 */
function parseShortcut(shortcut: string): { mod: number; key: string } {
  const parts = shortcut
    .toLowerCase()
    .split('+')
    .map((s) => s.trim());
  let mod = 0;
  let key = '';
  for (const p of parts) {
    if (p === 'ctrl' || p === 'control') mod |= 1;
    else if (p === 'alt' || p === 'option') mod |= 2;
    else if (p === 'shift') mod |= 4;
    else if (p === 'mod' || p === 'cmd' || p === 'meta')
      mod |= navigator.platform.includes('Mac') ? 8 : 1;
    else key = p;
  }
  return { mod, key };
}

function matchModifier(e: KeyboardEvent, mod: number): boolean {
  const meta = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
  if (mod & 1 && !e.ctrlKey && !(mod & 8)) return false;
  if (mod & 8 && !meta) return false;
  if (mod & 2 && !e.altKey) return false;
  if (mod & 4 && !e.shiftKey) return false;
  return true;
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
      const { mod, key } = parseShortcut(shortcut);
      if (e.key.toLowerCase() === key && matchModifier(e, mod)) {
        e.preventDefault();
        handler(e);
        return;
      }
    }
  }

  function bind(map: ShortcutMap): void {
    for (const [s, h] of Object.entries(map)) handlers.set(s, h);
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

  return { bind, unbind };
}
