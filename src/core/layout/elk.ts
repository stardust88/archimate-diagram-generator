// Auto-layout (spec §9.5): ELK layered, direction DOWN, partitioned by ArchiMate layer, with
// hierarchyHandling INCLUDE_CHILDREN so nested nodes are laid out inside their parents.
import ELK, { type ElkExtendedEdge, type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { Id, Model, View, ViewNode } from '../model/types';
import { elementDef, type Layer } from '../../notation/archimate/catalog';
import type { NodeRect } from '../commands/model-commands';

/** Partition per layer (§9.5): strategy/motivation 0, business 1, ... implementation 5. */
const PARTITION: Record<Layer, number> = {
  strategy: 0,
  motivation: 0,
  business: 1,
  application: 2,
  technology: 3,
  physical: 4,
  implementation: 5,
  // Location, Grouping and junctions sit with the business layer by default.
  other: 1,
};

const CONTAINER_PADDING = '[top=34,left=14,bottom=14,right=14]';
let elk: InstanceType<typeof ELK> | null = null;

function partitionOf(model: Model, n: ViewNode): number {
  if (n.kind !== 'element') return 0;
  const def = elementDef(model.elements[n.elementRef]?.type ?? '');
  return def ? PARTITION[def.layer] : 1;
}

export interface LayoutResult {
  rects: NodeRect[];
  /** Connections whose ends were laid out: their bendpoints are cleared. */
  connections: Id[];
}

/**
 * Lays out `nodeIds` (with their descendants), or the whole view when omitted. A partial layout
 * keeps the selection's top-left corner where it was.
 */
export async function layoutView(model: Model, view: View, nodeIds?: Id[]): Promise<LayoutResult> {
  elk ??= new ELK();
  const byId = new Map(view.nodes.map((n) => [n.id, n]));
  const children = new Map<Id | undefined, ViewNode[]>();
  const include = new Set<Id>();
  if (nodeIds) {
    const queue = [...nodeIds];
    while (queue.length) {
      const id = queue.pop()!;
      if (include.has(id)) continue;
      include.add(id);
      for (const n of view.nodes) if (n.parent === id) queue.push(n.id);
    }
  } else for (const n of view.nodes) include.add(n.id);

  // Parent within the laid-out set (top-level selected nodes become roots).
  const parentIn = (n: ViewNode) =>
    n.parent !== undefined && include.has(n.parent) ? n.parent : undefined;
  for (const n of view.nodes) {
    if (!include.has(n.id)) continue;
    const p = parentIn(n);
    const list = children.get(p) ?? [];
    list.push(n);
    children.set(p, list);
  }

  const build = (n: ViewNode): ElkNode => {
    const kids = children.get(n.id) ?? [];
    const node: ElkNode = {
      id: n.id,
      layoutOptions: { 'elk.partitioning.partition': String(partitionOf(model, n)) },
    };
    if (kids.length) {
      node.children = kids.map(build);
      node.layoutOptions = {
        ...node.layoutOptions,
        'elk.padding': CONTAINER_PADDING,
        'elk.partitioning.activate': 'true',
      };
    } else {
      node.width = n.w;
      node.height = n.h;
    }
    return node;
  };

  const edges: ElkExtendedEdge[] = [];
  const conns: Id[] = [];
  for (const c of view.connections) {
    if (!include.has(c.source) || !include.has(c.target) || c.source === c.target) continue;
    edges.push({ id: c.id, sources: [c.source], targets: [c.target] });
    conns.push(c.id);
  }

  const roots = children.get(undefined) ?? [];
  const graph: ElkNode = {
    id: '__root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.partitioning.activate': 'true',
      'elk.spacing.nodeNode': '30',
      'elk.layered.spacing.nodeNodeBetweenLayers': '50',
      'elk.edgeRouting': 'POLYLINE',
    },
    children: roots.map(build),
    edges,
  };
  const out = await elk.layout(graph);

  // Origin: the current top-left of what is laid out (0,0 offset 20 for a full view).
  const top = roots.length ? roots : [];
  const ox = nodeIds && top.length ? Math.min(...top.map((n) => n.x)) : 20;
  const oy = nodeIds && top.length ? Math.min(...top.map((n) => n.y)) : 20;
  const rects: NodeRect[] = [];
  const walk = (n: ElkNode, px: number, py: number) => {
    for (const c of n.children ?? []) {
      const x = px + (c.x ?? 0);
      const y = py + (c.y ?? 0);
      const orig = byId.get(c.id)!;
      rects.push({
        id: c.id,
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(c.width ?? orig.w),
        h: Math.round(c.height ?? orig.h),
      });
      walk(c, x, y);
    }
  };
  // Anchor the laid-out bounding box (ELK adds its own root padding) at the origin.
  const kids = out.children ?? [];
  const minX = kids.length ? Math.min(...kids.map((c) => c.x ?? 0)) : 0;
  const minY = kids.length ? Math.min(...kids.map((c) => c.y ?? 0)) : 0;
  walk(out, ox - minX, oy - minY);
  return { rects, connections: conns };
}
