// Edit commands (spec §6.3). Each factory returns one Command = one undo step. Ids are generated
// in the factory (never inside a recipe) so redo replays identically.
import { newId } from '../model/langstring';
import type {
  AccessType,
  Element,
  Id,
  LangString,
  Model,
  OrgItem,
  Point,
  Property,
  Relation,
  Style,
  View,
  ViewConnection,
  ViewNode,
} from '../model/types';
import {
  addToDefaultFolder,
  defaultFolderForElement,
  ensureTopFolder,
  removeFromFolders,
  type DefaultFolder,
} from '../../notation/archimate/folders';
import { current } from 'immer';
import { command, compound, type Command } from './command';

// ---------------------------------------------------------------------------------------------
// Helpers

export type Owner =
  | { kind: 'model' }
  | { kind: 'element'; id: Id }
  | { kind: 'relation'; id: Id }
  | { kind: 'view'; id: Id }
  | { kind: 'node'; viewId: Id; id: Id }
  | { kind: 'connection'; viewId: Id; id: Id };

interface Named {
  name?: LangString;
  label?: LangString;
  documentation?: LangString;
  properties?: Property[];
}

function view(m: Model, id: Id): View {
  const v = m.views[id];
  if (!v) throw new Error(`No view ${id}`);
  return v;
}

function ownerObject(m: Model, o: Owner): Named | undefined {
  switch (o.kind) {
    case 'model':
      return m;
    case 'element':
      return m.elements[o.id];
    case 'relation':
      return m.relations[o.id];
    case 'view':
      return m.views[o.id];
    case 'node':
      return m.views[o.viewId]?.nodes.find((n) => n.id === o.id);
    case 'connection':
      return m.views[o.viewId]?.connections.find((c) => c.id === o.id);
  }
}

function setLang(target: LangString | undefined, lang: string, value: string): LangString {
  const next: LangString = { ...target };
  next[lang] = value;
  return next;
}

/** Node ids of `ids` plus all their descendants. */
export function withDescendants(v: View, ids: Iterable<Id>): Set<Id> {
  const out = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of v.nodes) {
      if (n.parent !== undefined && out.has(n.parent) && !out.has(n.id)) {
        out.add(n.id);
        grew = true;
      }
    }
  }
  return out;
}

/** Connections attached (directly or via other connections) to removed nodes/connections. */
function attachedConnections(v: View, removed: Set<Id>): Set<Id> {
  const out = new Set<Id>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of v.connections) {
      if (out.has(c.id)) continue;
      if (
        removed.has(c.id) ||
        removed.has(c.source) ||
        removed.has(c.target) ||
        out.has(c.source) ||
        out.has(c.target)
      ) {
        out.add(c.id);
        grew = true;
      }
    }
  }
  return out;
}

/** Keeps `nodes` in pre-order (parents before children), as the exporter and React Flow need. */
function sortPreOrder(v: View): void {
  const byParent = new Map<Id | undefined, ViewNode[]>();
  const ids = new Set(v.nodes.map((n) => n.id));
  for (const n of v.nodes) {
    const p = n.parent !== undefined && ids.has(n.parent) ? n.parent : undefined;
    const list = byParent.get(p) ?? [];
    list.push(n);
    byParent.set(p, list);
  }
  const out: ViewNode[] = [];
  const visit = (p: Id | undefined) => {
    for (const n of byParent.get(p) ?? []) {
      out.push(n);
      visit(n.id);
    }
  };
  visit(undefined);
  if (out.length === v.nodes.length && out.some((n, i) => n !== v.nodes[i])) {
    v.nodes.splice(0, v.nodes.length, ...out);
  }
}

function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ---------------------------------------------------------------------------------------------
// Model / elements / relations

export interface NewElement {
  id?: Id;
  type: string;
  name: string;
  documentation?: string;
  properties?: Property[];
  folder?: DefaultFolder | false;
}

/** Recipe part: adds an element (and files it in its default folder unless folder === false). */
function addElementTo(m: Model, e: NewElement & { id: Id }): void {
  const el: Element = {
    id: e.id,
    type: e.type,
    name: { [m.primaryLang]: e.name },
    properties: e.properties ?? [],
  };
  if (e.documentation) el.documentation = { [m.primaryLang]: e.documentation };
  m.elements[e.id] = el;
  if (e.folder !== false) addToDefaultFolder(m, e.id, e.folder ?? defaultFolderForElement(e.type));
}

export function addElement(e: NewElement): { cmd: Command; id: Id } {
  const id = e.id ?? newId();
  return { cmd: command(`Add ${e.name}`, (m) => addElementTo(m, { ...e, id })), id };
}

export interface NewRelation {
  id?: Id;
  type: string;
  source: Id;
  target: Id;
  name?: string;
  accessType?: AccessType;
  isDirected?: boolean;
  modifier?: string;
}

function addRelationTo(m: Model, r: NewRelation & { id: Id }): void {
  const rel: Relation = {
    id: r.id,
    type: r.type,
    source: r.source,
    target: r.target,
    properties: [],
  };
  if (r.name) rel.name = { [m.primaryLang]: r.name };
  if (r.accessType !== undefined) rel.accessType = r.accessType;
  if (r.isDirected !== undefined) rel.isDirected = r.isDirected;
  if (r.modifier !== undefined) rel.modifier = r.modifier;
  m.relations[r.id] = rel;
  addToDefaultFolder(m, r.id, 'Relations');
}

export function addRelation(r: NewRelation): { cmd: Command; id: Id } {
  const id = r.id ?? newId();
  return { cmd: command(`Add ${r.type} relationship`, (m) => addRelationTo(m, { ...r, id })), id };
}

export function rename(owner: Owner, lang: string, value: string): Command {
  return command('Rename', (m) => {
    const o = ownerObject(m, owner);
    if (!o) return;
    if (owner.kind === 'node' || owner.kind === 'connection')
      o.label = setLang(o.label, lang, value);
    else if (owner.kind === 'relation' && value === '' && o.name && Object.keys(o.name).length <= 1)
      delete o.name;
    else o.name = setLang(o.name, lang, value);
  });
}

export function setDocumentation(owner: Owner, lang: string, value: string): Command {
  return command('Edit documentation', (m) => {
    const o = ownerObject(m, owner);
    if (!o) return;
    const next = setLang(o.documentation, lang, value);
    if (value === '') delete next[lang];
    if (Object.keys(next).length) o.documentation = next;
    else delete o.documentation;
  });
}

/** Finds a property definition by name (any language) or creates one in the recipe. */
function definitionFor(m: Model, key: string, newDefId: Id): Id {
  const found = m.propertyDefinitions.find((d) => Object.values(d.name).includes(key));
  if (found) return found.id;
  m.propertyDefinitions.push({ id: newDefId, name: { [m.primaryLang]: key }, type: 'string' });
  return newDefId;
}

/** Add (index = undefined), change or remove (key === null) one property. */
export function setProperty(
  owner: Owner,
  index: number | undefined,
  key: string | null,
  value?: string,
): Command {
  const defId = 'propid-' + crypto.randomUUID();
  const label =
    key === null ? 'Remove property' : index === undefined ? 'Add property' : 'Edit property';
  return command(label, (m) => {
    const o = ownerObject(m, owner);
    if (!o?.properties) return;
    const props = o.properties;
    if (key === null) {
      if (index !== undefined) props.splice(index, 1);
      return;
    }
    const definitionRef = definitionFor(m, key, defId);
    if (index === undefined) {
      props.push({ definitionRef, values: { [m.primaryLang]: value ?? '' } });
      return;
    }
    const p = props[index];
    if (!p) return;
    p.definitionRef = definitionRef;
    if (value !== undefined) p.values = setLang(p.values, m.primaryLang, value);
  });
}

export function changeElementType(id: Id, type: string, label: string): Command {
  return command(`Change type to ${label}`, (m) => {
    const e = m.elements[id];
    if (e) e.type = type;
  });
}

export function setRelationAttrs(
  id: Id,
  attrs: { accessType?: AccessType | null; modifier?: string | null; isDirected?: boolean | null },
): Command {
  return command('Edit relationship', (m) => {
    const r = m.relations[id];
    if (!r) return;
    for (const k of ['accessType', 'modifier', 'isDirected'] as const) {
      const v = attrs[k];
      if (v === undefined) continue;
      if (v === null || v === '') delete r[k];
      else (r as unknown as Record<string, unknown>)[k] = v;
    }
  });
}

export function setModelName(lang: string, value: string): Command {
  return rename({ kind: 'model' }, lang, value);
}

/**
 * Deletes elements/relations everywhere (spec US-3): also every relationship attached to them
 * (transitively, relations can target relations), their view nodes and connections, and folder
 * entries. Nested children of a removed node are kept and moved up to its parent.
 */
export function deleteFromModel(ids: Id[]): Command {
  return command(`Delete ${plural(ids.length, 'item')} from model`, (m) => {
    const gone = new Set(ids);
    let grew = true;
    while (grew) {
      grew = false;
      for (const r of Object.values(m.relations)) {
        if (!gone.has(r.id) && (gone.has(r.source) || gone.has(r.target))) {
          gone.add(r.id);
          grew = true;
        }
      }
    }
    for (const id of gone) {
      delete m.elements[id];
      delete m.relations[id];
    }
    for (const v of Object.values(m.views)) {
      const removedNodes = new Set(
        v.nodes.filter((n) => n.kind === 'element' && gone.has(n.elementRef)).map((n) => n.id),
      );
      const parentOf = new Map(v.nodes.map((n) => [n.id, n.parent]));
      for (const n of v.nodes) {
        let p = n.parent;
        while (p !== undefined && removedNodes.has(p)) p = parentOf.get(p);
        if (p !== n.parent) {
          if (p === undefined) delete n.parent;
          else n.parent = p;
        }
      }
      const removed = new Set([
        ...removedNodes,
        ...v.connections
          .filter((c) => c.relationshipRef && gone.has(c.relationshipRef))
          .map((c) => c.id),
      ]);
      const conns = attachedConnections(v, removed);
      if (removedNodes.size) v.nodes = v.nodes.filter((n) => !removedNodes.has(n.id));
      if (conns.size) v.connections = v.connections.filter((c) => !conns.has(c.id));
    }
    for (const id of gone) removeFromFolders(m.organizations, id);
  });
}

/** Views (ids) that show any of `ids` or relationships attached to them. For the confirm dialog. */
export function affectedViews(m: Model, ids: Id[]): Id[] {
  const set = new Set(ids);
  for (const r of Object.values(m.relations))
    if (set.has(r.source) || set.has(r.target)) set.add(r.id);
  return m.viewOrder.filter((vid) => {
    const v = m.views[vid]!;
    return (
      v.nodes.some((n) => n.kind === 'element' && set.has(n.elementRef)) ||
      v.connections.some((c) => c.relationshipRef && set.has(c.relationshipRef))
    );
  });
}

// ---------------------------------------------------------------------------------------------
// View nodes and connections

export interface NewNode {
  id?: Id;
  kind: ViewNode['kind'];
  elementRef?: Id;
  x: number;
  y: number;
  w: number;
  h: number;
  parent?: Id;
  label?: string;
}

function addNodeTo(m: Model, viewId: Id, n: NewNode & { id: Id }): void {
  const v = view(m, viewId);
  const base = {
    id: n.id,
    x: Math.round(n.x),
    y: Math.round(n.y),
    w: Math.round(n.w),
    h: Math.round(n.h),
    ...(n.parent !== undefined ? { parent: n.parent } : {}),
    ...(n.label !== undefined ? { label: { [m.primaryLang]: n.label } } : {}),
  };
  const node: ViewNode =
    n.kind === 'element'
      ? { kind: 'element', elementRef: n.elementRef ?? '', ...base }
      : { kind: n.kind, ...base };
  v.nodes.push(node);
  sortPreOrder(v);
}

export function addViewNode(viewId: Id, n: NewNode): { cmd: Command; id: Id } {
  const id = n.id ?? newId();
  return { cmd: command('Add to view', (m) => addNodeTo(m, viewId, { ...n, id })), id };
}

/** Palette drop: new element + its node (+ optional nesting relationship) as one step. */
export function addElementWithNode(
  viewId: Id,
  e: NewElement,
  rect: { x: number; y: number; w: number; h: number; parent?: Id },
  nesting?: { type: string; parentElement: Id },
): { cmd: Command; elementId: Id; nodeId: Id } {
  const elementId = e.id ?? newId();
  const nodeId = newId();
  const relId = newId();
  const cmd = command(`Add ${e.name}`, (m) => {
    addElementTo(m, { ...e, id: elementId });
    addNodeTo(m, viewId, { kind: 'element', elementRef: elementId, ...rect, id: nodeId });
    if (nesting)
      addRelationTo(m, {
        id: relId,
        type: nesting.type,
        source: nesting.parentElement,
        target: elementId,
      });
  });
  return { cmd, elementId, nodeId };
}

export interface NewConnection {
  id?: Id;
  kind?: ViewConnection['kind'];
  relationshipRef?: Id;
  source: Id;
  target: Id;
  bendpoints?: Point[];
}

function addConnectionTo(m: Model, viewId: Id, c: NewConnection & { id: Id }): void {
  const conn: ViewConnection = {
    id: c.id,
    kind: c.kind ?? (c.relationshipRef ? 'relationship' : 'line'),
    source: c.source,
    target: c.target,
    bendpoints: c.bendpoints ?? [],
  };
  if (c.relationshipRef) conn.relationshipRef = c.relationshipRef;
  view(m, viewId).connections.push(conn);
}

export function addConnection(viewId: Id, c: NewConnection): { cmd: Command; id: Id } {
  const id = c.id ?? newId();
  return { cmd: command('Add connection', (m) => addConnectionTo(m, viewId, { ...c, id })), id };
}

/** Draw a relationship on the canvas: new model relation + its connection. */
export function addRelationWithConnection(
  viewId: Id,
  r: NewRelation,
  ends: { source: Id; target: Id },
): { cmd: Command; relationId: Id; connectionId: Id } {
  const relationId = r.id ?? newId();
  const connectionId = newId();
  const cmd = command(`Add ${r.type} relationship`, (m) => {
    addRelationTo(m, { ...r, id: relationId });
    addConnectionTo(m, viewId, { id: connectionId, relationshipRef: relationId, ...ends });
  });
  return { cmd, relationId, connectionId };
}

export interface NodeRect {
  id: Id;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Sets absolute rects for nodes (one drag/resize = one command). Descendants of moved nodes move
 * with them; bendpoints of connections whose both ends moved shift too.
 */
export function moveResizeNodes(viewId: Id, rects: NodeRect[], label?: string): Command {
  return command(label ?? `Move ${plural(rects.length, 'element')}`, (m) => {
    const v = view(m, viewId);
    const byId = new Map(v.nodes.map((n) => [n.id, n]));
    const moved = new Map<Id, { dx: number; dy: number }>();
    const explicit = new Set(rects.map((r) => r.id));
    for (const r of rects) {
      const n = byId.get(r.id);
      if (!n) continue;
      const dx = Math.round(r.x) - n.x;
      const dy = Math.round(r.y) - n.y;
      n.x = Math.round(r.x);
      n.y = Math.round(r.y);
      n.w = Math.max(1, Math.round(r.w));
      n.h = Math.max(1, Math.round(r.h));
      if (dx || dy) moved.set(n.id, { dx, dy });
    }
    // Shift descendants of moved nodes that were not positioned explicitly.
    for (const n of v.nodes) {
      if (explicit.has(n.id) || n.parent === undefined) continue;
      const d = moved.get(n.parent);
      if (d) {
        n.x += d.dx;
        n.y += d.dy;
        moved.set(n.id, d);
      }
    }
    for (const c of v.connections) {
      const ds = moved.get(c.source);
      const dt = moved.get(c.target);
      if (ds && dt && ds.dx === dt.dx && ds.dy === dt.dy && c.bendpoints.length) {
        c.bendpoints = c.bendpoints.map((p) => ({ x: p.x + ds.dx, y: p.y + ds.dy }));
      }
    }
    for (const c of v.connections) {
      // Stored attachments no longer match moved ends: drop them (renderer recomputes).
      if (moved.has(c.source)) delete c.sourceAttachment;
      if (moved.has(c.target)) delete c.targetAttachment;
    }
  });
}

/** Changes a node's parent (absolute coordinates are unchanged). */
export function reparent(
  viewId: Id,
  nodeIds: Id[],
  parent: Id | undefined,
  rects?: NodeRect[],
): Command {
  return command(parent ? 'Nest' : 'Un-nest', (m) => {
    const v = view(m, viewId);
    const byId = new Map(v.nodes.map((n) => [n.id, n]));
    for (const r of rects ?? []) {
      const n = byId.get(r.id);
      if (n)
        Object.assign(n, {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.w),
          h: Math.round(r.h),
        });
    }
    for (const id of nodeIds) {
      const n = byId.get(id);
      if (!n) continue;
      if (parent === undefined) delete n.parent;
      else n.parent = parent;
    }
    sortPreOrder(v);
  });
}

export function setBendpoints(viewId: Id, connId: Id, bendpoints: Point[]): Command {
  return command('Edit bendpoints', (m) => {
    const c = view(m, viewId).connections.find((x) => x.id === connId);
    if (c) c.bendpoints = bendpoints.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  });
}

/** Removes nodes (with nested children) and connections from a view only (Delete key). */
export function removeFromView(viewId: Id, nodeIds: Id[], connIds: Id[]): Command {
  const n = nodeIds.length + connIds.length;
  return command(`Remove ${plural(n, 'item')} from view`, (m) => {
    const v = view(m, viewId);
    const nodes = withDescendants(v, nodeIds);
    const conns = attachedConnections(v, new Set([...nodes, ...connIds]));
    for (const id of connIds) conns.add(id);
    v.nodes = v.nodes.filter((x) => !nodes.has(x.id));
    v.connections = v.connections.filter((x) => !conns.has(x.id));
  });
}

/** Partial style update; `null` clears a field. */
export type StylePatch = { [K in keyof Style]?: Style[K] | null };

export function setStyle(viewId: Id, nodeIds: Id[], connIds: Id[], patch: StylePatch): Command {
  return command('Change style', (m) => {
    const v = view(m, viewId);
    const targets = [
      ...v.nodes.filter((n) => nodeIds.includes(n.id)),
      ...v.connections.filter((c) => connIds.includes(c.id)),
    ];
    for (const t of targets) {
      const s: Style = { ...t.style };
      for (const [k, val] of Object.entries(patch) as [keyof Style, unknown][]) {
        if (val === null) delete s[k];
        else (s as Record<string, unknown>)[k] = val;
      }
      const meaningful = Object.keys(s).filter((k) => k !== 'order');
      if (meaningful.length) t.style = s;
      else delete t.style;
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Views

export function addView(name: string, id: Id = newId()): { cmd: Command; id: Id } {
  return {
    cmd: command(`Add view ${name}`, (m) => {
      m.views[id] = {
        id,
        name: { [m.primaryLang]: name },
        properties: [],
        nodes: [],
        connections: [],
      };
      m.viewOrder.push(id);
      if (m.organizations.length) addToDefaultFolder(m, id, 'Views');
    }),
    id,
  };
}

export function renameView(id: Id, lang: string, name: string): Command {
  return rename({ kind: 'view', id }, lang, name);
}

export function deleteView(id: Id): Command {
  return command('Delete view', (m) => {
    delete m.views[id];
    m.viewOrder = m.viewOrder.filter((v) => v !== id);
    removeFromFolders(m.organizations, id);
  });
}

/** Copies a view with fresh node/connection ids; it references the same model objects. */
export function duplicateView(id: Id, nameSuffix = ' (copy)'): { cmd: Command; id: Id } {
  const newViewId = newId();
  const ids = new Map<Id, Id>();
  const fresh = (old: Id) => {
    let v = ids.get(old);
    if (!v) {
      v = newId();
      ids.set(old, v);
    }
    return v;
  };
  return {
    cmd: command('Duplicate view', (m) => {
      const src = view(m, id);
      const copy: View = structuredClone(current(src));
      copy.id = newViewId;
      copy.name = Object.fromEntries(Object.entries(src.name).map(([k, v]) => [k, v + nameSuffix]));
      delete copy.extra;
      for (const n of copy.nodes) {
        n.id = fresh(n.id);
        if (n.parent !== undefined) n.parent = fresh(n.parent);
      }
      for (const c of copy.connections) c.id = fresh(c.id);
      for (const c of copy.connections) {
        c.source = ids.get(c.source) ?? c.source;
        c.target = ids.get(c.target) ?? c.target;
      }
      m.views[newViewId] = copy;
      m.viewOrder.splice(m.viewOrder.indexOf(id) + 1, 0, newViewId);
      if (m.organizations.length) addToDefaultFolder(m, newViewId, 'Views');
    }),
    id: newViewId,
  };
}

export function setViewpoint(id: Id, viewpoint: string | undefined): Command {
  return command('Set viewpoint', (m) => {
    const v = view(m, id);
    if (viewpoint) v.viewpoint = viewpoint;
    else delete v.viewpoint;
  });
}

// ---------------------------------------------------------------------------------------------
// Folders (model tree)

function itemAt(items: OrgItem[], path: number[]): OrgItem | undefined {
  let cur: OrgItem | undefined;
  let list = items;
  for (const i of path) {
    cur = list[i];
    if (!cur) return undefined;
    list = cur.items;
  }
  return cur;
}

/** Moves an object into a folder: a real folder (index path) or a default folder by name. */
export function moveToFolder(
  objectId: Id,
  target: { path: number[] } | { name: DefaultFolder },
): Command {
  return command('Move to folder', (m) => {
    const folder =
      'path' in target ? itemAt(m.organizations, target.path) : ensureTopFolder(m, target.name);
    if (!folder) return;
    removeFromFolders(m.organizations, objectId);
    folder.items.push({ ref: objectId, items: [] });
  });
}

// ---------------------------------------------------------------------------------------------
// Copy / paste

export interface ClipboardData {
  sourceViewId: Id;
  nodes: ViewNode[];
  connections: ViewConnection[];
  elements: Record<Id, Element>;
  relations: Record<Id, Relation>;
}

/** Captures selected nodes (with descendants) and the connections among them. */
export function copySelection(m: Model, viewId: Id, nodeIds: Id[]): ClipboardData | null {
  const v = m.views[viewId];
  if (!v) return null;
  const ids = withDescendants(v, nodeIds);
  const nodes = v.nodes.filter((n) => ids.has(n.id));
  const all = new Set<Id>(ids);
  // Connections whose ends are inside the copied set (iterate for connection-to-connection).
  const connections: ViewConnection[] = [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of v.connections) {
      if (!all.has(c.id) && all.has(c.source) && all.has(c.target)) {
        all.add(c.id);
        connections.push(c);
        grew = true;
      }
    }
  }
  const elements: Record<Id, Element> = {};
  for (const n of nodes)
    if (n.kind === 'element' && m.elements[n.elementRef])
      elements[n.elementRef] = m.elements[n.elementRef]!;
  const relations: Record<Id, Relation> = {};
  for (const c of connections)
    if (c.relationshipRef && m.relations[c.relationshipRef])
      relations[c.relationshipRef] = m.relations[c.relationshipRef]!;
  return structuredClone({ sourceViewId: viewId, nodes, connections, elements, relations });
}

/**
 * Pastes into a view. Elements already shown in the target view (or deleted from the model) are
 * copied as new elements; otherwise the new nodes reference the existing elements, so pasting
 * into another view shows the same model objects (spec US-3).
 */
export function paste(
  m: Model,
  viewId: Id,
  clip: ClipboardData,
  offset: Point,
): { cmd: Command; nodeIds: Id[]; connIds: Id[] } {
  const target = m.views[viewId];
  const shown = new Set(
    target?.nodes.flatMap((n) => (n.kind === 'element' ? [n.elementRef] : [])) ?? [],
  );
  const copyElements = new Map<Id, Id>();
  for (const id of Object.keys(clip.elements)) {
    if (shown.has(id) || !m.elements[id]) copyElements.set(id, newId());
  }
  const nodeIds = new Map(clip.nodes.map((n) => [n.id, newId()]));
  const connIds = new Map(clip.connections.map((c) => [c.id, newId()]));
  const copyRelations = new Map<Id, Id>();
  for (const [id, r] of Object.entries(clip.relations)) {
    const endsCopied = copyElements.has(r.source) || copyElements.has(r.target);
    if (
      endsCopied ||
      !m.relations[id] ||
      copyRelations.has(r.source) ||
      copyRelations.has(r.target)
    ) {
      copyRelations.set(id, newId());
    }
  }
  const mapConcept = (id: Id) => copyElements.get(id) ?? copyRelations.get(id) ?? id;
  const n = clip.nodes.length;

  const cmd = command(`Paste ${plural(n, 'element')}`, (draft) => {
    for (const [oldId, newElId] of copyElements) {
      const src = clip.elements[oldId]!;
      const el: Element = structuredClone({ ...src, id: newElId });
      delete el.extra;
      draft.elements[newElId] = el;
      addToDefaultFolder(draft, newElId, defaultFolderForElement(el.type));
    }
    for (const [oldId, newRelId] of copyRelations) {
      const src = clip.relations[oldId]!;
      const r: Relation = structuredClone({
        ...src,
        id: newRelId,
        source: mapConcept(src.source),
        target: mapConcept(src.target),
      });
      delete r.extra;
      draft.relations[newRelId] = r;
      addToDefaultFolder(draft, newRelId, 'Relations');
    }
    const v = view(draft, viewId);
    for (const node of clip.nodes) {
      const copy = structuredClone(node);
      copy.id = nodeIds.get(node.id)!;
      copy.x = Math.max(0, node.x + offset.x);
      copy.y = Math.max(0, node.y + offset.y);
      if (copy.parent !== undefined) {
        const p = nodeIds.get(copy.parent);
        if (p) copy.parent = p;
        else delete copy.parent;
      }
      if (copy.kind === 'element') copy.elementRef = mapConcept(copy.elementRef);
      delete copy.extra;
      v.nodes.push(copy);
    }
    for (const c of clip.connections) {
      const copy = structuredClone(c);
      copy.id = connIds.get(c.id)!;
      copy.source = nodeIds.get(c.source) ?? connIds.get(c.source) ?? c.source;
      copy.target = nodeIds.get(c.target) ?? connIds.get(c.target) ?? c.target;
      if (copy.relationshipRef) copy.relationshipRef = mapConcept(copy.relationshipRef);
      copy.bendpoints = c.bendpoints.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y }));
      delete copy.sourceAttachment;
      delete copy.targetAttachment;
      delete copy.extra;
      v.connections.push(copy);
    }
    sortPreOrder(v);
  });
  return { cmd, nodeIds: [...nodeIds.values()], connIds: [...connIds.values()] };
}

// ---------------------------------------------------------------------------------------------
// Model creation

export function createModel(name: string, lang = 'en'): Model {
  const viewId = newId();
  return {
    id: newId(),
    name: { [lang]: name },
    properties: [],
    propertyDefinitions: [],
    elements: {},
    relations: {},
    organizations: [{ label: { [lang]: 'Views' }, items: [{ ref: viewId, items: [] }] }],
    views: {
      [viewId]: {
        id: viewId,
        name: { [lang]: 'Default View' },
        properties: [],
        nodes: [],
        connections: [],
      },
    },
    viewOrder: [viewId],
    primaryLang: lang,
  };
}

export { compound };
