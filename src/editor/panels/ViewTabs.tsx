import { text } from '../../core/model/langstring';
import { useEditor } from '../../core/store/store';
import styles from './Panels.module.css';

export function ViewTabs({
  onContextMenu,
}: {
  onContextMenu?: (viewId: string, x: number, y: number) => void;
}) {
  const model = useEditor((s) => s.model);
  const openViews = useEditor((s) => s.openViews);
  const active = useEditor((s) => s.activeView);
  const openView = useEditor((s) => s.openView);
  const closeView = useEditor((s) => s.closeView);
  if (!model) return null;
  return (
    <div className={styles.tabs} role="tablist" aria-label="Open views">
      {openViews.map((id) => {
        const v = model.views[id];
        if (!v) return null;
        const name = text(v.name, model.primaryLang) || 'View';
        return (
          <div
            key={id}
            role="tab"
            aria-selected={id === active}
            className={`${styles.tab} ${id === active ? styles.tabActive : ''}`}
            onContextMenu={(e) => {
              if (!onContextMenu) return;
              e.preventDefault();
              onContextMenu(id, e.clientX, e.clientY);
            }}
          >
            <button
              type="button"
              className={styles.tabButton}
              onClick={() => openView(id)}
              title={name}
            >
              {name}
            </button>
            <button
              type="button"
              className={styles.tabClose}
              aria-label={`Close ${name}`}
              onClick={() => closeView(id)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
