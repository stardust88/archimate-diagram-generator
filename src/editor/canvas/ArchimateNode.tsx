import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { text } from '../../core/model/langstring';
import { useEditor, viewOf } from '../../core/store/store';
import { isUnknownType, xsiFromType } from '../../notation/archimate/exchange/mapping';
import { NodeFigure } from '../figures/NodeFigure';
import type { AmNode, AmNodeData } from './adapter';
import { offViewpointWarning } from './viewpointCheck';

const hidden = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 };

/** React Flow node: reads its own data from the store so unrelated changes don't re-render it. */
export const ArchimateNode = memo(function ArchimateNode(props: NodeProps<AmNode>) {
  const { nodeId, viewId } = props.data as AmNodeData;
  const node = useEditor((s) => viewOf(s, viewId)?.nodes.get(nodeId));
  const element = useEditor((s) =>
    node?.kind === 'element' ? s.model?.elements[node.elementRef] : undefined,
  );
  const lang = useEditor((s) => s.model?.primaryLang ?? '');
  const viewpoint = useEditor((s) => s.model?.views[viewId]?.viewpoint);
  const hasChildren = useEditor((s) => viewOf(s, viewId)?.children.has(nodeId) ?? false);
  if (!node) return null;
  const name =
    node.label && Object.keys(node.label).length
      ? text(node.label, lang)
      : element
        ? text(element.name, lang)
        : '';
  const type = element?.type;
  return (
    <>
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

export const AnchorNode = memo(function AnchorNode() {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} style={hidden} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={hidden} />
    </>
  );
});
