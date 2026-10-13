import { Handle, NodeResizeControl, Position, type NodeProps } from '@xyflow/react';
import { memo, useEffect, useRef } from 'react';
import { text } from '../../core/model/langstring';
import { useEditor, viewOf } from '../../core/store/store';
import { isJunction } from '../../notation/archimate/catalog';
import { isUnknownType, xsiFromType } from '../../notation/archimate/exchange/mapping';
import { commitRename } from '../actions';
import { NodeFigure } from '../figures/NodeFigure';
import type { AmNode, AmNodeData } from './adapter';
import { useCanvas } from './canvasContext';
import styles from './Canvas.module.css';
import { offViewpointWarning } from './viewpointCheck';

const hidden = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 };
const BANDS = ['top', 'right', 'bottom', 'left'] as const;
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

/** React Flow node: reads its own data from the store so unrelated changes don't re-render it. */
export const ArchimateNode = memo(function ArchimateNode(props: NodeProps<AmNode>) {
  const { nodeId, viewId } = props.data as AmNodeData;
  const canvas = useCanvas();
  const node = useEditor((s) => viewOf(s, viewId)?.nodes.get(nodeId));
  const element = useEditor((s) =>
    node?.kind === 'element' ? s.model?.elements[node.elementRef] : undefined,
  );
  const lang = useEditor((s) => s.model?.primaryLang ?? '');
  const viewpoint = useEditor((s) => s.model?.views[viewId]?.viewpoint);
  const hasChildren = useEditor((s) => viewOf(s, viewId)?.children.has(nodeId) ?? false);
  const editing = useEditor(
    (s) => s.editing?.kind === 'node' && s.editing.id === nodeId && s.editing.viewId === viewId,
  );
  if (!node) return null;
  const hasLabel = !!node.label && Object.keys(node.label).length > 0;
  const name = hasLabel ? text(node.label, lang) : element ? text(element.name, lang) : '';
  const type = element?.type;
  const junction = isJunction(type ?? '');
  const min = props.selected && !junction ? canvas.minSizeFor(nodeId) : { w: 10, h: 10 };
  return (
    <>
      {/* Corner handles only: the edges are connect bands (drag from the border to connect). */}
      {props.selected &&
        !junction &&
        !editing &&
        CORNERS.map((pos) => (
          <NodeResizeControl
            key={pos}
            position={pos}
            minWidth={min.w}
            minHeight={min.h}
            className={styles.resizeHandle}
            onResizeEnd={(_e, p) => canvas.commitResize(nodeId, p)}
          />
        ))}
      <NodeFigure
        kind={node.kind}
        type={type}
        name={name}
        w={node.w}
        h={node.h}
        style={node.style}
        selected={props.selected}
        hasChildren={hasChildren}
        warning={type ? offViewpointWarning(viewpoint, type) : undefined}
        unknownType={type && isUnknownType(type) ? xsiFromType(type) : undefined}
      />
      {!editing &&
        BANDS.map((side) => (
          <div
            key={side}
            className={`nodrag nopan ${styles.band} ${styles[`band_${side}`]}`}
            title="Drag to connect"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              canvas.startLink(nodeId, e);
            }}
          />
        ))}
      {editing && (
        <InlineEditor
          initial={name}
          onDone={(v) =>
            v === null
              ? useEditor.getState().setEditing(null)
              : commitRename(viewId, 'node', nodeId, v)
          }
        />
      )}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        style={{ ...hidden, top: '50%', left: '50%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={{ ...hidden, top: '50%', left: '50%' }}
      />
    </>
  );
});

export function InlineEditor({
  initial,
  onDone,
}: {
  initial: string;
  onDone: (value: string | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <textarea
      ref={ref}
      className={`nodrag nopan nowheel ${styles.inlineEditor}`}
      aria-label="Edit name on canvas"
      defaultValue={initial}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          finish(e.currentTarget.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(null);
        }
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
    />
  );
}

export const AnchorNode = memo(function AnchorNode() {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} style={hidden} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={hidden} />
    </>
  );
});
