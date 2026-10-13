// Phase 1 debug view: open an Exchange Format file and list what was imported.
import { useState } from 'react';
import { text } from '../core/model/langstring';
import type { Model } from '../core/model/types';
import {
  ImportError,
  importModel,
  type ImportWarning,
} from '../notation/archimate/exchange/import';

export function DebugModel() {
  const [model, setModel] = useState<Model | null>(null);
  const [warnings, setWarnings] = useState<ImportWarning[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function open(file: File) {
    try {
      const res = importModel(await file.text(), file.name);
      setModel(res.model);
      setWarnings(res.warnings);
      setError(null);
    } catch (e) {
      const pos =
        e instanceof ImportError && e.line ? ` (line ${e.line}, column ${e.column ?? '?'})` : '';
      setError((e instanceof Error ? e.message : String(e)) + pos);
    }
  }

  const lang = model?.primaryLang ?? '';
  return (
    <div style={{ padding: 16 }}>
      <h1>Debug: model contents</h1>
      <input
        type="file"
        accept=".xml"
        aria-label="Open Exchange Format file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void open(f);
        }}
      />
      {error && <p role="alert">{error}</p>}
      {model && (
        <>
          <h2>{text(model.name, lang)}</h2>
          <p>
            {Object.keys(model.elements).length} elements · {Object.keys(model.relations).length}{' '}
            relationships · {model.viewOrder.length} views · {warnings.length} warnings
          </p>
          {warnings.length > 0 && (
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          )}
          <h3>Elements</h3>
          <ul>
            {Object.values(model.elements).map((e) => (
              <li key={e.id}>
                {e.type}: {text(e.name, lang)}
              </li>
            ))}
          </ul>
          <h3>Relationships</h3>
          <ul>
            {Object.values(model.relations).map((r) => (
              <li key={r.id}>
                {r.type}: {r.source} → {r.target}
              </li>
            ))}
          </ul>
          <h3>Views</h3>
          <ul>
            {model.viewOrder.map((id) => {
              const v = model.views[id]!;
              return (
                <li key={id}>
                  {text(v.name, lang)} ({v.nodes.length} nodes, {v.connections.length} connections)
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
