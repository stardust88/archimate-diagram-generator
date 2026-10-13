import { useEffect, useState, type DragEvent } from 'react';
import { clearAutosave, createAutosaver, readAutosave } from '../core/persistence/autosave';
import { readDroppedFile } from '../core/persistence/files';
import { isDirty, useEditor } from '../core/store/store';
import * as A from '../editor/actions';
import { Canvas } from '../editor/canvas/Canvas';
import { Dialogs } from '../editor/dialogs/Dialogs';
import { choiceMenu, confirmDialog } from '../editor/dialogs/dialogApi';
import { WarningsPanel } from '../editor/panels/ImportWarnings';
import { ModelTree } from '../editor/panels/ModelTree';
import { Palette } from '../editor/panels/Palette';
import { Properties } from '../editor/panels/Properties';
import { Toasts } from '../editor/panels/Toasts';
import { treeHandlers } from '../editor/panels/treeActions';
import { ViewTabs } from '../editor/panels/ViewTabs';
import { useShortcuts } from '../editor/shortcuts';
import { Toolbar } from '../editor/toolbar/Toolbar';
import styles from './App.module.css';

/** Autosave every model change to IndexedDB, debounced 1 s (spec §11). */
function useAutosave() {
  useEffect(() => {
    const saver = createAutosaver();
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.model === prev.model && s.savedSeq === prev.savedSeq) return;
      if (s.model && isDirty(s)) saver.schedule(s.model, s.fileName);
      else saver.cancel();
    });
    const flush = () => void saver.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      unsub();
      window.removeEventListener('pagehide', flush);
      saver.cancel();
    };
  }, []);
}

/** Offer to restore autosaved work on startup (spec §11). */
function useRestoreOffer() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rec = await readAutosave();
      if (cancelled || !rec || useEditor.getState().model) return;
      const when = new Date(rec.savedAt).toLocaleString();
      const ok = await confirmDialog({
        title: 'Restore unsaved work?',
        message: `Restore unsaved work from ${when}${rec.fileName ? ` (${rec.fileName})` : ''}?`,
        confirmLabel: 'Restore',
      });
      if (ok) {
        useEditor.getState().load(rec.model, { fileName: rec.fileName });
        // Restored work is not saved to a file yet: mark it dirty.
        useEditor.setState({ savedSeq: -1 });
      } else await clearAutosave();
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

/** Warn before leaving with unsaved changes (US-5). */
function useBeforeUnload() {
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (isDirty(useEditor.getState())) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);
}

export function App() {
  const model = useEditor((s) => s.model);
  const activeView = useEditor((s) => s.activeView);
  const importWarnings = useEditor((s) => s.importWarnings);
  const warningsDismissed = useEditor((s) => s.warningsDismissed);
  const validation = useEditor((s) => s.validation);
  const error = useEditor((s) => s.error);
  const [minimap, setMinimap] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  useShortcuts();
  useAutosave();
  useRestoreOffer();
  useBeforeUnload();

  const onDrop = async (e: DragEvent) => {
    setDragOver(false);
    const file = Array.from(e.dataTransfer.files)[0];
    if (!file) return;
    e.preventDefault();
    if (isDirty(useEditor.getState())) {
      const ok = await confirmDialog({
        title: 'Discard unsaved changes?',
        message: `Open ${file.name} and discard the changes to the current model?`,
        confirmLabel: 'Discard',
        danger: true,
      });
      if (!ok) return;
    }
    A.loadFile(await readDroppedFile(file));
  };

  const onTabMenu = async (viewId: string, x: number, y: number) => {
    const c = await choiceMenu({
      title: 'View',
      at: { x, y },
      options: [
        { value: 'rename', label: 'Rename…' },
        { value: 'duplicate', label: 'Duplicate' },
        { value: 'delete', label: 'Delete view…' },
      ],
    });
    if (c === 'rename') await A.renameView(viewId);
    else if (c === 'duplicate') A.duplicateView(viewId);
    else if (c === 'delete') await A.deleteView(viewId);
  };

  const issues = validation?.length ?? 0;
  return (
    <div
      className={styles.app}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <Toolbar minimap={minimap} onToggleMinimap={() => setMinimap((m) => !m)} />

      <div role="alert">
        {error && (
          <div className={styles.error}>
            {error}
            <button
              type="button"
              onClick={() => useEditor.getState().setError(null)}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className={styles.body}>
        <aside className={styles.left}>
          <section className={`${styles.panel} ${styles.treePanel}`} aria-label="Model tree">
            <h2>Model</h2>
            <ModelTree {...treeHandlers} />
          </section>
          <section className={styles.panel} aria-label="Palette">
            <h2>Palette</h2>
            {activeView ? <Palette /> : <p className={styles.hint}>Open a view to add elements.</p>}
          </section>
        </aside>

        <main className={styles.center}>
          <nav className={styles.tabs} aria-label="Views">
            <ViewTabs onContextMenu={(id, x, y) => void onTabMenu(id, x, y)} />
          </nav>
          <div className={`${styles.canvas} ${dragOver ? styles.dragOver : ''}`}>
            {model && activeView ? (
              <Canvas key={activeView} viewId={activeView} minimap={minimap} />
            ) : (
              <div className={styles.empty}>
                {model ? (
                  <>
                    <p className={styles.hint}>Open a view from the model tree, or</p>
                    <button type="button" onClick={() => void A.addView()}>
                      Add a view
                    </button>
                  </>
                ) : (
                  <>
                    <div className={styles.emptyActions}>
                      <button
                        type="button"
                        className={styles.primary}
                        onClick={() => void A.newModel()}
                      >
                        New model
                      </button>
                      <button type="button" onClick={() => void A.openFile()}>
                        Open ArchiMate XML
                      </button>
                    </div>
                    <p className={styles.hint}>or drop an Exchange Format .xml file here</p>
                  </>
                )}
              </div>
            )}
          </div>
        </main>

        <aside className={`${styles.panel} ${styles.right}`} aria-label="Properties">
          <h2>Properties</h2>
          <Properties />
        </aside>
      </div>

      <footer className={styles.status}>
        <button
          type="button"
          className={styles.statusButton}
          onClick={() => useEditor.setState({ warningsDismissed: !warningsDismissed })}
        >
          {importWarnings.length} import warnings
        </button>
        <span aria-hidden="true"> · </span>
        <button
          type="button"
          className={styles.statusButton}
          onClick={A.validate}
          disabled={!model}
        >
          {validation === null
            ? 'Not validated'
            : `${issues} validation issue${issues === 1 ? '' : 's'}`}
        </button>
      </footer>
      {model && importWarnings.length > 0 && !warningsDismissed && (
        <WarningsPanel
          title="Import warnings"
          warnings={importWarnings}
          onClose={() => useEditor.getState().dismissWarnings()}
        />
      )}
      {model && validation && validation.length > 0 && (
        <WarningsPanel
          title="Validation issues"
          warnings={validation}
          onClose={() => useEditor.getState().setValidation(null)}
        />
      )}
      <Toasts />
      <Dialogs />
    </div>
  );
}
