import { useMemo, useState } from 'react';
import { useEditor } from '../../core/store/store';
import { ELEMENT_TYPES, LAYERS, type ElementTypeDef } from '../../notation/archimate/catalog';
import { allowedElementTypes } from '../../notation/archimate/viewpoints';
import { canvasApi } from '../actions';
import { DND_TYPE, dropAt } from '../canvas/Canvas';
import { NodeFigure } from '../figures/NodeFigure';
import styles from './Palette.module.css';

/** Element palette (spec §9.2): by layer, searchable, filtered by the active view's viewpoint. */
export function Palette() {
  const activeView = useEditor((s) => s.activeView);
  const viewpoint = useEditor((s) =>
    s.activeView ? s.model?.views[s.activeView]?.viewpoint : undefined,
  );
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const allowed = allowedElementTypes(viewpoint);
    const query = q.trim().toLowerCase();
    return LAYERS.map(({ layer, label }) => ({
      layer,
      label,
      items: ELEMENT_TYPES.filter(
        (d) =>
          d.layer === layer &&
          (!allowed || allowed.has(d.type)) &&
          (!query || d.label.toLowerCase().includes(query) || d.type.toLowerCase().includes(query)),
      ),
    })).filter((g) => g.items.length > 0);
  }, [viewpoint, q]);

  const addAtCentre = (d: ElementTypeDef) => {
    const api = canvasApi();
    if (!activeView || !api) return;
    void dropAt(
      activeView,
      api.center(),
      { type: d.type },
      { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    );
  };

  return (
    <div className={styles.palette}>
      <input
        className={styles.search}
        type="search"
        placeholder="Search elements…"
        aria-label="Search palette"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {viewpoint && <p className={styles.viewpoint}>Viewpoint: {viewpoint}</p>}
      {groups.map((g) => {
        const open = q !== '' || !collapsed.has(g.layer);
        return (
          <section key={g.layer} aria-label={g.label}>
            <button
              type="button"
              className={styles.groupHead}
              aria-expanded={open}
              onClick={() =>
                setCollapsed((c) => {
                  const n = new Set(c);
                  if (n.has(g.layer)) n.delete(g.layer);
                  else n.add(g.layer);
                  return n;
                })
              }
            >
              {open ? '▾' : '▸'} {g.label}
            </button>
            {open && (
              <div className={styles.items} role="list">
                {g.items.map((d) => (
                  <div
                    key={d.type}
                    role="listitem"
                    tabIndex={0}
                    className={styles.item}
                    title={`${d.label}: drag onto the view (Enter adds it at the centre)`}
                    aria-label={d.label}
                    data-type={d.type}
                    draggable={!!activeView}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DND_TYPE, d.type);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        addAtCentre(d);
                      }
                    }}
                  >
                    <svg width={36} height={22} aria-hidden="true">
                      <NodeFigure
                        kind="element"
                        type={d.type}
                        name=""
                        w={d.aspect === 'connector' ? 14 : 36}
                        h={d.aspect === 'connector' ? 14 : 22}
                      />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
