/**
 * Web 平台文件 IO
 *
 * 浏览器端的回退实现。Tauri 不可用时使用。
 * 实现与 web 端 spike/mindmap-vue3/src/core/file.ts 等价
 */

const FS_ACCESS = {
  types: [
    {
      description: 'Markdown 思维导图',
      accept: { 'text/markdown': ['.md', '.markdown', '.km'] },
    },
  ],
  multiple: false,
};

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

export async function webSaveFile(
  content: string,
  suggestedName = 'untitled.md',
): Promise<boolean> {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ ...FS_ACCESS, suggestedName });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (e) {
      if ((e as ErrorError).name === 'AbortError') return false;
    }
  }
  download(content, suggestedName);
  return true;
}

export async function webOpenFile(): Promise<{ name: string; content: string } | null> {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker(FS_ACCESS);
      const file = await handle.getFile();
      const content = await file.text();
      return { name: file.name, content };
    } catch (e) {
      if ((e as ErrorError).name === 'AbortError') return null;
    }
  }
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

function download(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 占位类型(避免引入额外 .d.ts)
interface ErrorError extends Error {
  name: string;
}
