import { setModelName } from '../../core/commands/model-commands';
import { text } from '../../core/model/langstring';
import { isDirty, useEditor } from '../../core/store/store';
import * as A from '../actions';
import { choiceMenu } from '../dialogs/dialogApi';
import { nextTheme, setTheme, useTheme } from '../theme';
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
  const selectedNodes = useEditor((s) =>
    s.selection.viewId === s.activeView ? s.selection.nodes.length : 0,
  );
  const theme = useTheme();

  const menuAt = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: r.left, y: r.bottom + 4 };
  };
  const onLayout = async (e: React.MouseEvent) => {
    const c = await choiceMenu({
      title: 'Layout',
      at: menuAt(e),
      options: [
        { value: 'view', label: 'Layout view' },
        ...(selectedNodes > 0 ? [{ value: 'sel', label: 'Layout selection' }] : []),
      ],
    });
    if (c) await A.layout(c === 'sel');
  };
  const onArrange = async (e: React.MouseEvent) => {
    const c = await choiceMenu({
      title: 'Arrange',
      at: menuAt(e),
      options: [
        { value: 'left', label: 'Align left' },
        { value: 'center', label: 'Align centre' },
        { value: 'right', label: 'Align right' },
        { value: 'top', label: 'Align top' },
        { value: 'middle', label: 'Align middle' },
        { value: 'bottom', label: 'Align bottom' },
        ...(selectedNodes >= 3
          ? [
              { value: 'dh', label: 'Distribute horizontally' },
              { value: 'dv', label: 'Distribute vertically' },
            ]
          : []),
      ],
    });
    if (c === 'dh') A.distribute('horizontal');
    else if (c === 'dv') A.distribute('vertical');
    else if (c) A.align(c as Parameters<typeof A.align>[0]);
  };

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
      <Btn
        label="Layout"
        title="Automatic layout"
        disabled={!hasView}
        onClick={(e) => void onLayout(e)}
      />
      <Btn
        label="Arrange"
        title="Align or distribute the selected elements"
        disabled={selectedNodes < 2}
        onClick={(e) => void onArrange(e)}
      />
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
      <Btn
        label={
          theme === 'system' ? 'Theme: system' : theme === 'light' ? 'Theme: light' : 'Theme: dark'
        }
        title="Switch between system, light and dark themes"
        onClick={() => setTheme(nextTheme(theme))}
      />
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
  onClick: (e: React.MouseEvent) => void;
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
