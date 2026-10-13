import { useInternalNode, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { text } from '../../core/model/langstring';
import { useEditor, viewOf } from '../../core/store/store';
import { isJunction } from '../../notation/archimate/catalog';
import { isRelationValid } from '../../notation/archimate/validation';
import { EdgeFigure } from '../figures/EdgeFigure';
import { connectionPoints, pointsToPath, type End } from '../figures/geometry';
import type { AmEdge, AmEdgeData } from './adapter';

/**
 * Floating edge (spec §8.6): ends follow live node positions (so they track drags), attach on
 * the node outline, and respect bendpoints.
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
  const src = useInternalNode(props.source);
  const tgt = useInternalNode(props.target);
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
  const pts = connectionPoints(
    end(src, sourceJunction, conn.sourceAttachment),
    end(tgt, targetJunction, conn.targetAttachment),
    conn.bendpoints,
  );
  const label =
    conn.label && Object.keys(conn.label).length ? text(conn.label, lang) : text(rel?.name, lang);

  return (
    <g className="am-edge" data-testid={`edge-${connId}`}>
      <path
        d={pointsToPath(pts)}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        className="react-flow__edge-interaction"
      />
      <EdgeFigure
        points={pts}
        relType={conn.kind === 'relationship' ? rel?.type : undefined}
        accessType={rel?.accessType}
        isDirected={rel?.isDirected}
        modifier={rel?.modifier}
        label={label}
        style={conn.style}
        selected={props.selected}
        invalid={invalid}
      />
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
