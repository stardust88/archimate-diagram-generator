// Model tree structure (spec §9.3): mirrors <organizations>; anything not in a folder is shown
// under the default folder for its kind.
import { text } from '../../core/model/langstring';
import type { Id, Model, OrgItem } from '../../core/model/types';
import { elementDef } from '../../notation/archimate/catalog';
import { relationshipDef } from '../../notation/archimate/relationships';
import { xsiFromType } from '../../notation/archimate/exchange/mapping';
import {
  DEFAULT_FOLDERS,
  defaultFolderForElement,
  findTopFolder,
} from '../../notation/archimate/folders';

export interface TreeNode {
  key: string;
  label: string;
  kind: 'folder' | 'element' | 'relation' | 'view' | 'missing';
  /** Model object id for element/relation/view nodes. */
  id?: Id;
  /** Element/relationship type, for icons and tooltips. */
  type?: string;
  /** Path of indices into model.organizations for real folders (for drag between folders). */
  path?: number[];
  children: TreeNode[];
}

function objectNode(model: Model, id: Id, key: string): TreeNode {
  const lang = model.primaryLang;
  const e = model.elements[id];
  if (e) {
    const label = text(e.name, lang) || elementDef(e.type)?.label || xsiFromType(e.type);
    return { key, label, kind: 'element', id, type: e.type, children: [] };
  }
  const r = model.relations[id];
  if (r) {
    const name = text(r.name, lang);
    const src = model.elements[r.source] ? text(model.elements[r.source]!.name, lang) : '…';
    const tgt = model.elements[r.target] ? text(model.elements[r.target]!.name, lang) : '…';
    const typeLabel = relationshipDef(r.type)?.label ?? xsiFromType(r.type);
    return {
      key,
      label: name ? `${name} (${typeLabel})` : `${typeLabel}: ${src} → ${tgt}`,
      kind: 'relation',
      id,
      type: r.type,
      children: [],
    };
  }
  const v = model.views[id];
  if (v) return { key, label: text(v.name, lang) || 'View', kind: 'view', id, children: [] };
  return { key, label: `Missing: ${id}`, kind: 'missing', id, children: [] };
}

export function buildTree(model: Model): TreeNode[] {
  const placed = new Set<Id>();
  const lang = model.primaryLang;

  const walk = (items: OrgItem[], path: number[], keyPrefix: string): TreeNode[] =>
    items.map((it, i) => {
      const key = `${keyPrefix}/${i}`;
      if (it.ref !== undefined && it.items.length === 0 && !it.label) {
        placed.add(it.ref);
        return objectNode(model, it.ref, key);
      }
      if (it.ref !== undefined) placed.add(it.ref);
      return {
        key,
        label: text(it.label, lang) || 'Folder',
        kind: 'folder' as const,
        path: [...path, i],
        children: walk(it.items, [...path, i], key),
      };
    });

  const roots = walk(model.organizations, [], 'org');

  // Unplaced objects go into default folders (existing top-level folder with that name, or a
  // virtual one).
  const extra = new Map<string, TreeNode[]>();
  const add = (folder: string, id: Id) => {
    const list = extra.get(folder) ?? [];
    list.push(objectNode(model, id, `default/${folder}/${id}`));
    extra.set(folder, list);
  };
  for (const e of Object.values(model.elements)) {
    if (!placed.has(e.id)) add(defaultFolderForElement(e.type), e.id);
  }
  for (const r of Object.values(model.relations)) if (!placed.has(r.id)) add('Relations', r.id);
  for (const id of model.viewOrder) if (!placed.has(id)) add('Views', id);

  for (const name of DEFAULT_FOLDERS) {
    const items = extra.get(name);
    if (!items) continue;
    const existing = findTopFolder(model, name);
    const node = existing ? roots[model.organizations.indexOf(existing)] : undefined;
    if (node) node.children.push(...items);
    else roots.push({ key: `default/${name}`, label: name, kind: 'folder', children: items });
  }
  return roots;
}

/** Views that contain a node for element `id`. */
export function viewsContaining(model: Model, id: Id): Id[] {
  return model.viewOrder.filter((vid) =>
    model.views[vid]!.nodes.some((n) => n.kind === 'element' && n.elementRef === id),
  );
}
