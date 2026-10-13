import type { ModelWarning } from '../../core/model/references';
import { useEditor } from '../../core/store/store';
import { highlightInView } from './ModelTree';
import styles from './Panels.module.css';

interface Props {
  title: string;
  warnings: ModelWarning[];
  onClose: () => void;
}

/** Dismissible list of import warnings or validation issues (US-1, §10). */
export function WarningsPanel({ title, warnings, onClose }: Props) {
  return (
    <section className={styles.warnings} aria-label={title}>
      <div className={styles.popoverHead}>
        <strong>
          {title} ({warnings.length})
        </strong>
        <button type="button" onClick={onClose} aria-label={`Close ${title}`}>
          ×
        </button>
      </div>
      <ul>
        {warnings.map((w, i) => (
          <li key={i}>
            {w.viewId || (w.id && useEditor.getState().model?.elements[w.id]) ? (
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  const s = useEditor.getState();
                  if (w.viewId) {
                    s.openView(w.viewId);
                    if (w.id) s.select({ viewId: w.viewId, nodes: [w.id], connections: [w.id] });
                  } else if (w.id) {
                    s.selectInTree(w.id);
                    if (s.activeView) highlightInView(s.activeView, w.id);
                  }
                }}
              >
                {w.message}
              </button>
            ) : (
              w.message
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
