import styles from './App.module.css';

// Phase 0 shell: layout from spec §9.1. Actions are wired up in later phases.
export function App() {
  return (
    <div className={styles.app}>
      <header className={styles.toolbar} role="toolbar" aria-label="Main toolbar">
        <button type="button">New</button>
        <button type="button">Open</button>
        <button type="button" disabled>
          Save
        </button>
        <button type="button" disabled>
          Export XML
        </button>
        <span className={styles.separator} />
        <button type="button" disabled>
          Undo
        </button>
        <button type="button" disabled>
          Redo
        </button>
        <span className={styles.separator} />
        <button type="button" disabled>
          Layout
        </button>
        <button type="button" disabled>
          Fit
        </button>
        <button type="button" disabled>
          Validate
        </button>
        <span className={styles.modelName}>No model</span>
      </header>

      <div className={styles.body}>
        <aside className={styles.left}>
          <section className={styles.panel} aria-label="Model tree">
            <h2>Model</h2>
          </section>
          <section className={styles.panel} aria-label="Palette">
            <h2>Palette</h2>
          </section>
        </aside>

        <main className={styles.center}>
          <nav className={styles.tabs} aria-label="Views" />
          <div className={styles.canvas}>
            <div className={styles.empty}>
              <div className={styles.emptyActions}>
                <button type="button" className={styles.primary}>
                  New model
                </button>
                <button type="button">Open ArchiMate XML</button>
              </div>
              <p className={styles.hint}>or drop an Exchange Format .xml file here</p>
            </div>
          </div>
        </main>

        <aside className={`${styles.panel} ${styles.right}`} aria-label="Properties">
          <h2>Properties</h2>
        </aside>
      </div>

      <footer className={styles.status} role="status">
        0 import warnings · 0 validation issues
      </footer>
    </div>
  );
}
