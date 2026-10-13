// Model tree (spec §9.3). Virtualized: the expanded tree is flattened into rows and only the
// rows in the scroll window are rendered, so 5,000-element models open quickly (§12).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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

const ROW = 22;
const OVERSCAN = 12;

interface Row {
  node: TreeNode;
  depth: number;
  expanded: boolean;
}

function flatten(nodes: TreeNode[], open: Set<string>, forceOpen: boolean): Row[] {
  const out: Row[] = [];
  const walk = (list: TreeNode[], depth: number) => {
    for (const n of list) {
      const expanded = n.kind === 'folder' && (forceOpen || open.has(n.key));
      out.push({ node: n, depth, expanded });
      if (expanded) walk(n.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return out;
}

export function ModelTree(props: TreeHandlers) {
  const model = useEditor((s) => s.model);
  const treeSelection = useEditor((s) => s.treeSelection);
  const tree = useMemo(() => (model ? buildTree(model) : []), [model]);
  const [filter, setFilter] = useState('');
  const [viewsFor, setViewsFor] = useState<string | null>(null);
  // Expanded folders by key; top-level folders start open.
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const open = useMemo(() => {
    const s = new Set(tree.map((n) => n.key));
    for (const k of toggled) {
      if (s.has(k)) s.delete(k);
      else s.add(k);
    }
    return s;
  }, [tree, toggled]);
  const toggle = (key: string) =>
    setToggled((t) => {
      const n = new Set(t);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

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

  const rows = useMemo(() => flatten(filtered, open, !!filter.trim()), [filtered, open, filter]);

  // Virtual window.
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(400);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [model]);
  const first = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW) + OVERSCAN);

  // Roving focus for keyboard navigation.
  const [focusIndex, setFocusIndex] = useState(0);
  const wantFocus = useRef(false);
  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    scroller.current?.querySelector<HTMLElement>(`[data-index="${focusIndex}"]`)?.focus();
  }, [focusIndex, first, last]);
  const moveFocus = (i: number) => {
    const idx = Math.max(0, Math.min(rows.length - 1, i));
    const el = scroller.current;
    if (el) {
      if (idx * ROW < el.scrollTop) el.scrollTop = idx * ROW;
      else if ((idx + 1) * ROW > el.scrollTop + el.clientHeight)
        el.scrollTop = (idx + 1) * ROW - el.clientHeight;
    }
    wantFocus.current = true;
    setFocusIndex(idx);
  };

  if (!model) return <p className={styles.muted}>No model open.</p>;
  const views = viewsFor ? viewsContaining(model, viewsFor) : [];
  const focus = Math.min(focusIndex, Math.max(0, rows.length - 1));

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
      <div
        ref={scroller}
        className={styles.treeScroll}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div
          role="tree"
          aria-label="Model tree"
          style={{ height: rows.length * ROW, position: 'relative' }}
        >
          {rows.slice(first, last).map((r, i) => {
            const index = first + i;
            return (
              <Item
                key={r.node.key}
                row={r}
                index={index}
                tabbable={index === focus}
                selected={r.node.id !== undefined && r.node.id === treeSelection}
                onToggle={toggle}
                onShowViews={setViewsFor}
                onMove={(d) => moveFocus(index + d)}
                onFocusRow={() => setFocusIndex(index)}
                {...props}
              />
            );
          })}
        </div>
      </div>
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
  row: Row;
  index: number;
  tabbable: boolean;
  selected: boolean;
  onToggle: (key: string) => void;
  onShowViews: (id: string) => void;
  onMove: (delta: number) => void;
  onFocusRow: () => void;
}

function Item({
  row,
  index,
  tabbable,
  selected,
  onToggle,
  onShowViews,
  onMove,
  onFocusRow,
  ...h
}: ItemProps) {
  const { node, depth, expanded } = row;
  const isFolder = node.kind === 'folder';

  const activate = () => {
    const s = useEditor.getState();
    if (isFolder) return onToggle(node.key);
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
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onMove(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onMove(-1);
    } else if (e.key === 'ArrowRight' && isFolder && !expanded) onToggle(node.key);
    else if (e.key === 'ArrowLeft' && isFolder && expanded) onToggle(node.key);
    else if (e.key === 'ContextMenu' && h.onContextMenu) {
      e.preventDefault();
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      h.onContextMenu(node, r.left + 20, r.bottom);
    }
  };

  const colors = node.kind === 'element' && node.type ? defaultColors(node.type) : null;
  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={isFolder ? expanded : undefined}
      aria-selected={selected}
      data-index={index}
      className={`${styles.row} ${selected ? styles.rowSelected : ''}`}
      style={{
        position: 'absolute',
        top: index * ROW,
        left: 0,
        right: 0,
        height: ROW,
        paddingLeft: 4 + depth * 12,
      }}
      tabIndex={tabbable ? 0 : -1}
      draggable={!isFolder && !!node.id}
      onFocus={onFocusRow}
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
      {colors ? (
        <span
          className={styles.swatch}
          style={{ background: colors.fill, borderColor: colors.stroke }}
          title={elementDef(node.type!)?.label ?? node.type}
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
      )}
      <span className={node.kind === 'missing' ? styles.missing : undefined}>{node.label}</span>
    </div>
  );
}
