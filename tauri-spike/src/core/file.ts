/**
 * 统一文件 IO 抽象
 *
 * 自动检测运行平台, 路由到 Tauri 或 Web 实现。
 * 调用方只需关心 save/open 接口, 不需要关心底层。
 */

import { isTauri } from '@/platform';
import * as tauri from './tauri-file';
import * as web from './web-file';

export interface SaveOptions {
  suggestedName?: string;
}

export interface OpenResult {
  name: string;
  content: string;
  path?: string; // 仅 Tauri 环境下有值
}

/** 直接写入已有路径。仅桌面端支持，Web 端返回失败。 */
export async function saveFileAtPath(path: string, content: string): Promise<boolean> {
  if (!isTauri()) return false;
  await tauri.tauriWriteFile(path, content);
  return true;
}

/** 保存导出的 SVG 文本。 */
export async function exportSvg(
  content: string,
  suggestedName: string,
  title = 'Save SVG',
): Promise<boolean> {
  if (isTauri()) {
    const path = await tauri.tauriSaveDialog({
      title,
      filters: [{ name: 'SVG', extensions: ['svg'] }],
      defaultPath: suggestedName,
    });
    if (!path) return false;
    await tauri.tauriWriteFile(path, content);
    return true;
  }
  downloadBlob(content, suggestedName, 'image/svg+xml;charset=utf-8');
  return true;
}

/** 保存导出的 PNG 数据。 */
export async function exportPng(
  data: Blob,
  suggestedName: string,
  title = 'Save PNG',
): Promise<boolean> {
  if (isTauri()) {
    const path = await tauri.tauriSaveDialog({
      title,
      filters: [{ name: 'PNG', extensions: ['png'] }],
      defaultPath: suggestedName,
    });
    if (!path) return false;
    const bytes = new Uint8Array(await data.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    await tauri.tauriWriteBinaryFile(path, globalThis.btoa(binary));
    return true;
  }
  downloadBlob(data, suggestedName, 'image/png');
  return true;
}

/** 保存导出的 KityMinder .km JSON 文本（兼容 legacy/百度脑图）。 */
export async function exportKm(
  content: string,
  suggestedName: string,
  title = 'Export KityMinder file',
): Promise<boolean> {
  if (isTauri()) {
    const path = await tauri.tauriSaveDialog({
      title,
      filters: [{ name: 'KityMinder', extensions: ['km'] }],
      defaultPath: suggestedName,
    });
    if (!path) return false;
    await tauri.tauriWriteFile(path, content);
    return true;
  }
  downloadBlob(content, suggestedName, 'application/json');
  return true;
}

/** 创建已有文件的备份。 */
export async function backupFile(path: string): Promise<boolean> {
  if (!isTauri()) return false;
  const stamp = new Date().toISOString().replace(/[.:]/g, '-');
  await tauri.tauriCopyFile(path, `${path}.backup-${stamp}`);
  return true;
}

/** 平台自适应的另存为 */
export async function saveFile(
  content: string,
  suggestedName = 'untitled.md',
  title = 'Save Mind map',
): Promise<SaveResult> {
  if (isTauri()) {
    const path = await tauri.tauriSaveDialog({
      title,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      defaultPath: suggestedName,
    });
    if (!path) return { ok: false };
    await tauri.tauriWriteFile(path, content);
    return { ok: true, path };
  }
  const ok = await web.webSaveFile(content, suggestedName);
  return { ok };
}

/** 平台自适应的打开 */
/** 从已知路径打开文件，供最近文件使用。 */
export async function openFileAtPath(path: string): Promise<OpenResult> {
  if (!isTauri()) throw new Error('openFileAtPath 只能在 Tauri 环境调用');
  const content = await tauri.tauriReadFile(path);
  return { name: path.split(/[\\/]/).pop() ?? path, content, path };
}

export async function openFile(title = 'Open Mind map'): Promise<OpenResult | null> {
  if (isTauri()) {
    const path = await tauri.tauriOpenDialog({
      title,
      filters: [{ name: 'Mind map', extensions: ['md', 'markdown', 'km'] }],
      multiple: false,
    });
    if (!path || typeof path !== 'string') return null;
    const content = await tauri.tauriReadFile(path);
    return {
      name: path.split(/[\\/]/).pop() ?? path,
      content,
      path,
    };
  }
  return web.webOpenFile();
}

/** 暴露底层 Tauri/Web 命令, 让调用方按需使用 */
function downloadBlob(data: BlobPart, filename: string, type: string): void {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const fileApi = {
  isTauri,
  // Tauri only
  showInFolder: tauri.tauriShowInFolder,
  openUrl: tauri.tauriOpenUrl,
  getUserDataDir: tauri.tauriGetUserDataDir,
  getAppVersion: tauri.tauriGetAppVersion,
  exit: tauri.tauriExit,
} as const;

export interface SaveResult {
  ok: boolean;
  path?: string;
}
