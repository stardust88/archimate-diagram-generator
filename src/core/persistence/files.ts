// File open/save helpers (spec §11). Uses the File System Access API when available so "Save"
// can write back to the opened file; otherwise <input type=file> and a download.

interface OpenPickerWindow {
  showOpenFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle>;
}

const XML_TYPES = [
  { description: 'ArchiMate Exchange Format', accept: { 'application/xml': ['.xml'] } },
];

export interface OpenedFile {
  name: string;
  text: string;
  handle: FileSystemFileHandle | null;
}

export function hasFileSystemAccess(): boolean {
  return typeof (window as OpenPickerWindow).showOpenFilePicker === 'function';
}

/** Opens a picker; resolves null when the user cancels. */
export async function pickFile(): Promise<OpenedFile | null> {
  const w = window as OpenPickerWindow;
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({ types: XML_TYPES, multiple: false });
      if (!handle) return null;
      const file = await handle.getFile();
      return { name: file.name, text: await file.text(), handle };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      throw e;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml,application/xml,text/xml';
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, text: await file.text(), handle: null } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function readDroppedFile(file: File): Promise<OpenedFile> {
  return { name: file.name, text: await file.text(), handle: null };
}

export function download(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Writes through the handle; returns false if permission was refused. */
export async function writeToHandle(
  handle: FileSystemFileHandle,
  content: string,
): Promise<boolean> {
  const h = handle as FileSystemFileHandle & {
    requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
  };
  if (h.requestPermission && (await h.requestPermission({ mode: 'readwrite' })) !== 'granted') {
    return false;
  }
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  return true;
}

/** "Save as" with a picker where supported; resolves the new handle, or null on fallback/cancel. */
export async function saveAs(
  suggestedName: string,
  content: string,
): Promise<{ handle: FileSystemFileHandle | null; name: string } | null> {
  const w = window as OpenPickerWindow;
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({ suggestedName, types: XML_TYPES });
      await writeToHandle(handle, content);
      return { handle, name: handle.name };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      throw e;
    }
  }
  download(suggestedName, content);
  return { handle: null, name: suggestedName };
}

export function safeFileName(name: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'model';
  return base.endsWith('.xml') ? base : base + '.xml';
}
