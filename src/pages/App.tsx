import { useCallback, useState, type DragEvent } from 'react';
import { text } from '../core/model/langstring';
import { pickFile, readDroppedFile, type OpenedFile } from '../core/persistence/files';
import { useEditor } from '../core/store/store';
import { Canvas } from '../editor/canvas/Canvas';
import { WarningsPanel } from '../editor/panels/ImportWarnings';
import { ModelTree } from '../editor/panels/ModelTree';
import { ViewTabs } from '../editor/panels/ViewTabs';
import { ImportError, importModel } from '../notation/archimate/exchange/import';
import styles from './App.module.css';

export function App() {
  const model = useEditor((s) => s.model);
  const activeView = useEditor((s) => s.activeView);
  const warnings = useEditor((s) => s.importWarnings);
  const warningsDismissed = useEditor((s) => s.warningsDismissed);
  const [error, setError] = useState<string | null>(null);
  const [minimap, setMinimap] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const openFile = useCallback((f: OpenedFile) => {
    try {
      const { model, warnings } = importModel(f.text, f.name);
      useEditor.getState().load(model, { warnings, fileName: f.name, handle: f.handle });
      setError(null);
    } catch (e) {
      // The current model is untouched on failure (US-1).
      const pos =
        e instanceof ImportError && e.line
          ? ` (line ${e.line}${e.column ? `, column ${e.column}` : ''})`
          : '';
      setError(`Could not open ${f.name}: ${e instanceof Error ? e.message : String(e)}${pos}`);
    }
  }, []);

  const onOpen = useCallback(async () => {
    const f = await pickFile();
    if (f) openFile(f);
  }, [openFile]);

  const onDrop = useCallback(
    async (e: DragEvent) => {
      setDragOver(false);
      const file = Array.from(e.dataTransfer.files)[0];
      if (!file) return;
      e.preventDefault();
      openFile(await readDroppedFile(file));
    },
    [openFile],
  );

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
      <header className={styles.toolbar} role="toolbar" aria-label="Main toolbar">
        <button type="button" onClick={onOpen}>
          Open
        </button>
        <span className={styles.separator} />
        <button type="button" onClick={() => setMinimap((m) => !m)} aria-pressed={minimap}>
          Minimap
        </button>
        {activeView && (
          <button
            type="button"
            onClick={() => useEditor.getState().toggleNested(activeView)}
            aria-pressed={useEditor.getState().showNested[activeView] ?? false}
          >
            Nested relationships
          </button>
        )}
        <span className={styles.modelName}>
          {model ? text(model.name, model.primaryLang) || 'Untitled model' : 'No model'}
        </span>
      </header>

      <div role="alert">
        {error && (
          <div className={styles.error}>
            {error}
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}
      </div>

      <div className={styles.body}>
        <aside className={styles.left}>
          <section className={styles.panel} aria-label="Model tree">
            <h2>Model</h2>
            <ModelTree />
          </section>
          <section className={styles.panel} aria-label="Palette">
            <h2>Palette</h2>
          </section>
        </aside>

        <main className={styles.center}>
          <nav className={styles.tabs} aria-label="Views">
            <ViewTabs />
          </nav>
          <div className={`${styles.canvas} ${dragOver ? styles.dragOver : ''}`}>
            {model && activeView ? (
              <Canvas key={activeView} viewId={activeView} minimap={minimap} />
            ) : (
              <div className={styles.empty}>
                {model ? (
                  <p className={styles.hint}>Open a view from the model tree.</p>
                ) : (
                  <>
                    <div className={styles.emptyActions}>
                      <button type="button" className={styles.primary}>
                        New model
                      </button>
                      <button type="button" onClick={onOpen}>
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
        </aside>
      </div>

      <footer className={styles.status} role="status">
        <button
          type="button"
          className={styles.statusButton}
          onClick={() => useEditor.setState({ warningsDismissed: !warningsDismissed })}
        >
          {warnings.length} import warnings
        </button>
      </footer>
      {model && warnings.length > 0 && !warningsDismissed && (
        <WarningsPanel
          title="Import warnings"
          warnings={warnings}
          onClose={() => useEditor.getState().dismissWarnings()}
        />
      )}
    </div>
  );
}
