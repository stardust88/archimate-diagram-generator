import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type EdgeChange,
  type EdgeSelectionChange,
  type Node,
  type NodeChange,
  type NodeSelectionChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { Command } from '../../core/commands/command';
import * as C from '../../core/commands/model-commands';
import type { Id, Model, Point, View, ViewNode } from '../../core/model/types';
import { useEditor } from '../../core/store/store';
import { elementDef, isJunction } from '../../notation/archimate/catalog';
import {
  chooseNesting,
  chooseRelationship,
  registerCanvas,
  relationTypeLabel,
  undoToast,
} from '../actions';
import { MarkerDefs } from '../figures/Markers';
import { toFlow, type AmNode } from './adapter';
import { ArchimateEdge } from './ArchimateEdge';
import { AnchorNode, ArchimateNode } from './ArchimateNode';
import { CanvasContext, type CanvasContextValue } from './canvasContext';
import styles from './Canvas.module.css';
import { computeViewGeometry } from './viewGeometry';

const nodeTypes = { am: ArchimateNode, anchor: AnchorNode };
const edgeTypes = { am: ArchimateEdge };

/** Drag-and-drop payloads: a new element type (palette) or an existing element id (tree). */
export const DND_TYPE = 'application/x-archimate-type';
export const DND_REF = 'application/x-archimate-ref';

interface Props {
  viewId: string;
  minimap: boolean;
}

/** Deepest node that can contain children at point p (not labels or junctions, not excluded). */
export function containerAt(
  model: Model,
  view: View,
  p: Point,
  exclude: Set<Id>,
): ViewNode | undefined {
  let found: ViewNode | undefined;
  for (const n of view.nodes) {
    if (exclude.has(n.id) || n.kind === 'label') continue;
    if (n.kind === 'element') {
      const e = model.elements[n.elementRef];
      if (!e || isJunction(e.type)) continue;
    }
    // Pre-order: a later match inside an earlier one is deeper.
    if (p.x >= n.x && p.x <= n.x + n.w && p.y >= n.y && p.y <= n.y + n.h) found = n;
  }
  return found;
}

function elementOf(n: ViewNode | undefined): Id | undefined {
  return n?.kind === 'element' ? n.elementRef : undefined;
}

interface Link {
  from: Point;
  to: Point;
}

function CanvasInner({ viewId, minimap }: Props) {
  const view = useEditor((s) => s.model?.views[viewId]);
  const elements = useEditor((s) => s.model?.elements);
  const relations = useEditor((s) => s.model?.relations);
  const showNested = useEditor((s) => !!s.showNested[viewId]);
  const selection = useEditor((s) => s.selection);
  const rf = useReactFlow<AmNode>();
  const wrapper = useRef<HTMLDivElement>(null);
  const [link, setLink] = useState<Link | null>(null);
  // Fit once when the view opens; an empty view must not re-fit when its first node appears.
  const [fitOnOpen] = useState(
    () => (useEditor.getState().model?.views[viewId]?.nodes.length ?? 0) > 0,
  );

  const flow = useMemo(() => {
    const model = useEditor.getState().model;
    if (!model || !view) return { nodes: [], edges: [] };
    return toFlow(model, view, computeViewGeometry(model, view, { showNested }));
    // Re-derive only when what the canvas shows changes, not on every model change.
  }, [view, elements, relations, showNested]); // eslint-disable-line react-hooks/exhaustive-deps

  // Local node state lets React Flow move nodes during a drag; it is re-derived from the model
  // whenever the flow or the store selection changes (adjust-state-during-render pattern).
  const withSelection = (ns: AmNode[]) => {
    const selected = selection.viewId === viewId ? new Set(selection.nodes) : new Set<string>();
    return ns.map((n) => (selected.has(n.id) ? { ...n, selected: true } : n));
  };
  const [nodes, setNodes] = useState<AmNode[]>(() => withSelection(flow.nodes));
  const [synced, setSynced] = useState({ flow: flow.nodes, selection });
  if (synced.flow !== flow.nodes || synced.selection !== selection) {
    setSynced({ flow: flow.nodes, selection });
    setNodes(withSelection(flow.nodes));
  }

  const edges = useMemo(() => {
    const selected =
      selection.viewId === viewId ? new Set(selection.connections) : new Set<string>();
    return flow.edges.map((e) => (selected.has(e.id) ? { ...e, selected: true } : e));
  }, [flow.edges, selection, viewId]);

  useEffect(() => {
    registerCanvas({
      fitView: () => void rf.fitView({ maxZoom: 1, padding: 0.1, duration: 200 }),
      zoomIn: () => void rf.zoomIn({ duration: 150 }),
      zoomOut: () => void rf.zoomOut({ duration: 150 }),
      center: () => {
        const r = wrapper.current?.getBoundingClientRect();
        if (!r) return { x: 0, y: 0 };
        return rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      },
    });
    return () => registerCanvas(null);
  }, [rf]);

  // Selection lives in the store (single source of truth); everything else (drag positions,
  // measured sizes) is applied to local node state.
  const onNodesChange = useCallback(
    (changes: NodeChange<AmNode>[]) => {
      const sel = changes.filter((c): c is NodeSelectionChange => c.type === 'select');
      const rest = changes.filter((c) => c.type !== 'select');
      if (rest.length) setNodes((ns) => applyNodeChanges(rest, ns));
      if (!sel.length) return;
      const s = useEditor.getState();
      const same = s.selection.viewId === viewId;
      const cur = new Set(same ? s.selection.nodes : []);
      for (const c of sel) {
        if (c.selected) cur.add(c.id);
        else cur.delete(c.id);
      }
      s.select({ viewId, nodes: [...cur], ...(same ? {} : { connections: [] }) });
    },
    [viewId],
  );

  // Edges are controlled from the store; apply React Flow's (de)selection changes there.
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const sel = changes.filter((c): c is EdgeSelectionChange => c.type === 'select');
      if (!sel.length) return;
      const s = useEditor.getState();
      const cur = new Set(s.selection.viewId === viewId ? s.selection.connections : []);
      for (const c of sel) {
        if (c.selected) cur.add(c.id);
        else cur.delete(c.id);
      }
      s.select({
        viewId,
        connections: [...cur],
        ...(s.selection.viewId !== viewId ? { nodes: [] } : {}),
      });
    },
    [viewId],
  );

  /** One command per drag (spec §6.3), including re-nesting and a nesting relationship. */
  const onNodeDragStop = useCallback(
    async (e: MouseEvent | TouchEvent, _node: Node, dragged: Node[]) => {
      const s = useEditor.getState();
      const model = s.model;
      const v = model?.views[viewId];
      if (!model || !v) return;
      const byId = new Map(v.nodes.map((n) => [n.id, n]));
      const draggedIds = new Set(dragged.filter((n) => n.type === 'am').map((n) => n.id));
      const exclude = C.withDescendants(v, draggedIds);
      // Only the top-most dragged nodes; their descendants follow.
      const tops = [...draggedIds].filter((id) => {
        let p = byId.get(id)?.parent;
        while (p !== undefined) {
          if (draggedIds.has(p)) return false;
          p = byId.get(p)?.parent;
        }
        return true;
      });
      const rects: C.NodeRect[] = [];
      const parentChanges: { id: Id; parent: Id | undefined }[] = [];
      for (const id of tops) {
        const n = byId.get(id);
        const internal = rf.getInternalNode(id);
        if (!n || !internal) continue;
        const abs = internal.internals.positionAbsolute;
        const rect = {
          id,
          x: Math.max(0, Math.round(abs.x)),
          y: Math.max(0, Math.round(abs.y)),
          w: n.w,
          h: n.h,
        };
        rects.push(rect);
        const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
        const target = containerAt(model, v, centre, exclude);
        if (target?.id !== n.parent) parentChanges.push({ id, parent: target?.id });
      }
      if (!rects.length) return;
      const moved = rects.some((r) => r.x !== byId.get(r.id)!.x || r.y !== byId.get(r.id)!.y);
      if (!moved && !parentChanges.length) return;
      const parts: Command[] = [C.moveResizeNodes(viewId, rects)];
      let created: string | undefined;
      for (const pc of parentChanges) {
        parts.push(C.reparent(viewId, [pc.id], pc.parent));
        const parentEl = elementOf(pc.parent ? byId.get(pc.parent) : undefined);
        const childEl = elementOf(byId.get(pc.id));
        // The relationship picker is offered for a single dropped node only.
        if (!parentEl || !childEl || parentChanges.length !== 1) continue;
        const pt = 'clientX' in e ? e : (e.changedTouches[0] ?? { clientX: 0, clientY: 0 });
        const relType = await chooseNesting(parentEl, childEl, { x: pt.clientX, y: pt.clientY });
        if (relType) {
          parts.push(C.addRelation({ type: relType, source: parentEl, target: childEl }).cmd);
          created = relType;
        }
      }
      const label = parentChanges.length
        ? parentChanges.some((p) => p.parent)
          ? 'Nest'
          : 'Un-nest'
        : 'Move';
      s.dispatch(parts.length === 1 ? parts[0]! : C.compound(label, parts));
      if (created) undoToast(`Created ${relationTypeLabel(created)} relationship`);
    },
    [viewId, rf],
  );

  // ---- connection drawing from a node's border band ----
  const finishLink = useCallback(
    async (sourceId: Id, x: number, y: number) => {
      const s = useEditor.getState();
      const model = s.model;
      const v = model?.views[viewId];
      if (!model || !v) return;
      let targetId: Id | undefined;
      for (const el of document.elementsFromPoint(x, y)) {
        const edge = el.closest('[data-conn-id]');
        if (edge) {
          targetId = edge.getAttribute('data-conn-id') ?? undefined;
          break;
        }
        const node = el.closest('.react-flow__node');
        if (node && !node.classList.contains('react-flow__node-anchor')) {
          targetId = node.getAttribute('data-id') ?? undefined;
          break;
        }
      }
      if (!targetId) return;
      const srcNode = v.nodes.find((n) => n.id === sourceId);
      const tgtNode = v.nodes.find((n) => n.id === targetId);
      const tgtConn = v.connections.find((c) => c.id === targetId);
      if (!srcNode || (!tgtNode && !tgtConn)) return;
      const sourceConcept = elementOf(srcNode);
      const targetConcept = tgtNode ? elementOf(tgtNode) : tgtConn?.relationshipRef;
      if (!sourceConcept || !targetConcept) {
        // Notes, containers or plain lines: a visual connector with no model relationship.
        s.dispatch(C.addConnection(viewId, { source: sourceId, target: targetId }).cmd);
        return;
      }
      const type = await chooseRelationship(model, sourceConcept, targetConcept, { x, y });
      if (!type) return;
      const { cmd, connectionId } = C.addRelationWithConnection(
        viewId,
        { type, source: sourceConcept, target: targetConcept },
        { source: sourceId, target: targetId },
      );
      s.dispatch(cmd);
      s.select({ viewId, nodes: [], connections: [connectionId] });
    },
    [viewId],
  );

  const startLink = useCallback(
    (sourceId: Id, e: React.PointerEvent) => {
      const box = wrapper.current?.getBoundingClientRect();
      if (!box) return;
      const from = { x: e.clientX - box.left, y: e.clientY - box.top };
      setLink({ from, to: from });
      const move = (ev: PointerEvent) =>
        setLink((l) =>
          l ? { ...l, to: { x: ev.clientX - box.left, y: ev.clientY - box.top } } : l,
        );
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        setLink(null);
        void finishLink(sourceId, ev.clientX, ev.clientY);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [finishLink],
  );

  const ctx = useMemo<CanvasContextValue>(
    () => ({
      viewId,
      startLink,
      minSizeFor: (nodeId) => {
        const v = useEditor.getState().model?.views[viewId];
        const n = v?.nodes.find((x) => x.id === nodeId);
        if (!v || !n) return { w: 10, h: 10 };
        // A parent is never resized smaller than its children (§9.4).
        let w = 20;
        let h = 15;
        for (const c of v.nodes) {
          if (c.parent !== nodeId) continue;
          w = Math.max(w, c.x + c.w - n.x + 4);
          h = Math.max(h, c.y + c.h - n.y + 4);
        }
        return { w, h };
      },
      commitResize: (nodeId, p) => {
        const s = useEditor.getState();
        const v = s.model?.views[viewId];
        const n = v?.nodes.find((x) => x.id === nodeId);
        if (!v || !n) return;
        const parent = n.parent !== undefined ? v.nodes.find((x) => x.id === n.parent) : undefined;
        const x = Math.max(0, Math.round(p.x + (parent?.x ?? 0)));
        const y = Math.max(0, Math.round(p.y + (parent?.y ?? 0)));
        const w = Math.round(p.width);
        const h = Math.round(p.height);
        if (x === n.x && y === n.y && w === n.w && h === n.h) return;
        // Children keep their absolute positions while the parent is resized.
        const keep = v.nodes
          .filter((c) => c.parent === nodeId)
          .map((c) => ({ id: c.id, x: c.x, y: c.y, w: c.w, h: c.h }));
        s.dispatch(C.moveResizeNodes(viewId, [{ id: nodeId, x, y, w, h }, ...keep], 'Resize'));
      },
    }),
    [viewId, startLink],
  );

  // ---- drops from the palette and the model tree ----
  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes(DND_TYPE) || e.dataTransfer.types.includes(DND_REF)) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDrop = (e: DragEvent) => {
    const type = e.dataTransfer.getData(DND_TYPE);
    const ref = e.dataTransfer.getData(DND_REF);
    if (!type && !ref) return;
    e.preventDefault();
    e.stopPropagation();
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    void dropAt(viewId, p, type ? { type } : { ref }, { x: e.clientX, y: e.clientY });
  };

  return (
    <CanvasContext.Provider value={ctx}>
      <div
        ref={wrapper}
        className={styles.canvas}
        data-testid="canvas"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <svg className={styles.defs} aria-hidden="true">
          <MarkerDefs />
        </svg>
        <ReactFlow<AmNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={(_e, n) =>
            n.type === 'am' && useEditor.getState().setEditing({ viewId, kind: 'node', id: n.id })
          }
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          selectionKeyCode="Shift"
          multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
          disableKeyboardA11y
          onlyRenderVisibleElements
          fitView={fitOnOpen}
          fitViewOptions={{ maxZoom: 1, padding: 0.1 }}
          minZoom={0.05}
          maxZoom={4}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
          {minimap && <MiniMap pannable zoomable />}
        </ReactFlow>
        {link && (
          <svg className={styles.linkLayer} aria-hidden="true">
            <line x1={link.from.x} y1={link.from.y} x2={link.to.x} y2={link.to.y} />
          </svg>
        )}
      </div>
    </CanvasContext.Provider>
  );
}

/**
 * Adds a node at flow point `p`: a new element from the palette (`type`) or an existing model
 * element from the tree (`ref`, no duplicate element). Dropping inside a node nests it (§9.4).
 */
export async function dropAt(
  viewId: Id,
  p: Point,
  what: { type: string } | { ref: Id },
  screen: Point,
): Promise<void> {
  const s = useEditor.getState();
  const model = s.model;
  const v = model?.views[viewId];
  if (!model || !v) return;
  const type = 'type' in what ? what.type : model.elements[what.ref]?.type;
  if (!type) return;
  const def = elementDef(type);
  const [w, h] = def?.defaultSize ?? [120, 55];
  const x = Math.max(0, Math.round(p.x - w / 2));
  const y = Math.max(0, Math.round(p.y - h / 2));
  const parent = containerAt(model, v, p, new Set());
  const parentEl = elementOf(parent);
  const rect = { x, y, w, h, ...(parent ? { parent: parent.id } : {}) };
  const nesting = parentEl
    ? await chooseNesting(parentEl, 'type' in what ? { type } : what.ref, screen)
    : undefined;
  if ('type' in what) {
    const { cmd, nodeId } = C.addElementWithNode(
      viewId,
      { type, name: def?.label ?? type },
      rect,
      nesting && parentEl ? { type: nesting, parentElement: parentEl } : undefined,
    );
    s.dispatch(cmd);
    s.select({ viewId, nodes: [nodeId], connections: [] });
    s.setEditing({ viewId, kind: 'node', id: nodeId });
  } else {
    const add = C.addViewNode(viewId, { kind: 'element', elementRef: what.ref, ...rect });
    const parts = [add.cmd];
    if (nesting && parentEl) {
      parts.push(C.addRelation({ type: nesting, source: parentEl, target: what.ref }).cmd);
    }
    s.dispatch(parts.length === 1 ? add.cmd : C.compound('Add to view', parts));
    s.select({ viewId, nodes: [add.id], connections: [] });
  }
  if (nesting) undoToast(`Created ${relationTypeLabel(nesting)} relationship`);
}

export function Canvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
