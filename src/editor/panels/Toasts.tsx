import { useEditor } from '../../core/store/store';
import styles from './Panels.module.css';

export function Toasts() {
  const toasts = useEditor((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className={styles.toasts} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast}>
          <span>{t.message}</span>
          {t.undoable && (
            <button
              type="button"
              onClick={() => {
                useEditor.getState().undo();
                useEditor.getState().dropToast(t.id);
              }}
            >
              Undo
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => useEditor.getState().dropToast(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
