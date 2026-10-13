// Editor store (spec §4, §5): model + history + UI state. UI components never mutate the model
// directly; they call `dispatch` with a command.
import { create } from 'zustand';
import { HISTORY_LIMIT, execute, type Command, type HistoryEntry } from '../commands/command';
import type { ModelWarning } from '../model/references';
import type { Id, Model } from '../model/types';
import { indexView, type ViewIndex } from '../model/viewIndex';

export interface Selection {
  viewId: Id | null;
  nodes: Id[];
  connections: Id[];
}

export interface Toast {
  id: number;
  message: string;
  undoable?: boolean;
}

export interface EditorState {
  model: Model | null;
  importWarnings: ModelWarning[];
  warningsDismissed: boolean;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** seq of the history entry the saved file corresponds to (0 = initial state). */
  savedSeq: number;
  fileName: string | null;
  fileHandle: FileSystemFileHandle | null;

  openViews: Id[];
  activeView: Id | null;
  selection: Selection;
  /** Model tree selection (element, relation or view id). */
  treeSelection: Id | null;
  /** Per-view "Show nested relationships" toggle (§8.6), default off. */
  showNested: Record<Id, boolean>;
  toasts: Toast[];
  /** Inline rename in progress on the canvas (F2 / double-click). */
  editing: { viewId: Id; kind: 'node' | 'connection'; id: Id } | null;
  /** Validation results from the Validate button; null = not run since last change. */
  validation: ModelWarning[] | null;
  /** Blocking error banner (e.g. a file that failed to open). */
  error: string | null;

  load(
    model: Model,
    opts?: {
      warnings?: ModelWarning[];
      fileName?: string | null;
      handle?: FileSystemFileHandle | null;
    },
  ): void;
  close(): void;
  dispatch(cmd: Command): void;
  undo(): void;
  redo(): void;
  markSaved(fileName?: string, handle?: FileSystemFileHandle | null): void;
  openView(id: Id): void;
  closeView(id: Id): void;
  select(sel: Partial<Selection>): void;
  selectInTree(id: Id | null): void;
  toggleNested(viewId: Id): void;
  dismissWarnings(): void;
  toast(message: string, undoable?: boolean): void;
  dropToast(id: number): void;
  setEditing(e: EditorState['editing']): void;
  setValidation(v: ModelWarning[] | null): void;
  setError(e: string | null): void;
}

export const EMPTY_SELECTION: Selection = { viewId: null, nodes: [], connections: [] };

let toastSeq = 0;

export function currentSeq(s: Pick<EditorState, 'past'>): number {
  return s.past[s.past.length - 1]?.seq ?? 0;
}

export function isDirty(s: Pick<EditorState, 'past' | 'savedSeq' | 'model'>): boolean {
  return s.model !== null && currentSeq(s) !== s.savedSeq;
}

/** Drops open tabs and selection entries that no longer exist after a model change. */
function reconcile(s: EditorState, model: Model): Partial<EditorState> {
  const openViews = s.openViews.filter((id) => model.views[id]);
  const activeView =
    s.activeView && model.views[s.activeView] ? s.activeView : (openViews[0] ?? null);
  const view = s.selection.viewId ? model.views[s.selection.viewId] : undefined;
  let selection = s.selection;
  if (!view) selection = EMPTY_SELECTION;
  else {
    const nodes = new Set(view.nodes.map((n) => n.id));
    const conns = new Set(view.connections.map((c) => c.id));
    const sn = s.selection.nodes.filter((id) => nodes.has(id));
    const sc = s.selection.connections.filter((id) => conns.has(id));
    if (sn.length !== s.selection.nodes.length || sc.length !== s.selection.connections.length) {
      selection = { viewId: view.id, nodes: sn, connections: sc };
    }
  }
  const treeSelection =
    s.treeSelection &&
    (model.elements[s.treeSelection] ||
      model.relations[s.treeSelection] ||
      model.views[s.treeSelection])
      ? s.treeSelection
      : null;
  return { openViews, activeView, selection, treeSelection };
}

export const useEditor = create<EditorState>()((set, get) => ({
  model: null,
  importWarnings: [],
  warningsDismissed: false,
  past: [],
  future: [],
  savedSeq: 0,
  fileName: null,
  fileHandle: null,
  openViews: [],
  activeView: null,
  selection: EMPTY_SELECTION,
  treeSelection: null,
  showNested: {},
  toasts: [],
  editing: null,
  validation: null,
  error: null,

  load(model, opts = {}) {
    const first = model.viewOrder[0] ?? null;
    set({
      model,
      importWarnings: opts.warnings ?? [],
      warningsDismissed: false,
      past: [],
      future: [],
      savedSeq: 0,
      fileName: opts.fileName ?? null,
      fileHandle: opts.handle ?? null,
      openViews: first ? [first] : [],
      activeView: first,
      selection: EMPTY_SELECTION,
      treeSelection: null,
      showNested: {},
      editing: null,
      validation: null,
    });
  },

  close() {
    set({
      model: null,
      importWarnings: [],
      past: [],
      future: [],
      savedSeq: 0,
      fileName: null,
      fileHandle: null,
      openViews: [],
      activeView: null,
      selection: EMPTY_SELECTION,
      treeSelection: null,
    });
  },

  dispatch(cmd) {
    const s = get();
    if (!s.model) return;
    const { model, entry } = execute(s.model, cmd);
    if (model === s.model) return; // no-op command
    const past = [...s.past, entry];
    if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
    set({ model, past, future: [], validation: null, ...reconcile(s, model) });
  },

  undo() {
    const s = get();
    const entry = s.past[s.past.length - 1];
    if (!s.model || !entry) return;
    const model = entry.undo.apply(s.model);
    set({ model, past: s.past.slice(0, -1), future: [entry, ...s.future], ...reconcile(s, model) });
  },

  redo() {
    const s = get();
    const entry = s.future[0];
    if (!s.model || !entry) return;
    const model = entry.redo.apply(s.model);
    set({ model, past: [...s.past, entry], future: s.future.slice(1), ...reconcile(s, model) });
  },

  markSaved(fileName, handle) {
    set((s) => ({
      savedSeq: currentSeq(s),
      ...(fileName !== undefined ? { fileName } : {}),
      ...(handle !== undefined ? { fileHandle: handle } : {}),
    }));
  },

  openView(id) {
    set((s) =>
      s.model?.views[id]
        ? {
            openViews: s.openViews.includes(id) ? s.openViews : [...s.openViews, id],
            activeView: id,
          }
        : {},
    );
  },

  closeView(id) {
    set((s) => {
      const i = s.openViews.indexOf(id);
      if (i < 0) return {};
      const openViews = s.openViews.filter((v) => v !== id);
      const activeView =
        s.activeView === id ? (openViews[Math.min(i, openViews.length - 1)] ?? null) : s.activeView;
      return { openViews, activeView };
    });
  },

  select(sel) {
    set((s) => ({ selection: { ...s.selection, ...sel } }));
  },

  selectInTree(id) {
    set({ treeSelection: id });
  },

  toggleNested(viewId) {
    set((s) => ({ showNested: { ...s.showNested, [viewId]: !s.showNested[viewId] } }));
  },

  dismissWarnings() {
    set({ warningsDismissed: true });
  },

  toast(message, undoable) {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, message, undoable }] }));
    setTimeout(() => get().dropToast(id), 6000);
  },

  setEditing(editing) {
    set({ editing });
  },

  setValidation(validation) {
    set({ validation });
  },

  setError(error) {
    set({ error });
  },

  dropToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/** Cached index of a view in the current model (for selectors). */
export function viewOf(s: Pick<EditorState, 'model'>, viewId: Id): ViewIndex | undefined {
  const v = s.model?.views[viewId];
  return v ? indexView(v) : undefined;
}
