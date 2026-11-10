/**
 * 平台检测与平台能力分发
 *
 * 同时支持浏览器(纯 web)和 Tauri(桌面)两种运行模式。
 * 在 Tauri 中, window.__TAURI_INTERNALS__ 会被自动注入。
 *
 * 本文件是 Web + Tauri 共享模块（必须两端字节一致）。为遵守 parity 约束，
 * 共享文件不得 import 任何 tauri-only 模块（如 @tauri-apps/api）。因此平台
 * 专属能力（目录选择等）采用"注册式分发"：共享层只声明接口，具体实现由
 * tauri 端在运行时注册（Web 端不注册即 no-op）。
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

/**
 * 目录选择能力（注册式分发）。
 *
 * - Web 端不注册实现 → chooseDirectory() 永远返回 null，绝不伪造路径能力
 *   （满足 AGENTS.md 红线：Web 不伪造本地路径能力）。
 * - Tauri 端在 App.vue 注册实现，调用原生目录选择对话框。
 */
type DirPicker = () => Promise<string | null>;

let dirPicker: DirPicker | null = null;

/** 注册平台专属的目录选择器实现（传 null 清空）。 */
export function registerDirPicker(fn: DirPicker | null): void {
  dirPicker = fn;
}

/** 弹出目录选择对话框，返回所选绝对路径或 null（取消 / 平台不支持）。 */
export async function chooseDirectory(): Promise<string | null> {
  if (dirPicker) return dirPicker();
  return null;
}

/**
 * MCP server 状态查询（注册式分发，D5 阶段一）。
 *
 * - Web 端不注册实现 → mcpServerStatus() 永远返回 null（无 MCP 能力）
 * - Tauri 端在 App.vue 注册实现（invoke 'mcp_status'，未运行同样返回 null）
 */
export interface McpServerStatus {
  port: number;
  token: string;
}

type McpStatusProvider = () => Promise<McpServerStatus | null>;

let mcpStatusProvider: McpStatusProvider | null = null;

/** 注册平台专属的 MCP server 状态查询实现（传 null 清空）。 */
export function registerMcpStatusProvider(fn: McpStatusProvider | null): void {
  mcpStatusProvider = fn;
}

/** 查询 MCP server 状态；未运行 / 平台不支持时返回 null。 */
export async function mcpServerStatus(): Promise<McpServerStatus | null> {
  if (mcpStatusProvider) return mcpStatusProvider();
  return null;
}
