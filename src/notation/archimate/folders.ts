// Default organization folders (spec §7.5.5, §9.3): elements created in-app go into a folder per
// layer, matching common tool behaviour. Imported organizations are left as they were.
import type { Model, OrgItem } from '../../core/model/types';
import { text } from '../../core/model/langstring';
import { elementDef, type Layer } from './catalog';

export type DefaultFolder =
  | 'Strategy'
  | 'Business'
  | 'Application'
  | 'Technology & Physical'
  | 'Motivation'
  | 'Implementation & Migration'
  | 'Other'
  | 'Relations'
  | 'Views';

export const DEFAULT_FOLDERS: readonly DefaultFolder[] = [
  'Strategy',
  'Business',
  'Application',
  'Technology & Physical',
  'Motivation',
  'Implementation & Migration',
  'Other',
  'Relations',
  'Views',
];

const LAYER_FOLDER: Record<Layer, DefaultFolder> = {
  strategy: 'Strategy',
  business: 'Business',
  application: 'Application',
  technology: 'Technology & Physical',
  physical: 'Technology & Physical',
  motivation: 'Motivation',
  implementation: 'Implementation & Migration',
  other: 'Other',
};

export function defaultFolderForElement(type: string): DefaultFolder {
  const def = elementDef(type);
  return def ? LAYER_FOLDER[def.layer] : 'Other';
}

/** Top-level folder whose label matches `name` in any language. */
export function findTopFolder(model: Model, name: string): OrgItem | undefined {
  return model.organizations.find(
    (it) => it.ref === undefined && it.label && Object.values(it.label).includes(name),
  );
}

/**
 * Ensures a top-level default folder exists in `draft` and returns it. Inserted in the canonical
 * folder order relative to other default folders.
 */
export function ensureTopFolder(draft: Model, name: DefaultFolder): OrgItem {
  const found = findTopFolder(draft, name);
  if (found) return found;
  const item: OrgItem = { label: { [draft.primaryLang]: name }, items: [] };
  const rank = DEFAULT_FOLDERS.indexOf(name);
  let at = draft.organizations.length;
  for (let i = 0; i < draft.organizations.length; i++) {
    const label = text(draft.organizations[i]!.label, draft.primaryLang);
    const r = DEFAULT_FOLDERS.indexOf(label as DefaultFolder);
    if (r > rank) {
      at = i;
      break;
    }
  }
  draft.organizations.splice(at, 0, item);
  if (draft.organizationSections) {
    // Several <organizations> blocks: grow the block the item landed in.
    let acc = 0;
    for (let s = 0; s < draft.organizationSections.length; s++) {
      acc += draft.organizationSections[s]!;
      if (at < acc || s === draft.organizationSections.length - 1) {
        draft.organizationSections[s]! += 1;
        break;
      }
    }
  }
  return item;
}

/** Adds `id` to the default folder for its kind. */
export function addToDefaultFolder(draft: Model, id: string, folder: DefaultFolder): void {
  ensureTopFolder(draft, folder).items.push({ ref: id, items: [] });
}

/** Removes every folder reference to `id` (recursively). */
export function removeFromFolders(items: OrgItem[], id: string): void {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!;
    if (it.ref === id) items.splice(i, 1);
    else removeFromFolders(it.items, id);
  }
}
