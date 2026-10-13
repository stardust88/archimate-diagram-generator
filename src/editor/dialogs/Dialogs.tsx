import { useEffect, useRef, useState } from 'react';
import { useDialogs, type Dialog } from './dialogApi';
import styles from './Dialogs.module.css';

export function Dialogs() {
  const d = useDialogs((s) => s.current);
  if (!d) return null;
  if (d.kind === 'choice') return <ChoiceMenu d={d} />;
  return <Modal d={d} />;
}

function Modal({ d }: { d: Exclude<Dialog, { kind: 'choice' }> }) {
  const [value, setValue] = useState(d.kind === 'prompt' ? d.initial : '');
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (d.kind === 'prompt') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else okRef.current?.focus();
  }, [d]);
  const cancel = () => (d.kind === 'confirm' ? d.resolve(false) : d.resolve(null));
  const ok = () =>
    d.kind === 'confirm' ? d.resolve(true) : d.resolve(value.trim() ? value : null);
  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && cancel()}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={d.title}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            cancel();
          }
        }}
      >
        <h2>{d.title}</h2>
        {d.kind === 'confirm' ? (
          <>
            <p>{d.message}</p>
            {d.details && d.details.length > 0 && (
              <ul className={styles.details}>
                {d.details.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <label className={styles.field}>
            {d.label}
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  ok();
                }
              }}
            />
          </label>
        )}
        <div className={styles.actions}>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
          <button
            ref={okRef}
            type="button"
            className={d.kind === 'confirm' && d.danger ? styles.danger : styles.primary}
            onClick={ok}
          >
            {d.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChoiceMenu({ d }: { d: Extract<Dialog, { kind: 'choice' }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(d.at);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    (el.querySelector('button') as HTMLButtonElement | null)?.focus();
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(4, Math.min(d.at.x, window.innerWidth - r.width - 4)),
      y: Math.max(4, Math.min(d.at.y, window.innerHeight - r.height - 4)),
    });
  }, [d]);
  return (
    <div
      className={styles.menuBackdrop}
      onMouseDown={(e) => e.target === e.currentTarget && d.resolve(null)}
    >
      <div
        ref={ref}
        className={styles.menu}
        role="menu"
        aria-label={d.title}
        style={{ left: pos.x, top: pos.y }}
        onKeyDown={(e) => {
          const items = Array.from(ref.current?.querySelectorAll('button') ?? []);
          const i = items.indexOf(document.activeElement as HTMLButtonElement);
          if (e.key === 'Escape') {
            e.stopPropagation();
            d.resolve(null);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[(i + 1) % items.length]?.focus();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            items[(i - 1 + items.length) % items.length]?.focus();
          }
        }}
      >
        <div className={styles.menuTitle}>{d.title}</div>
        {d.options.map((o) => (
          <button key={o.value} type="button" role="menuitem" onClick={() => d.resolve(o.value)}>
            {o.label}
            {o.hint && <span className={styles.hint}>{o.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
