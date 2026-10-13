// Cached id -> object lookups for a view. Views are immutable (Immer), so the view object is a
// safe cache key; a changed view gets a fresh index.
import type { Id, View, ViewConnection, ViewNode } from './types';

export interface ViewIndex {
  nodes: Map<Id, ViewNode>;
  connections: Map<Id, ViewConnection>;
  children: Map<Id, ViewNode[]>;
}

const cache = new WeakMap<View, ViewIndex>();

export function indexView(view: View): ViewIndex {
  let idx = cache.get(view);
  if (idx) return idx;
  const nodes = new Map<Id, ViewNode>();
  const children = new Map<Id, ViewNode[]>();
  for (const n of view.nodes) {
    nodes.set(n.id, n);
    if (n.parent !== undefined) {
      const list = children.get(n.parent) ?? [];
      list.push(n);
      children.set(n.parent, list);
    }
  }
  idx = { nodes, connections: new Map(view.connections.map((c) => [c.id, c])), children };
  cache.set(view, idx);
  return idx;
}
