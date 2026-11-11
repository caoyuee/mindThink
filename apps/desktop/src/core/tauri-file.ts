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

/** 启动 MCP server（幂等），返回端口与本次会话 token。 */
export async function tauriMcpStart(): Promise<{ port: number; token: string }> {
  if (!isTauri()) throw new Error('tauriMcpStart 只能在 Tauri 环境调用');
  return invoke<{ port: number; token: string }>('mcp_start');
}

/** 停止 MCP server（幂等）。 */
export async function tauriMcpStop(): Promise<void> {
  if (!isTauri()) throw new Error('tauriMcpStop 只能在 Tauri 环境调用');
  await invoke('mcp_stop');
}

/** 查询 MCP server 当前状态（未运行返回 null）。 */
export async function tauriMcpStatus(): Promise<{ port: number; token: string } | null> {
  if (!isTauri()) throw new Error('tauriMcpStatus 只能在 Tauri 环境调用');
  return invoke<{ port: number; token: string } | null>('mcp_status');
}

/** webview 回传一条 MCP JSON-RPC 响应（对应 Rust emit 的 mcp-request rid）。 */
export async function tauriMcpRespond(rid: number, message: string): Promise<void> {
  if (!isTauri()) throw new Error('tauriMcpRespond 只能在 Tauri 环境调用');
  await invoke('mcp_respond', { rid, message: JSON.parse(message) });
}

/** 获取应用 userData 目录 */
export async function tauriGetUserDataDir(): Promise<string> {
  if (!isTauri()) throw new Error('tauriGetUserDataDir 只能在 Tauri 环境调用');
  return invoke<string>('get_user_data_dir');
}

/**
 * 追加一行到磁盘日志文件（userData/logs/naotu.log）。
 * 仅由日志 sink 在用户开启 ifSaveLogToDisk 时调用（Web 端不会注册 sink）。
 * 落盘内容只含人类可读消息，绝不携带 API key 等敏感信息。
 */
export async function tauriAppendLogLine(line: string): Promise<void> {
  if (!isTauri()) return;
  const dir = await tauriGetUserDataDir();
  const logPath = `${dir}/logs/naotu.log`;
  await invoke('append_text_file', { path: logPath, content: `${line}\n` });
}

/** 退出应用 */
export function tauriExit(): void {
  if (!isTauri()) return;
  void invoke('exit_app');
}

/** 用前端生成的结构化 spec 重建系统原生菜单(B1, 语言切换即时生效)。 */
export async function tauriRebuildNativeMenu(spec: unknown): Promise<void> {
  if (!isTauri()) throw new Error('tauriRebuildNativeMenu 只能在 Tauri 环境调用');
  await invoke('rebuild_native_menu', { spec });
}

/**
 * 列出某文件的备份文件（`<原名>.backup-*`），按时间降序（最新在前）。
 * 实际磁盘扫描由 Rust 命令完成，前端只拿到已排序的绝对路径列表。
 */
export async function tauriListBackupFiles(path: string): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>('list_backup_files', { path });
}

/**
 * 删除给定路径的文件。仅允许删除 `.backup-*` 命名的备份文件（Rust 端二次校验），
 * 杜绝误删。删除失败抛错，由调用方以 toast 提示，不静默吞掉。
 */
export async function tauriDeleteFiles(paths: string[]): Promise<void> {
  if (!isTauri()) return;
  if (!paths.length) return;
  await invoke('delete_files', { paths });
}
