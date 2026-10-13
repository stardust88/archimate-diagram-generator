// Editor actions shared by the toolbar, keyboard shortcuts, context menus and canvas. Every model
// change goes through a command (spec §5 rule).
import type { Command } from '../core/commands/command';
import * as C from '../core/commands/model-commands';
import { text } from '../core/model/langstring';
import { checkReferences } from '../core/model/references';
import type { Id, Model, Point, ViewNode } from '../core/model/types';
import {
  download,
  pickFile,
  safeFileName,
  saveAs,
  writeToHandle,
  type OpenedFile,
} from '../core/persistence/files';
import { clearAutosave } from '../core/persistence/autosave';
import { isDirty, useEditor } from '../core/store/store';
import { elementDef, isJunction } from '../notation/archimate/catalog';
import { exportModel } from '../notation/archimate/exchange/export';
import { ImportError, importModel } from '../notation/archimate/exchange/import';
import { relationshipDef } from '../notation/archimate/relationships';
import { allowedRelationships, conceptKey, validateModel } from '../notation/archimate/validation';
import { NESTING_TYPES } from './canvas/viewGeometry';
import { choiceMenu, confirmDialog, promptDialog } from './dialogs/dialogApi';

// ---------------------------------------------------------------------------------------------
// Canvas registry: the active canvas exposes viewport helpers to actions.

export interface CanvasApi {
  fitView(): void;
  zoomIn(): void;
  zoomOut(): void;
  /** Flow (model) coordinates of the viewport centre. */
  center(): Point;
}

let canvas: CanvasApi | null = null;
export function registerCanvas(api: CanvasApi | null): void {
  canvas = api;
}
export function canvasApi(): CanvasApi | null {
  return canvas;
}

const st = () => useEditor.getState();
const dispatch = (cmd: Command) => st().dispatch(cmd);

// ---------------------------------------------------------------------------------------------
// File

async function confirmDiscard(): Promise<boolean> {
  if (!isDirty(st())) return true;
  return confirmDialog({
    title: 'Discard unsaved changes?',
    message: 'The current model has changes that are not saved.',
    confirmLabel: 'Discard',
    danger: true,
  });
}

export async function newModel(): Promise<void> {
  if (!(await confirmDiscard())) return;
  const name = await promptDialog({
    title: 'New model',
    label: 'Model name',
    initial: 'New model',
    confirmLabel: 'Create',
  });
  if (name === null) return;
  st().load(C.createModel(name.trim()));
  st().setError(null);
}

export function loadFile(f: OpenedFile): boolean {
  try {
    // User Timing marks (visible in the browser's performance tools; used by the perf test).
    performance.mark('am:import-start');
    const { model, warnings } = importModel(f.text, f.name);
    performance.mark('am:import-parsed');
    st().load(model, { warnings, fileName: f.name, handle: f.handle });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => performance.mark('am:import-rendered')),
    );
    st().setError(null);
    return true;
  } catch (e) {
    // The current model is untouched on failure (US-1).
    const pos =
      e instanceof ImportError && e.line
        ? ` (line ${e.line}${e.column ? `, column ${e.column}` : ''})`
        : '';
    st().setError(`Could not open ${f.name}: ${e instanceof Error ? e.message : String(e)}${pos}`);
    return false;
  }
}

export async function openFile(): Promise<void> {
  if (!(await confirmDiscard())) return;
  const f = await pickFile();
  if (f) loadFile(f);
}

/** Lightweight pre-export check (§7.5.8): warn about dangling references. */
async function confirmExportable(model: Model): Promise<boolean> {
  const problems = checkReferences(model);
  if (problems.length === 0) return true;
  return confirmDialog({
    title: 'Export with problems?',
    message: `The model has ${problems.length} dangling reference(s). They are kept as they are, so the file may not validate against the Exchange Format schema.`,
    details: problems.slice(0, 20).map((p) => p.message),
    confirmLabel: 'Export anyway',
  });
}

function fileNameFor(model: Model): string {
  return safeFileName(st().fileName ?? (text(model.name, model.primaryLang) || 'model'));
}

export async function save(): Promise<void> {
  const s = st();
  if (!s.model || !(await confirmExportable(s.model))) return;
  const xml = exportModel(s.model);
  try {
    if (s.fileHandle && (await writeToHandle(s.fileHandle, xml))) {
      s.markSaved();
    } else {
      const res = await saveAs(fileNameFor(s.model), xml);
      if (!res) return;
      s.markSaved(res.name, res.handle);
    }
    await clearAutosave();
    s.toast('Saved');
  } catch (e) {
    s.setError(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function exportXml(): Promise<void> {
  const s = st();
  if (!s.model || !(await confirmExportable(s.model))) return;
  download(fileNameFor(s.model), exportModel(s.model));
  // A download is a save when there is no file handle to write to (US-5).
  if (!s.fileHandle) {
    s.markSaved();
    await clearAutosave();
  }
}

// ---------------------------------------------------------------------------------------------
// Selection-based edits

function selectionInActiveView(): { viewId: Id; nodes: Id[]; connections: Id[] } | null {
  const s = st();
  if (!s.activeView || s.selection.viewId !== s.activeView) return null;
  if (!s.selection.nodes.length && !s.selection.connections.length) return null;
  return { viewId: s.activeView, nodes: s.selection.nodes, connections: s.selection.connections };
}

export function removeSelectionFromView(): void {
  const sel = selectionInActiveView();
  if (sel) dispatch(C.removeFromView(sel.viewId, sel.nodes, sel.connections));
}

/** Element/relation ids behind the current canvas selection, or the tree selection. */
function selectedModelIds(): Id[] {
  const s = st();
  const m = s.model;
  if (!m) return [];
  const sel = selectionInActiveView();
  if (sel) {
    const v = m.views[sel.viewId]!;
    const ids = new Set<Id>();
    for (const n of v.nodes)
      if (sel.nodes.includes(n.id) && n.kind === 'element') ids.add(n.elementRef);
    for (const c of v.connections)
      if (sel.connections.includes(c.id) && c.relationshipRef) ids.add(c.relationshipRef);
    return [...ids];
  }
  if (s.treeSelection && (m.elements[s.treeSelection] || m.relations[s.treeSelection]))
    return [s.treeSelection];
  return [];
}

export async function deleteFromModel(ids: Id[] = selectedModelIds()): Promise<void> {
  const m = st().model;
  if (!m || ids.length === 0) return;
  const views = C.affectedViews(m, ids);
  const names = ids.map((id) => {
    const e = m.elements[id];
    if (e)
      return `${text(e.name, m.primaryLang) || '(unnamed)'} (${elementDef(e.type)?.label ?? e.type})`;
    const r = m.relations[id];
    return r ? `${relationshipDef(r.type)?.label ?? r.type} relationship` : id;
  });
  const ok = await confirmDialog({
    title: `Delete ${ids.length === 1 ? names[0] : `${ids.length} items`} from the model?`,
    message:
      views.length === 0
        ? 'It is not shown in any view. Attached relationships are deleted too.'
        : `It will also disappear from ${views.length} view(s), together with attached relationships:`,
    details: views.map((v) => text(m.views[v]!.name, m.primaryLang) || v),
    confirmLabel: 'Delete from model',
    danger: true,
  });
  if (ok) dispatch(C.deleteFromModel(ids));
}

let clipboard: C.ClipboardData | null = null;
let pasteCount = 0;

export function copy(): void {
  const sel = selectionInActiveView();
  const m = st().model;
  if (!sel || !m || !sel.nodes.length) return;
  clipboard = C.copySelection(m, sel.viewId, sel.nodes);
  pasteCount = 0;
}

export function paste(): void {
  const s = st();
  if (!clipboard || !s.model || !s.activeView) return;
  pasteCount++;
  const offset = clipboard.sourceViewId === s.activeView ? 20 * pasteCount : 0;
  const { cmd, nodeIds, connIds } = C.paste(s.model, s.activeView, clipboard, {
    x: offset,
    y: offset,
  });
  dispatch(cmd);
  s.select({ viewId: s.activeView, nodes: nodeIds, connections: connIds });
}

export function duplicate(): void {
  copy();
  paste();
}

export function selectAll(): void {
  const s = st();
  const v = s.activeView ? s.model?.views[s.activeView] : undefined;
  if (!v) return;
  s.select({
    viewId: v.id,
    nodes: v.nodes.map((n) => n.id),
    connections: v.connections.map((c) => c.id),
  });
}

export function nudge(dx: number, dy: number): void {
  const sel = selectionInActiveView();
  const v = sel ? st().model?.views[sel.viewId] : undefined;
  if (!sel || !v || !sel.nodes.length) return;
  // Only top-most selected nodes; descendants follow.
  const selected = new Set(sel.nodes);
  const tops = v.nodes.filter(
    (n) => selected.has(n.id) && !hasSelectedAncestor(v.nodes, n, selected),
  );
  dispatch(
    C.moveResizeNodes(
      v.id,
      tops.map((n) => ({
        id: n.id,
        x: Math.max(0, n.x + dx),
        y: Math.max(0, n.y + dy),
        w: n.w,
        h: n.h,
      })),
      `Move ${tops.length === 1 ? 'element' : `${tops.length} elements`}`,
    ),
  );
}

function hasSelectedAncestor(nodes: ViewNode[], n: ViewNode, selected: Set<Id>): boolean {
  const byId = new Map(nodes.map((x) => [x.id, x]));
  let p = n.parent;
  while (p !== undefined) {
    if (selected.has(p)) return true;
    p = byId.get(p)?.parent;
  }
  return false;
}

export function startRename(): void {
  const s = st();
  const sel = selectionInActiveView();
  if (!sel) return;
  if (sel.nodes.length === 1) s.setEditing({ viewId: sel.viewId, kind: 'node', id: sel.nodes[0]! });
  else if (sel.connections.length === 1)
    s.setEditing({ viewId: sel.viewId, kind: 'connection', id: sel.connections[0]! });
}

/** Commits an inline rename: element name, relation name, or the node's own label. */
export function commitRename(viewId: Id, kind: 'node' | 'connection', id: Id, value: string): void {
  const s = st();
  const m = s.model;
  s.setEditing(null);
  const v = m?.views[viewId];
  if (!m || !v) return;
  const lang = m.primaryLang;
  if (kind === 'node') {
    const n = v.nodes.find((x) => x.id === id);
    if (!n) return;
    if (n.kind === 'element' && !(n.label && Object.keys(n.label).length)) {
      if (text(m.elements[n.elementRef]?.name, lang) !== value)
        dispatch(C.rename({ kind: 'element', id: n.elementRef }, lang, value));
    } else if (text(n.label, lang) !== value) {
      dispatch(C.rename({ kind: 'node', viewId, id }, lang, value));
    }
  } else {
    const c = v.connections.find((x) => x.id === id);
    if (!c) return;
    if (c.relationshipRef && !(c.label && Object.keys(c.label).length)) {
      if (text(m.relations[c.relationshipRef]?.name, lang) !== value) {
        dispatch(C.rename({ kind: 'relation', id: c.relationshipRef }, lang, value));
      }
    } else if (text(c.label, lang) !== value) {
      dispatch(C.rename({ kind: 'connection', viewId, id }, lang, value));
    }
  }
}

export function validate(): void {
  const m = st().model;
  if (m) st().setValidation(validateModel(m));
}

// ---------------------------------------------------------------------------------------------
// Views

export async function addView(): Promise<void> {
  const m = st().model;
  if (!m) return;
  const name = await promptDialog({
    title: 'New view',
    label: 'View name',
    initial: `View ${m.viewOrder.length + 1}`,
    confirmLabel: 'Add',
  });
  if (name === null) return;
  const { cmd, id } = C.addView(name.trim());
  dispatch(cmd);
  st().openView(id);
}

export async function renameView(id: Id): Promise<void> {
  const m = st().model;
  const v = m?.views[id];
  if (!m || !v) return;
  const name = await promptDialog({
    title: 'Rename view',
    label: 'View name',
    initial: text(v.name, m.primaryLang),
    confirmLabel: 'Rename',
  });
  if (name !== null) dispatch(C.renameView(id, m.primaryLang, name.trim()));
}

export function duplicateView(id: Id): void {
  const { cmd, id: copyId } = C.duplicateView(id);
  dispatch(cmd);
  st().openView(copyId);
}

export async function deleteView(id: Id): Promise<void> {
  const m = st().model;
  const v = m?.views[id];
  if (!m || !v) return;
  const ok = await confirmDialog({
    title: `Delete view "${text(v.name, m.primaryLang)}"?`,
    message: 'The view is removed; the elements and relationships it shows stay in the model.',
    confirmLabel: 'Delete view',
    danger: true,
  });
  if (ok) dispatch(C.deleteView(id));
}

// ---------------------------------------------------------------------------------------------
// Adding to views and nesting (§9.4)

export function relationTypeLabel(type: string): string {
  return relationshipDef(type)?.label ?? type;
}

/** Valid nesting relationship types from a parent element type to a child element type. */
export function nestingOptions(parentType: string, childType: string): string[] {
  if (isJunction(parentType) || isJunction(childType)) return [];
  return allowedRelationships(parentType, childType)
    .map((d) => d.type)
    .filter((t) => NESTING_TYPES.has(t));
}

function existingNesting(m: Model, parentElement: Id, childElement: Id): boolean {
  return Object.values(m.relations).some(
    (r) =>
      NESTING_TYPES.has(r.type) &&
      ((r.source === parentElement && r.target === childElement) ||
        (r.source === childElement && r.target === parentElement)),
  );
}

/**
 * Decides the relationship to create when a child is nested in a parent element (§9.4):
 * an existing nesting relationship = none; one valid type = that type; several = picker (with
 * "Don't create relationship"); none = visual nesting only, with an info toast.
 * `child` is an existing element id, or `{ type }` for an element about to be created.
 */
export async function chooseNesting(
  parentElement: Id | undefined,
  child: Id | { type: string } | undefined,
  at: Point,
): Promise<string | undefined> {
  const m = st().model;
  if (!m || !parentElement || !child) return undefined;
  const parentType = m.elements[parentElement]?.type;
  const childType = typeof child === 'string' ? m.elements[child]?.type : child.type;
  if (!parentType || !childType) return undefined;
  if (typeof child === 'string' && existingNesting(m, parentElement, child)) return undefined;
  const opts = nestingOptions(parentType, childType);
  if (opts.length === 0) {
    st().toast('Nested visually only: no relationship is valid between these elements.');
    return undefined;
  }
  if (opts.length === 1) return opts[0];
  const choice = await choiceMenu({
    title: 'Nest as',
    at,
    options: [
      ...opts.map((t) => ({ value: t, label: relationTypeLabel(t) })),
      { value: '', label: "Don't create relationship", hint: 'visual only' },
    ],
  });
  return choice || undefined;
}

/** Relationship menu after drawing a connection (§3 US-3): only valid types are offered. */
export async function chooseRelationship(
  m: Model,
  sourceConcept: Id,
  targetConcept: Id,
  at: Point,
): Promise<string | null> {
  const s = conceptKey(m, sourceConcept);
  const t = conceptKey(m, targetConcept);
  if (!s || !t) return null;
  const types = allowedRelationships(s, t);
  if (types.length === 0) {
    st().toast('No ArchiMate relationship is allowed between these two.');
    return null;
  }
  return choiceMenu({
    title: 'Relationship',
    at,
    options: types.map((d) => ({ value: d.type, label: d.label })),
  });
}

export function undoToast(message: string): void {
  st().toast(message, true);
}

// ---------------------------------------------------------------------------------------------
// Layout, align, distribute (Phase 4)

/** Lays out the active view, or only the selected nodes when some are selected (§9.5). */
export async function layout(selectionOnly = false): Promise<void> {
  const s = st();
  const m = s.model;
  const v = s.activeView ? m?.views[s.activeView] : undefined;
  if (!m || !v) return;
  const sel = selectionInActiveView();
  if (selectionOnly && !sel?.nodes.length) return;
  const { layoutView } = await import('../core/layout/elk');
  const res = await layoutView(m, v, selectionOnly ? sel!.nodes : undefined);
  dispatch(
    C.applyLayout(
      v.id,
      res.rects,
      res.connections,
      selectionOnly ? 'Layout selection' : 'Layout view',
    ),
  );
  if (!selectionOnly) canvas?.fitView();
}

function selectedTopNodes(): { viewId: Id; nodes: ViewNode[] } | null {
  const sel = selectionInActiveView();
  const v = sel ? st().model?.views[sel.viewId] : undefined;
  if (!sel || !v) return null;
  const selected = new Set(sel.nodes);
  // Keep selection order so the first-selected node is the alignment reference.
  const nodes = sel.nodes
    .map((id) => v.nodes.find((n) => n.id === id))
    .filter((n): n is ViewNode => !!n && !hasSelectedAncestor(v.nodes, n, selected));
  return { viewId: v.id, nodes };
}

export function align(how: C.Alignment): void {
  const t = selectedTopNodes();
  if (t && t.nodes.length >= 2) dispatch(C.alignNodes(t.viewId, t.nodes, how));
}

export function distribute(axis: 'horizontal' | 'vertical'): void {
  const t = selectedTopNodes();
  if (t && t.nodes.length >= 3) dispatch(C.distributeNodes(t.viewId, t.nodes, axis));
}
