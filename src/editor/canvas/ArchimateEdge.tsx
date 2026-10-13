import { EdgeLabelRenderer, useInternalNode, useReactFlow, type EdgeProps } from '@xyflow/react';
import { memo, useRef, useState } from 'react';
import { setBendpoints } from '../../core/commands/model-commands';
import { text } from '../../core/model/langstring';
import type { Point } from '../../core/model/types';
import { useEditor, viewOf } from '../../core/store/store';
import { isJunction } from '../../notation/archimate/catalog';
import { isRelationValid } from '../../notation/archimate/validation';
import { commitRename } from '../actions';
import { EdgeFigure } from '../figures/EdgeFigure';
import {
  connectionPoints,
  distanceToSegment,
  pointsToPath,
  polylineMidpoint,
  type End,
} from '../figures/geometry';
import type { AmEdge, AmEdgeData } from './adapter';
import { InlineEditor } from './ArchimateNode';
import styles from './Canvas.module.css';

/**
 * Floating edge (spec §8.6): ends follow live node positions (so they track drags), attach on
 * the node outline, and respect bendpoints. When selected: drag the line to add a bendpoint,
 * drag a handle to move it, double-click a handle to remove it (US-3).
 */
export const ArchimateEdge = memo(function ArchimateEdge(props: EdgeProps<AmEdge>) {
  const { connId, viewId } = props.data as AmEdgeData;
  const conn = useEditor((s) => viewOf(s, viewId)?.connections.get(connId));
  const rel = useEditor((s) =>
    conn?.relationshipRef ? s.model?.relations[conn.relationshipRef] : undefined,
  );
  const lang = useEditor((s) => s.model?.primaryLang ?? '');
  const invalid = useEditor((s) => (s.model && rel ? !isRelationValid(s.model, rel) : false));
  const sourceJunction = useEditor((s) => endIsJunction(s, viewId, conn?.source));
  const targetJunction = useEditor((s) => endIsJunction(s, viewId, conn?.target));
  const editing = useEditor(
    (s) =>
      s.editing?.kind === 'connection' && s.editing.id === connId && s.editing.viewId === viewId,
  );
  const src = useInternalNode(props.source);
  const tgt = useInternalNode(props.target);
  const { screenToFlowPosition } = useReactFlow();
  const [override, setOverride] = useState<Point[] | null>(null);
  const drag = useRef<{ index: number; pts: Point[]; moved: boolean } | null>(null);
  if (!conn || !src || !tgt) return null;

  const end = (n: typeof src, junction: boolean, attachment: End['attachment']): End => {
    const anchor = n.type === 'anchor';
    return {
      rect: {
        x: n.internals.positionAbsolute.x,
        y: n.internals.positionAbsolute.y,
        w: anchor ? 0 : (n.measured.width ?? n.width ?? 0),
        h: anchor ? 0 : (n.measured.height ?? n.height ?? 0),
      },
      shape: anchor ? 'point' : junction ? 'circle' : 'rect',
      attachment,
    };
  };
  const bendpoints = override ?? conn.bendpoints;
  const pts = connectionPoints(
    end(src, sourceJunction, conn.sourceAttachment),
    end(tgt, targetJunction, conn.targetAttachment),
    bendpoints,
  );
  const hasOwnLabel = !!conn.label && Object.keys(conn.label).length > 0;
  const label = hasOwnLabel ? text(conn.label, lang) : text(rel?.name, lang);

  const toFlow = (e: React.PointerEvent) => screenToFlowPosition({ x: e.clientX, y: e.clientY });

  const beginDrag = (e: React.PointerEvent, index: number, next: Point[]) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    // A new bendpoint counts as a change; grabbing an existing one only if it moves.
    drag.current = { index, pts: next, moved: next.length !== bendpoints.length };
    setOverride(next);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toFlow(e);
    const next = d.pts.slice();
    next[d.index] = { x: Math.round(p.x), y: Math.round(p.y) };
    d.pts = next;
    d.moved = true;
    setOverride(next);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setOverride(null);
    if (!d?.moved) return;
    const s = useEditor.getState();
    s.dispatch(setBendpoints(viewId, connId, d.pts));
    // Keep the edge selected so its handles stay available after the drag.
    s.select({ viewId, nodes: [], connections: [connId] });
  };

  /** Pointer down on the line of a selected edge: insert a bendpoint on that segment. */
  const onLineDown = (e: React.PointerEvent) => {
    if (!props.selected || e.button !== 0) return;
    const p = toFlow(e);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i + 1 < pts.length; i++) {
      const dd = distanceToSegment(p, pts[i]!, pts[i + 1]!);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    const next = bendpoints.slice();
    next.splice(best, 0, { x: Math.round(p.x), y: Math.round(p.y) });
    beginDrag(e, best, next);
  };

  const mid = polylineMidpoint(pts);
  return (
    <g className="am-edge" data-testid={`edge-${connId}`} data-conn-id={connId}>
      <path
        d={pointsToPath(pts)}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        className={`react-flow__edge-interaction ${props.selected ? 'nopan' : ''}`}
        style={{ cursor: props.selected ? 'copy' : 'pointer' }}
        onPointerDown={onLineDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onDoubleClick={(e) => {
          e.stopPropagation();
          useEditor.getState().setEditing({ viewId, kind: 'connection', id: connId });
        }}
      />
      {/* Visual only: pointer events go to the wide interaction path underneath. */}
      <g pointerEvents="none">
        <EdgeFigure
          points={pts}
          relType={conn.kind === 'relationship' ? rel?.type : undefined}
          accessType={rel?.accessType}
          isDirected={rel?.isDirected}
          modifier={rel?.modifier}
          label={editing ? undefined : label}
          style={conn.style}
          selected={props.selected}
          invalid={invalid}
        />
      </g>
      {props.selected &&
        bendpoints.map((b, i) => (
          <rect
            key={i}
            className={`nopan ${styles.bendpoint}`}
            data-testid={`bendpoint-${i}`}
            x={b.x - 4}
            y={b.y - 4}
            width={8}
            height={8}
            onPointerDown={(e) => e.button === 0 && beginDrag(e, i, bendpoints.slice())}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onDoubleClick={(e) => {
              e.stopPropagation();
              const next = bendpoints.filter((_, j) => j !== i);
              useEditor.getState().dispatch(setBendpoints(viewId, connId, next));
            }}
          />
        ))}
      {editing && (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan ${styles.edgeEditor}`}
            style={{ transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)` }}
          >
            <InlineEditor
              initial={label}
              onDone={(v) =>
                v === null
                  ? useEditor.getState().setEditing(null)
                  : commitRename(viewId, 'connection', connId, v)
              }
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});

function endIsJunction(
  s: ReturnType<typeof useEditor.getState>,
  viewId: string,
  id: string | undefined,
): boolean {
  if (!id || !s.model) return false;
  const n = viewOf(s, viewId)?.nodes.get(id);
  if (!n || n.kind !== 'element') return false;
  return isJunction(s.model.elements[n.elementRef]?.type ?? '');
}
