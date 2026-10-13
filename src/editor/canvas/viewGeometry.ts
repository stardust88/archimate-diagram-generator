// Pure geometry for a view, from the model's absolute coordinates: which nodes/connections are
// drawable, and each connection's polyline (connections may end on other connections, §7.3.6).
import type { Id, Model, Point, View, ViewConnection, ViewNode } from '../../core/model/types';
import { isJunction } from '../../notation/archimate/catalog';
import { connectionPoints, polylineMidpoint, type End, type Rect } from '../figures/geometry';

/** Relationship types that nesting can represent (spec §9.4; ArchiMate 3.2 §5.5 / Appendix). */
export const NESTING_TYPES = new Set([
  'Composition',
  'Aggregation',
  'Assignment',
  'Realization',
  'Specialization',
]);

export interface ViewGeometry {
  nodes: Map<Id, ViewNode>;
  /** Nodes that can be drawn (element exists); others are hidden but kept (§7.3.7). */
  visible: Set<Id>;
  connections: Map<Id, ViewConnection>;
  /** Drawable connections with their polylines, in document order. */
  lines: Map<Id, Point[]>;
}

export function nodeRect(n: ViewNode): Rect {
  return { x: n.x, y: n.y, w: n.w, h: n.h };
}

export function isAncestor(nodes: Map<Id, ViewNode>, ancestor: Id, id: Id): boolean {
  let cur = nodes.get(id)?.parent;
  const seen = new Set<Id>();
  while (cur !== undefined && !seen.has(cur)) {
    if (cur === ancestor) return true;
    seen.add(cur);
    cur = nodes.get(cur)?.parent;
  }
  return false;
}

/** Hidden because the relationship is shown by nesting (view toggle off, §8.6). */
export function isNestedHidden(model: Model, nodes: Map<Id, ViewNode>, c: ViewConnection): boolean {
  if (c.kind !== 'relationship' || !c.relationshipRef) return false;
  if (c.extra?.xsiType === 'NestingRelationship') return true;
  const r = model.relations[c.relationshipRef];
  if (!r || !NESTING_TYPES.has(r.type)) return false;
  return isAncestor(nodes, c.source, c.target) || isAncestor(nodes, c.target, c.source);
}

export function computeViewGeometry(
  model: Model,
  view: View,
  opts: { showNested?: boolean } = {},
): ViewGeometry {
  const nodes = new Map(view.nodes.map((n) => [n.id, n]));
  const visible = new Set<Id>();
  for (const n of view.nodes) {
    if (n.kind !== 'element' || model.elements[n.elementRef]) visible.add(n.id);
  }
  const connections = new Map(view.connections.map((c) => [c.id, c]));
  const lines = new Map<Id, Point[]>();
  const resolving = new Set<Id>();

  const endOf = (id: Id, c: ViewConnection, which: 'source' | 'target'): End | null => {
    const n = nodes.get(id);
    if (n) {
      if (!visible.has(id)) return null;
      const junction = n.kind === 'element' && isJunction(model.elements[n.elementRef]?.type ?? '');
      return {
        rect: nodeRect(n),
        shape: junction ? 'circle' : 'rect',
        attachment: which === 'source' ? c.sourceAttachment : c.targetAttachment,
      };
    }
    if (connections.has(id)) {
      const pts = line(id);
      if (!pts) return null;
      const m = polylineMidpoint(pts);
      return { rect: { x: m.x, y: m.y, w: 0, h: 0 }, shape: 'point' };
    }
    return null;
  };

  const line = (id: Id): Point[] | null => {
    const done = lines.get(id);
    if (done) return done;
    if (resolving.has(id)) return null; // cycle
    const c = connections.get(id);
    if (!c) return null;
    if (c.kind === 'relationship' && (!c.relationshipRef || !model.relations[c.relationshipRef])) {
      return null;
    }
    if (!opts.showNested && isNestedHidden(model, nodes, c)) return null;
    resolving.add(id);
    const s = endOf(c.source, c, 'source');
    const t = endOf(c.target, c, 'target');
    resolving.delete(id);
    if (!s || !t) return null;
    const pts = connectionPoints(s, t, c.bendpoints);
    lines.set(id, pts);
    return pts;
  };

  for (const c of view.connections) line(c.id);
  // Keep document order.
  const ordered = new Map<Id, Point[]>();
  for (const c of view.connections) {
    const pts = lines.get(c.id);
    if (pts) ordered.set(c.id, pts);
  }
  return { nodes, visible, connections, lines: ordered };
}
