import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useMemo, useState } from 'react';
import { useEditor } from '../../core/store/store';
import { MarkerDefs } from '../figures/Markers';
import { toFlow, type AmNode } from './adapter';
import { ArchimateEdge } from './ArchimateEdge';
import { AnchorNode, ArchimateNode } from './ArchimateNode';
import styles from './Canvas.module.css';
import { computeViewGeometry } from './viewGeometry';

const nodeTypes = { am: ArchimateNode, anchor: AnchorNode };
const edgeTypes = { am: ArchimateEdge };

interface Props {
  viewId: string;
  minimap: boolean;
}

function CanvasInner({ viewId, minimap }: Props) {
  const view = useEditor((s) => s.model?.views[viewId]);
  const elements = useEditor((s) => s.model?.elements);
  const relations = useEditor((s) => s.model?.relations);
  const model = useEditor((s) => s.model);
  const showNested = useEditor((s) => !!s.showNested[viewId]);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);

  const flow = useMemo(() => {
    if (!model || !view) return { nodes: [], edges: [] };
    return toFlow(model, view, computeViewGeometry(model, view, { showNested }));
    // Re-derive only when what the canvas shows changes, not on every model change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, elements, relations, showNested]);

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

  const onNodesChange = useCallback(
    (changes: NodeChange<AmNode>[]) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [],
  );

  const onSelectionChange = useCallback(
    ({ nodes: ns, edges: es }: OnSelectionChangeParams) => {
      const s = useEditor.getState().selection;
      const nodeIds = ns.filter((n) => n.type === 'am').map((n) => n.id);
      const connIds = es.map((e) => e.id);
      if (
        s.viewId === viewId &&
        s.nodes.join() === nodeIds.join() &&
        s.connections.join() === connIds.join()
      ) {
        return;
      }
      select({ viewId, nodes: nodeIds, connections: connIds });
    },
    [select, viewId],
  );

  return (
    <div className={styles.canvas} data-testid="canvas">
      <svg className={styles.defs} aria-hidden="true">
        <MarkerDefs />
      </svg>
      <ReactFlow<AmNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onSelectionChange={onSelectionChange}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onlyRenderVisibleElements
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.1 }}
        minZoom={0.05}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
        {minimap && <MiniMap pannable zoomable />}
      </ReactFlow>
    </div>
  );
}

export function Canvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
