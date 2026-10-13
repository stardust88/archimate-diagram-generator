import { memo, useMemo, useState, type KeyboardEvent } from 'react';
import { useEditor } from '../../core/store/store';
import { elementDef } from '../../notation/archimate/catalog';
import { defaultColors } from '../../notation/archimate/colors';
import { buildTree, viewsContaining, type TreeNode } from './treeModel';
import styles from './Panels.module.css';

export interface TreeHandlers {
  onContextMenu?: (node: TreeNode, x: number, y: number) => void;
  onDragStart?: (node: TreeNode, e: React.DragEvent) => void;
  onDropOnFolder?: (folder: TreeNode, e: React.DragEvent) => void;
}

export function ModelTree(props: TreeHandlers) {
  const model = useEditor((s) => s.model);
  const tree = useMemo(() => (model ? buildTree(model) : []), [model]);
  const [filter, setFilter] = useState('');
  const [viewsFor, setViewsFor] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tree;
    const keep = (n: TreeNode): TreeNode | null => {
      const children = n.children.map(keep).filter((c): c is TreeNode => c !== null);
      if (n.label.toLowerCase().includes(q) || children.length) return { ...n, children };
      return null;
    };
    return tree.map(keep).filter((c): c is TreeNode => c !== null);
  }, [tree, filter]);

  if (!model) return <p className={styles.muted}>No model open.</p>;
  const views = viewsFor ? viewsContaining(model, viewsFor) : [];
  return (
    <div className={styles.tree}>
      <input
        className={styles.search}
        type="search"
        placeholder="Filter model…"
        aria-label="Filter model tree"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul role="tree" aria-label="Model tree" className={styles.treeList}>
        {filtered.map((n) => (
          <Item
            key={n.key}
            node={n}
            depth={0}
            forceOpen={!!filter}
            onShowViews={setViewsFor}
            {...props}
          />
        ))}
      </ul>
      {viewsFor && (
        <div className={styles.popover} role="dialog" aria-label="Views containing this element">
          <div className={styles.popoverHead}>
            <strong>Views containing it</strong>
            <button type="button" onClick={() => setViewsFor(null)} aria-label="Close">
              ×
            </button>
          </div>
          {views.length === 0 ? (
            <p className={styles.muted}>Not in any view.</p>
          ) : (
            <ul>
              {views.map((vid) => (
                <li key={vid}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => {
                      useEditor.getState().openView(vid);
                      highlightInView(vid, viewsFor);
                      setViewsFor(null);
                    }}
                  >
                    {Object.values(model.views[vid]!.name)[0] ?? vid}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Selects the nodes for element `id` in view `viewId` (US-2). */
export function highlightInView(viewId: string, id: string): void {
  const s = useEditor.getState();
  const v = s.model?.views[viewId];
  if (!v) return;
  const nodes = v.nodes.filter((n) => n.kind === 'element' && n.elementRef === id).map((n) => n.id);
  const connections = v.connections.filter((c) => c.relationshipRef === id).map((c) => c.id);
  s.select({ viewId, nodes, connections });
}

interface ItemProps extends TreeHandlers {
  node: TreeNode;
  depth: number;
  forceOpen: boolean;
  onShowViews: (id: string) => void;
}

const Item = memo(function Item({ node, depth, forceOpen, onShowViews, ...h }: ItemProps) {
  const [open, setOpen] = useState(depth === 0);
  const selected = useEditor((s) => node.id !== undefined && s.treeSelection === node.id);
  const isFolder = node.kind === 'folder';
  const expanded = forceOpen || open;

  const activate = () => {
    const s = useEditor.getState();
    if (isFolder) return setOpen(!open);
    if (!node.id) return;
    s.selectInTree(node.id);
    if (node.kind === 'view') return;
    if (s.activeView) highlightInView(s.activeView, node.id);
  };
  const onDouble = () => {
    if (!node.id) return;
    if (node.kind === 'view') useEditor.getState().openView(node.id);
    else if (node.kind === 'element') onShowViews(node.id);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (node.kind === 'view' || node.kind === 'element') onDouble();
      else activate();
    } else if (e.key === ' ') {
      e.preventDefault();
      activate();
    } else if (e.key === 'ArrowRight' && isFolder) setOpen(true);
    else if (e.key === 'ArrowLeft' && isFolder) setOpen(false);
  };

  const swatch =
    node.kind === 'element' && node.type ? (
      <span
        className={styles.swatch}
        style={{
          background: defaultColors(node.type).fill,
          borderColor: defaultColors(node.type).stroke,
        }}
        title={elementDef(node.type)?.label ?? node.type}
      />
    ) : (
      <span className={styles.kind}>
        {isFolder
          ? expanded
            ? '▾'
            : '▸'
          : node.kind === 'view'
            ? '▦'
            : node.kind === 'relation'
              ? '↗'
              : '?'}
      </span>
    );

  return (
    <li role="treeitem" aria-expanded={isFolder ? expanded : undefined} aria-selected={selected}>
      <div
        className={`${styles.row} ${selected ? styles.rowSelected : ''}`}
        style={{ paddingLeft: 4 + depth * 12 }}
        tabIndex={0}
        draggable={!isFolder && !!node.id}
        onClick={activate}
        onDoubleClick={onDouble}
        onKeyDown={onKey}
        onContextMenu={(e) => {
          if (!h.onContextMenu) return;
          e.preventDefault();
          h.onContextMenu(node, e.clientX, e.clientY);
        }}
        onDragStart={(e) => h.onDragStart?.(node, e)}
        onDragOver={(e) => {
          if (isFolder && h.onDropOnFolder) e.preventDefault();
        }}
        onDrop={(e) => {
          if (isFolder && h.onDropOnFolder) {
            e.preventDefault();
            h.onDropOnFolder(node, e);
          }
        }}
        title={node.label}
      >
        {swatch}
        <span className={node.kind === 'missing' ? styles.missing : undefined}>{node.label}</span>
      </div>
      {isFolder && expanded && node.children.length > 0 && (
        <ul role="group">
          {node.children.map((c) => (
            <Item
              key={c.key}
              node={c}
              depth={depth + 1}
              forceOpen={forceOpen}
              onShowViews={onShowViews}
              {...h}
            />
          ))}
        </ul>
      )}
    </li>
  );
});
