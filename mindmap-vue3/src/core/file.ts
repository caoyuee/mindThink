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

const FS_OPEN_OPTS = {
  types: [
    {
      description: 'Markdown 思维导图',
      accept: { 'text/markdown': ['.md', '.markdown', '.km'] },
    },
  ],
  multiple: false,
};

const FS_SAVE_OPTS = {
  suggestedName: 'untitled.md',
  types: [
    {
      description: 'Markdown 思维导图',
      accept: { 'text/markdown': ['.md'] },
    },
  ],
};

export async function exportSvg(content: string, suggestedName = 'mindmap.svg'): Promise<boolean> {
  download(content, suggestedName, 'image/svg+xml;charset=utf-8');
  return true;
}

export async function exportPng(data: Blob, suggestedName = 'mindmap.png'): Promise<boolean> {
  download(data, suggestedName, 'image/png');
  return true;
}

export async function saveFile(content: string, suggestedName = 'untitled.md'): Promise<boolean> {
  // 1) File System Access API
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ ...FS_SAVE_OPTS, suggestedName });
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

export async function openFile(): Promise<{ name: string; content: string } | null> {
  // 1) File System Access API
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker(FS_OPEN_OPTS);
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
