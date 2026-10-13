// Properties panel (spec US-4): name, type, documentation, key/value properties and, for
// relationships, their attributes. Every committed edit is exactly one command.
import { useEffect, useRef } from 'react';
import type { Command } from '../../core/commands/command';
import * as C from '../../core/commands/model-commands';
import { text } from '../../core/model/langstring';
import type { AccessType, Id, Model, Property, RGBA, Style } from '../../core/model/types';
import { useEditor } from '../../core/store/store';
import { ELEMENT_TYPES, LAYERS, elementDef, isJunction } from '../../notation/archimate/catalog';
import { isUnknownType, xsiFromType } from '../../notation/archimate/exchange/mapping';
import { relationshipDef } from '../../notation/archimate/relationships';
import { isRelationValid } from '../../notation/archimate/validation';
import { VIEWPOINT_NAMES } from '../../notation/archimate/viewpoints';
import { useDraft } from '../useDraft';
import styles from './Properties.module.css';

const dispatch = (cmd: Command) => useEditor.getState().dispatch(cmd);

type Target =
  | { kind: 'model' }
  | { kind: 'element'; id: Id; viewId?: Id; nodeId?: Id }
  | { kind: 'relation'; id: Id; viewId?: Id; connId?: Id }
  | { kind: 'view'; id: Id }
  | { kind: 'node'; viewId: Id; id: Id }
  | { kind: 'connection'; viewId: Id; id: Id }
  | { kind: 'multi'; viewId: Id; nodes: Id[]; connections: Id[] };

function resolveTarget(s: ReturnType<typeof useEditor.getState>): Target | null {
  const m = s.model;
  if (!m) return null;
  const sel = s.selection;
  const v = sel.viewId ? m.views[sel.viewId] : undefined;
  if (v && sel.viewId === s.activeView && sel.nodes.length + sel.connections.length > 0) {
    if (sel.nodes.length + sel.connections.length > 1) {
      return { kind: 'multi', viewId: v.id, nodes: sel.nodes, connections: sel.connections };
    }
    if (sel.nodes.length === 1) {
      const n = v.nodes.find((x) => x.id === sel.nodes[0]);
      if (n?.kind === 'element' && m.elements[n.elementRef]) {
        return { kind: 'element', id: n.elementRef, viewId: v.id, nodeId: n.id };
      }
      if (n) return { kind: 'node', viewId: v.id, id: n.id };
    } else {
      const c = v.connections.find((x) => x.id === sel.connections[0]);
      if (c?.relationshipRef && m.relations[c.relationshipRef]) {
        return { kind: 'relation', id: c.relationshipRef, viewId: v.id, connId: c.id };
      }
      if (c) return { kind: 'connection', viewId: v.id, id: c.id };
    }
  }
  const t = s.treeSelection;
  if (t && m.elements[t]) return { kind: 'element', id: t };
  if (t && m.relations[t]) return { kind: 'relation', id: t };
  if (t && m.views[t]) return { kind: 'view', id: t };
  if (s.activeView && m.views[s.activeView]) return { kind: 'view', id: s.activeView };
  return { kind: 'model' };
}

export function Properties() {
  const model = useEditor((s) => s.model);
  // Select a string: resolveTarget builds a fresh object each call.
  const key = useEditor((s) => JSON.stringify(resolveTarget(s)));
  const target = JSON.parse(key) as Target | null;
  if (!model || !target) return <p className={styles.muted}>Nothing selected.</p>;
  return <TargetPanel key={key} model={model} target={target} />;
}

function TargetPanel({ model, target }: { model: Model; target: Target }) {
  const lang = model.primaryLang;
  switch (target.kind) {
    case 'model':
      return (
        <div className={styles.panel}>
          <Heading kind="Model" />
          <TextField
            label="Name"
            value={text(model.name, lang)}
            onCommit={(v) => dispatch(C.setModelName(lang, v))}
          />
          <DocField owner={{ kind: 'model' }} value={text(model.documentation, lang)} lang={lang} />
          <PropertiesTable owner={{ kind: 'model' }} model={model} props={model.properties} />
          <p className={styles.muted}>
            {Object.keys(model.elements).length} elements · {Object.keys(model.relations).length}{' '}
            relationships · {model.viewOrder.length} views
          </p>
        </div>
      );
    case 'element': {
      const e = model.elements[target.id]!;
      const owner = { kind: 'element' as const, id: e.id };
      const def = elementDef(e.type);
      const node = target.viewId
        ? model.views[target.viewId]?.nodes.find((n) => n.id === target.nodeId)
        : undefined;
      return (
        <div className={styles.panel}>
          <Heading kind={def?.label ?? xsiFromType(e.type)} />
          <TextField
            label="Name"
            value={text(e.name, lang)}
            onCommit={(v) => dispatch(C.rename(owner, lang, v))}
          />
          <label className={styles.field}>
            Type
            <select
              aria-label="Element type"
              value={e.type}
              disabled={isJunction(e.type) || isUnknownType(e.type)}
              onChange={(ev) => {
                const d = elementDef(ev.target.value);
                if (d) dispatch(C.changeElementType(e.id, d.type, d.label));
              }}
            >
              {isUnknownType(e.type) && (
                <option value={e.type}>{xsiFromType(e.type)} (unknown)</option>
              )}
              {LAYERS.map((l) => (
                <optgroup key={l.layer} label={l.label}>
                  {ELEMENT_TYPES.filter((d) => d.layer === l.layer && d.aspect !== 'connector').map(
                    (d) => (
                      <option key={d.type} value={d.type}>
                        {d.label}
                      </option>
                    ),
                  )}
                </optgroup>
              ))}
              {isJunction(e.type) && <option value={e.type}>{def?.label}</option>}
            </select>
          </label>
          <InvalidRelationsNote model={model} id={e.id} />
          <DocField owner={owner} value={text(e.documentation, lang)} lang={lang} />
          <PropertiesTable owner={owner} model={model} props={e.properties} />
          {node && target.viewId && (
            <StyleSection
              viewId={target.viewId}
              nodes={[node.id]}
              connections={[]}
              style={node.style}
            />
          )}
        </div>
      );
    }
    case 'relation': {
      const r = model.relations[target.id]!;
      const owner = { kind: 'relation' as const, id: r.id };
      const def = relationshipDef(r.type);
      const conn = target.viewId
        ? model.views[target.viewId]?.connections.find((c) => c.id === target.connId)
        : undefined;
      const src = model.elements[r.source];
      const tgt = model.elements[r.target];
      return (
        <div className={styles.panel}>
          <Heading kind={`${def?.label ?? xsiFromType(r.type)} relationship`} />
          {!isRelationValid(model, r) && (
            <p className={styles.invalid} role="note">
              Not allowed by ArchiMate between these element types.
            </p>
          )}
          <p className={styles.muted}>
            {src ? text(src.name, lang) : r.source} → {tgt ? text(tgt.name, lang) : r.target}
          </p>
          <TextField
            label="Name"
            value={text(r.name, lang)}
            onCommit={(v) => dispatch(C.rename(owner, lang, v))}
          />
          {r.type === 'Access' && (
            <label className={styles.field}>
              Access type
              <select
                aria-label="Access type"
                value={r.accessType ?? 'Access'}
                onChange={(ev) =>
                  dispatch(C.setRelationAttrs(r.id, { accessType: ev.target.value as AccessType }))
                }
              >
                <option value="Access">access (unspecified)</option>
                <option value="Read">read</option>
                <option value="Write">write</option>
                <option value="ReadWrite">read/write</option>
              </select>
            </label>
          )}
          {r.type === 'Influence' && (
            <TextField
              label="Modifier / strength (+, ++, -, --, 0-10)"
              value={r.modifier ?? ''}
              onCommit={(v) => dispatch(C.setRelationAttrs(r.id, { modifier: v.trim() || null }))}
            />
          )}
          {r.type === 'Association' && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={r.isDirected ?? false}
                onChange={(ev) =>
                  dispatch(C.setRelationAttrs(r.id, { isDirected: ev.target.checked }))
                }
              />
              Directed
            </label>
          )}
          <DocField owner={owner} value={text(r.documentation, lang)} lang={lang} />
          <PropertiesTable owner={owner} model={model} props={r.properties} />
          {conn && target.viewId && (
            <StyleSection
              viewId={target.viewId}
              nodes={[]}
              connections={[conn.id]}
              style={conn.style}
            />
          )}
        </div>
      );
    }
    case 'view': {
      const v = model.views[target.id]!;
      const owner = { kind: 'view' as const, id: v.id };
      return (
        <div className={styles.panel}>
          <Heading kind="View" />
          <TextField
            label="Name"
            value={text(v.name, lang)}
            onCommit={(val) => dispatch(C.renameView(v.id, lang, val))}
          />
          <label className={styles.field}>
            Viewpoint
            <select
              aria-label="Viewpoint"
              value={v.viewpoint ?? ''}
              onChange={(ev) => dispatch(C.setViewpoint(v.id, ev.target.value || undefined))}
            >
              <option value="">None</option>
              {v.viewpoint && !VIEWPOINT_NAMES.includes(v.viewpoint) && (
                <option value={v.viewpoint}>{v.viewpoint}</option>
              )}
              {VIEWPOINT_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <NestedToggle viewId={v.id} />
          <DocField owner={owner} value={text(v.documentation, lang)} lang={lang} />
          <PropertiesTable owner={owner} model={model} props={v.properties} />
        </div>
      );
    }
    case 'node': {
      const n = model.views[target.viewId]?.nodes.find((x) => x.id === target.id);
      if (!n) return null;
      const owner = { kind: 'node' as const, viewId: target.viewId, id: n.id };
      return (
        <div className={styles.panel}>
          <Heading
            kind={n.kind === 'label' ? 'Label' : n.kind === 'container' ? 'Container' : 'Node'}
          />
          <TextField
            label="Text"
            multiline
            value={text(n.label, lang)}
            onCommit={(v) => dispatch(C.rename(owner, lang, v))}
          />
          <StyleSection viewId={target.viewId} nodes={[n.id]} connections={[]} style={n.style} />
        </div>
      );
    }
    case 'connection': {
      const c = model.views[target.viewId]?.connections.find((x) => x.id === target.id);
      if (!c) return null;
      const owner = { kind: 'connection' as const, viewId: target.viewId, id: c.id };
      return (
        <div className={styles.panel}>
          <Heading kind="Line" />
          <TextField
            label="Label"
            value={text(c.label, lang)}
            onCommit={(v) => dispatch(C.rename(owner, lang, v))}
          />
          <StyleSection viewId={target.viewId} nodes={[]} connections={[c.id]} style={c.style} />
        </div>
      );
    }
    case 'multi':
      return (
        <div className={styles.panel}>
          <Heading kind={`${target.nodes.length + target.connections.length} items selected`} />
          <StyleSection
            viewId={target.viewId}
            nodes={target.nodes}
            connections={target.connections}
            style={undefined}
          />
        </div>
      );
  }
}

function Heading({ kind }: { kind: string }) {
  return <h3 className={styles.heading}>{kind}</h3>;
}

function NestedToggle({ viewId }: { viewId: Id }) {
  const on = useEditor((s) => !!s.showNested[viewId]);
  return (
    <label className={styles.check}>
      <input
        type="checkbox"
        checked={on}
        onChange={() => useEditor.getState().toggleNested(viewId)}
      />
      Show nested relationships
    </label>
  );
}

function InvalidRelationsNote({ model, id }: { model: Model; id: Id }) {
  const n = Object.values(model.relations).filter(
    (r) => (r.source === id || r.target === id) && !isRelationValid(model, r),
  ).length;
  if (!n) return null;
  return (
    <p className={styles.invalid} role="note">
      {n} relationship{n === 1 ? ' is' : 's are'} not valid for this element type.
    </p>
  );
}

/** Text input that commits once on blur or Enter, and only when the value changed. */
export function TextField({
  label,
  value,
  onCommit,
  multiline,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
}) {
  const [v, setV] = useDraft(value);
  const commit = () => {
    if (v !== value) onCommit(v);
  };
  const common = {
    value: v,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') setV(value);
    },
  };
  return (
    <label className={styles.field}>
      {label}
      {multiline ? <textarea rows={4} {...common} /> : <input {...common} />}
    </label>
  );
}

function DocField({ owner, value, lang }: { owner: C.Owner; value: string; lang: string }) {
  return (
    <TextField
      label="Documentation"
      multiline
      value={value}
      onCommit={(v) => dispatch(C.setDocumentation(owner, lang, v))}
    />
  );
}

function PropertiesTable({
  owner,
  model,
  props,
}: {
  owner: C.Owner;
  model: Model;
  props: Property[];
}) {
  const lang = model.primaryLang;
  const keyOf = (p: Property) => {
    const d = model.propertyDefinitions.find((x) => x.id === p.definitionRef);
    return d ? text(d.name, lang) : p.definitionRef;
  };
  return (
    <fieldset className={styles.props}>
      <legend>Properties</legend>
      {props.length === 0 && <p className={styles.muted}>No properties.</p>}
      {props.map((p, i) => (
        <div key={i} className={styles.propRow}>
          <PropInput
            aria={`Property ${i + 1} key`}
            value={keyOf(p)}
            onCommit={(v) => v.trim() && dispatch(C.setProperty(owner, i, v.trim()))}
          />
          <PropInput
            aria={`Property ${i + 1} value`}
            value={text(p.values, lang)}
            onCommit={(v) => dispatch(C.setProperty(owner, i, keyOf(p), v))}
          />
          <button
            type="button"
            aria-label={`Remove property ${keyOf(p)}`}
            onClick={() => dispatch(C.setProperty(owner, i, null))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.add}
        onClick={() => {
          let n = 1;
          const keys = new Set(props.map(keyOf));
          while (keys.has(`Property ${n}`)) n++;
          dispatch(C.setProperty(owner, undefined, `Property ${n}`, ''));
        }}
      >
        + Add property
      </button>
    </fieldset>
  );
}

function PropInput({
  aria,
  value,
  onCommit,
}: {
  aria: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useDraft(value);
  return (
    <input
      aria-label={aria}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (v !== value) onCommit(v);
        }
      }}
    />
  );
}

function toHex(c: RGBA | undefined): string {
  if (!c) return '#ffffff';
  return '#' + [c.r, c.g, c.b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function fromHex(h: string): RGBA {
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

function StyleSection({
  viewId,
  nodes,
  connections,
  style,
}: {
  viewId: Id;
  nodes: Id[];
  connections: Id[];
  style: Style | undefined;
}) {
  const set = (patch: C.StylePatch) => dispatch(C.setStyle(viewId, nodes, connections, patch));
  return (
    <fieldset className={styles.props}>
      <legend>Appearance</legend>
      {nodes.length > 0 && (
        <ColorRow
          label="Fill"
          value={style?.fill}
          onChange={(c) => set({ fill: c })}
          onReset={() => set({ fill: null })}
        />
      )}
      <ColorRow
        label="Line"
        value={style?.line}
        onChange={(c) => set({ line: c })}
        onReset={() => set({ line: null })}
      />
    </fieldset>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  onReset,
}: {
  label: string;
  value: RGBA | undefined;
  onChange: (c: RGBA) => void;
  onReset: () => void;
}) {
  return (
    <div className={styles.colorRow}>
      <label>
        {label}
        <ColorInput
          label={label}
          value={toHex(value)}
          onCommit={(hex) =>
            onChange({ ...fromHex(hex), ...(value?.a !== undefined ? { a: value.a } : {}) })
          }
        />
      </label>
      <span className={styles.muted}>{value ? toHex(value) : 'default'}</span>
      {value && (
        <button type="button" onClick={onReset}>
          Default
        </button>
      )}
    </div>
  );
}

/** Colour picker committing on the native `change` event (picker closed): one command per edit. */
function ColorInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (hex: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.value = value;
    const h = () => {
      if (el.value !== value) commit.current(el.value);
    };
    el.addEventListener('change', h);
    return () => el.removeEventListener('change', h);
  }, [value]);
  return <input ref={ref} type="color" aria-label={`${label} colour`} defaultValue={value} />;
}
