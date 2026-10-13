// Model view -> React Flow nodes/edges. The model stores absolute coordinates (spec §6.2); React
// Flow wants parent-relative positions, converted here and back in `toAbsolute`.
import type { Edge, Node } from '@xyflow/react';
import type { Id, Model, View } from '../../core/model/types';
import { polylineMidpoint } from '../figures/geometry';
import { computeViewGeometry, type ViewGeometry } from './viewGeometry';

export interface AmNodeData extends Record<string, unknown> {
  nodeId: Id;
  viewId: Id;
}

export interface AmEdgeData extends Record<string, unknown> {
  connId: Id;
  viewId: Id;
}

export type AmNode = Node<AmNodeData, 'am'> | Node<{ connId: Id }, 'anchor'>;
export type AmEdge = Edge<AmEdgeData, 'am'>;

export const ANCHOR_PREFIX = 'anchor:';
export const EDGE_Z = 1000;

export function toFlow(
  model: Model,
  view: View,
  geometry: ViewGeometry = computeViewGeometry(model, view),
): { nodes: AmNode[]; edges: AmEdge[] } {
  const { nodes: byId, visible } = geometry;
  const nodes: AmNode[] = [];
  for (const n of view.nodes) {
    if (!visible.has(n.id)) continue;
    const parent = n.parent !== undefined && visible.has(n.parent) ? byId.get(n.parent) : undefined;
    nodes.push({
      id: n.id,
      type: 'am',
      position: parent ? { x: n.x - parent.x, y: n.y - parent.y } : { x: n.x, y: n.y },
      ...(parent ? { parentId: parent.id } : {}),
      width: n.w,
      height: n.h,
      data: { nodeId: n.id, viewId: view.id },
    });
  }

  // Connections that end on another connection attach to an invisible anchor node at the
  // target connection's midpoint.
  const anchored = new Set<Id>();
  for (const c of view.connections) {
    if (!geometry.lines.has(c.id)) continue;
    for (const end of [c.source, c.target]) {
      if (geometry.lines.has(end)) anchored.add(end);
    }
  }
  for (const id of anchored) {
    const m = polylineMidpoint(geometry.lines.get(id)!);
    nodes.push({
      id: ANCHOR_PREFIX + id,
      type: 'anchor',
      position: { x: m.x, y: m.y },
      width: 1,
      height: 1,
      draggable: false,
      selectable: false,
      focusable: false,
      data: { connId: id },
    });
  }

  const endId = (id: Id) => (byId.has(id) ? id : ANCHOR_PREFIX + id);
  const edges: AmEdge[] = [];
  for (const c of view.connections) {
    if (!geometry.lines.has(c.id)) continue;
    edges.push({
      id: c.id,
      type: 'am',
      source: endId(c.source),
      target: endId(c.target),
      zIndex: EDGE_Z,
      data: { connId: c.id, viewId: view.id },
    });
  }
  return { nodes, edges };
}
