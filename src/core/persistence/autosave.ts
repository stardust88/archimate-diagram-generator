// Autosave to IndexedDB (spec §11): the working model is written on every change, debounced 1 s,
// under one key. On startup the app offers to restore it.
import { del, get, set } from 'idb-keyval';
import type { Model } from '../model/types';

export const AUTOSAVE_KEY = 'archimate-editor:autosave';
export const AUTOSAVE_DELAY = 1000;

export interface AutosaveRecord {
  version: 1;
  savedAt: number;
  fileName: string | null;
  model: Model;
}

export async function readAutosave(): Promise<AutosaveRecord | null> {
  try {
    const rec = (await get(AUTOSAVE_KEY)) as AutosaveRecord | undefined;
    return rec && rec.version === 1 && rec.model ? rec : null;
  } catch {
    return null;
  }
}

export async function writeAutosave(model: Model, fileName: string | null): Promise<void> {
  try {
    const rec: AutosaveRecord = { version: 1, savedAt: Date.now(), fileName, model };
    await set(AUTOSAVE_KEY, rec);
  } catch {
    // Storage unavailable (private mode, quota): autosave is best effort.
  }
}

export async function clearAutosave(): Promise<void> {
  try {
    await del(AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}

/** Debounced writer: call on every model change; `flush` writes immediately. */
export function createAutosaver(delay = AUTOSAVE_DELAY) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { model: Model; fileName: string | null } | null = null;
  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const p = pending;
    pending = null;
    if (p) await writeAutosave(p.model, p.fileName);
  };
  return {
    schedule(model: Model, fileName: string | null) {
      pending = { model, fileName };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
    flush,
  };
}
