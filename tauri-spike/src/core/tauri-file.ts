/**
 * Tauri 平台文件 IO
 *
 * 职责:
 * 1. 检测运行平台(Tauri / Web)
 * 2. 在 Tauri 下调用 invoke() 走 Rust commands
 * 3. 在 Web 下回退到 web 端 file.ts 的浏览器 API
 *
 * 满足 AGENTS.md: web 端与 Tauri 端共用同一份 API 契约
 */

import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@/platform';

/** 读文件 */
export async function tauriReadFile(path: string): Promise<string> {
  if (!isTauri()) throw new Error('tauriReadFile 只能在 Tauri 环境调用');
  return invoke<string>('read_text_file', { path });
}

/** 写文件 */
export async function tauriWriteFile(path: string, content: string): Promise<void> {
  if (!isTauri()) throw new Error('tauriWriteFile 只能在 Tauri 环境调用');
  await invoke('write_text_file', { path, content });
}

/** 写入 Base64 编码的二进制文件 */
export async function tauriWriteBinaryFile(path: string, content: string): Promise<void> {
  if (!isTauri()) throw new Error('tauriWriteBinaryFile 只能在 Tauri 环境调用');
  await invoke('write_binary_file', { path, content });
}

/** 创建文件副本 */
export async function tauriCopyFile(source: string, destination: string): Promise<void> {
  if (!isTauri()) throw new Error('tauriCopyFile 只能在 Tauri 环境调用');
  await invoke('copy_file', { source, destination });
}

/** 文件是否存在 */
export async function tauriFileExists(path: string): Promise<boolean> {
  if (!isTauri()) throw new Error('tauriFileExists 只能在 Tauri 环境调用');
  return invoke<boolean>('file_exists', { path });
}

/**
 * 弹出打开对话框, 返回选择的路径或 null(取消)
 * 使用 Tauri 的 dialog plugin(原生体验优于 web File System Access API)
 */
export async function tauriOpenDialog(opts?: {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  defaultPath?: string;
  multiple?: boolean;
  directory?: boolean;
}): Promise<string | string[] | null> {
  if (!isTauri()) throw new Error('tauriOpenDialog 只能在 Tauri 环境调用');
  return openDialog({
    title: opts?.title,
    filters: opts?.filters,
    defaultPath: opts?.defaultPath,
    multiple: opts?.multiple ?? false,
    directory: opts?.directory ?? false,
  });
}

/**
 * 弹出保存对话框
 */
export async function tauriSaveDialog(opts?: {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  defaultPath?: string;
}): Promise<string | null> {
  if (!isTauri()) throw new Error('tauriSaveDialog 只能在 Tauri 环境调用');
  return saveDialog({
    title: opts?.title,
    filters: opts?.filters,
    defaultPath: opts?.defaultPath,
  });
}

/** 在文件管理器中显示文件 */
export async function tauriShowInFolder(path: string): Promise<void> {
  if (!isTauri()) throw new Error('tauriShowInFolder 只能在 Tauri 环境调用');
  await invoke('show_in_folder', { path });
}

/** 打开 URL(系统默认浏览器) */
export async function tauriOpenUrl(url: string): Promise<void> {
  if (!isTauri()) throw new Error('tauriOpenUrl 只能在 Tauri 环境调用');
  await invoke('open_url', { url });
}

/** 通过 Rust IPC 处理 MCP JSON-RPC 请求。 */
export async function tauriMcpRpcRequest(request: unknown, context: unknown): Promise<unknown> {
  if (!isTauri()) throw new Error('tauriMcpRpcRequest 只能在 Tauri 环境调用');
  return invoke('mcp_rpc_request', { request, context });
}

/** 获取应用 userData 目录 */
export async function tauriGetUserDataDir(): Promise<string> {
  if (!isTauri()) throw new Error('tauriGetUserDataDir 只能在 Tauri 环境调用');
  return invoke<string>('get_user_data_dir');
}

/** 退出应用 */
export function tauriExit(): void {
  if (!isTauri()) return;
  void invoke('exit_app');
}

/** 获取应用版本 */
export async function tauriGetAppVersion(): Promise<string> {
  if (!isTauri()) return '0.0.0-web';
  return invoke<string>('get_app_version');
}
