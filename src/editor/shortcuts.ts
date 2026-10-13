// Keyboard shortcuts (spec §9.6), installed once on window.
import { useEffect } from 'react';
import { useEditor } from '../core/store/store';
import { useDialogs } from './dialogs/dialogApi';
import * as A from './actions';

function isTyping(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

export function handleShortcut(e: KeyboardEvent): boolean {
  if (useDialogs.getState().current || isTyping(e.target)) return false;
  const s = useEditor.getState();
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && k === 's') {
    void A.save();
    return true;
  }
  if (!s.model) return false;
  if (mod && k === 'z' && !e.shiftKey) s.undo();
  else if (mod && ((k === 'z' && e.shiftKey) || k === 'y')) s.redo();
  else if (mod && (e.key === 'Delete' || e.key === 'Backspace')) void A.deleteFromModel();
  else if (e.key === 'Delete' || e.key === 'Backspace') A.removeSelectionFromView();
  else if (mod && k === 'c') A.copy();
  else if (mod && k === 'v') A.paste();
  else if (mod && k === 'd') A.duplicate();
  else if (mod && k === 'a') A.selectAll();
  else if (mod && k === '0') A.canvasApi()?.fitView();
  else if (e.key === 'F2') A.startRename();
  else if (e.key.startsWith('Arrow') && !mod) {
    const step = e.shiftKey ? 10 : 1;
    const d = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[e.key];
    if (!d) return false;
    A.nudge(d[0]!, d[1]!);
  } else if (e.key === 'Escape' && (s.selection.nodes.length || s.selection.connections.length)) {
    s.select({ nodes: [], connections: [] });
  } else return false;
  return true;
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (handleShortcut(e)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
