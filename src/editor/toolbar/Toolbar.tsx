import { setModelName } from '../../core/commands/model-commands';
import { text } from '../../core/model/langstring';
import { isDirty, useEditor } from '../../core/store/store';
import * as A from '../actions';
import { useDraft } from '../useDraft';
import styles from './Toolbar.module.css';

const MOD = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl+';

interface Props {
  minimap: boolean;
  onToggleMinimap: () => void;
  extra?: React.ReactNode;
}

/** Main toolbar (spec §9.1). Every action is a labelled, keyboard-reachable button. */
export function Toolbar({ minimap, onToggleMinimap, extra }: Props) {
  const model = useEditor((s) => s.model);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undoLabel = useEditor((s) => s.past[s.past.length - 1]?.undo.label);
  const redoLabel = useEditor((s) => s.future[0]?.redo.label);
  const dirty = useEditor((s) => isDirty(s));
  const hasView = useEditor((s) => !!s.activeView);

  return (
    <header className={styles.toolbar} role="toolbar" aria-label="Main toolbar">
      <Btn label="New" title="New model" onClick={() => void A.newModel()} />
      <Btn label="Open" title="Open ArchiMate XML" onClick={() => void A.openFile()} />
      <Btn label="Save" title={`Save (${MOD}S)`} disabled={!model} onClick={() => void A.save()} />
      <Btn
        label="Export XML"
        title="Download Exchange Format XML"
        disabled={!model}
        onClick={() => void A.exportXml()}
      />
      <Sep />
      <Btn
        label="Undo"
        title={undoLabel ? `Undo ${undoLabel} (${MOD}Z)` : 'Undo'}
        disabled={!canUndo}
        onClick={() => useEditor.getState().undo()}
      />
      <Btn
        label="Redo"
        title={redoLabel ? `Redo ${redoLabel} (${MOD}Shift+Z)` : 'Redo'}
        disabled={!canRedo}
        onClick={() => useEditor.getState().redo()}
      />
      <Sep />
      <Btn label="Add view" title="Add a view" disabled={!model} onClick={() => void A.addView()} />
      {extra}
      <Sep />
      <Btn
        label="−"
        title="Zoom out"
        aria="Zoom out"
        disabled={!hasView}
        onClick={() => A.canvasApi()?.zoomOut()}
      />
      <Btn
        label="+"
        title="Zoom in"
        aria="Zoom in"
        disabled={!hasView}
        onClick={() => A.canvasApi()?.zoomIn()}
      />
      <Btn
        label="Fit"
        title={`Fit to screen (${MOD}0)`}
        disabled={!hasView}
        onClick={() => A.canvasApi()?.fitView()}
      />
      <Btn
        label="Minimap"
        title="Toggle minimap"
        pressed={minimap}
        disabled={!hasView}
        onClick={onToggleMinimap}
      />
      <Sep />
      <Btn label="Validate" title="Check the whole model" disabled={!model} onClick={A.validate} />
      <span className={styles.spacer} />
      {model && <ModelName />}
      {dirty && (
        <span
          className={styles.dirty}
          title="Unsaved changes"
          aria-label="Unsaved changes"
          role="status"
        >
          ●
        </span>
      )}
    </header>
  );
}

function ModelName() {
  const name = useEditor((s) => (s.model ? text(s.model.name, s.model.primaryLang) : ''));
  const [v, setV] = useDraft(name);
  const commit = () => {
    const m = useEditor.getState().model;
    if (m && v !== name) useEditor.getState().dispatch(setModelName(m.primaryLang, v));
  };
  return (
    <input
      className={styles.name}
      aria-label="Model name"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setV(name);
      }}
    />
  );
}

function Btn(p: {
  label: string;
  title: string;
  aria?: string;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={p.title}
      aria-label={p.aria}
      aria-pressed={p.pressed}
      disabled={p.disabled}
      onClick={p.onClick}
    >
      {p.label}
    </button>
  );
}

function Sep() {
  return <span className={styles.sep} aria-hidden="true" />;
}
