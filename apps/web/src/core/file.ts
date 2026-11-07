/**
 * 文件 IO
 *
 * 浏览器中使用：
 * 1) 优先 File System Access API（可读写本地真实文件）
 * 2) 退化为 <a download> 触发下载
 *
 * 桌面端（Tauri/Electron）将替换为 invoke('save_file') 等。
 */

interface FilePickerOptions {
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  multiple?: boolean;
  suggestedName?: string;
}
interface FileSystemFileHandle {
  getFile: () => Promise<File>;
  createWritable: () => Promise<FileSystemWritableFileStream>;
}
interface FileSystemWritableFileStream {
  write: (data: string | ArrayBuffer | Blob) => Promise<void>;
  close: () => Promise<void>;
}
declare global {
  interface Window {
    showOpenFilePicker?: (opts?: FilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (opts?: FilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}

const DEFAULT_MINDMAP_DESCRIPTION = 'Mind map';

function fsOpenOpts(description: string) {
  return {
    types: [
      {
        description,
        accept: { 'text/markdown': ['.md', '.markdown', '.km'] },
      },
    ],
    multiple: false,
  };
}

function fsSaveOpts(description: string, suggestedName: string) {
  return {
    suggestedName,
    types: [
      {
        description,
        accept: { 'text/markdown': ['.md'] },
      },
    ],
  };
}

/** Web 导出走 <a download>，无原生对话框标题，故忽略 title 参数以保持调用端一致。 */
export async function exportSvg(
  content: string,
  suggestedName = 'mindmap.svg',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  title = 'Save SVG',
): Promise<boolean> {
  download(content, suggestedName, 'image/svg+xml;charset=utf-8');
  return true;
}

/** Web 导出走 <a download>，无原生对话框标题，故忽略 title 参数以保持调用端一致。 */
export async function exportPng(
  data: Blob,
  suggestedName = 'mindmap.png',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  title = 'Save PNG',
): Promise<boolean> {
  download(data, suggestedName, 'image/png');
  return true;
}

/** 保存导出的 KityMinder .km JSON 文本（兼容 legacy/百度脑图）。 */
export async function exportKm(
  content: string,
  suggestedName = 'mindmap.km',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  title = 'Export KityMinder file',
): Promise<boolean> {
  download(content, suggestedName, 'application/json');
  return true;
}

export async function saveFile(
  content: string,
  suggestedName = 'untitled.md',
  description = DEFAULT_MINDMAP_DESCRIPTION,
): Promise<boolean> {
  // 1) File System Access API
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker(fsSaveOpts(description, suggestedName));
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (e) {
      // 用户取消 - 不报错
      if ((e as Error).name === 'AbortError') return false;
      console.warn('showSaveFilePicker 失败，回退为下载', e);
    }
  }
  // 2) 回退：触发下载
  download(content, suggestedName, 'text/markdown;charset=utf-8');
  return true;
}

export async function openFile(
  description = DEFAULT_MINDMAP_DESCRIPTION,
): Promise<{ name: string; content: string } | null> {
  // 1) File System Access API
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker(fsOpenOpts(description));
      const file = await handle.getFile();
      const content = await file.text();
      return { name: file.name, content };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      console.warn('showOpenFilePicker 失败，回退为 <input>', e);
    }
  }
  // 2) 回退：临时 input 元素
  return openFileViaInput();
}

function openFileViaInput(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.km,text/markdown,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) {
        resolve(null);
        return;
      }
      const content = await file.text();
      resolve({ name: file.name, content });
    };
    input.click();
  });
}

function download(content: BlobPart, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
