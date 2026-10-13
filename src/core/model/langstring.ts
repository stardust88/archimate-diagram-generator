import type { LangString } from './types';

/** Text for `lang`, falling back to no-lang, then to the first variant. */
export function text(ls: LangString | undefined, lang: string): string {
  if (!ls) return '';
  const exact = ls[lang];
  if (exact !== undefined) return exact;
  const none = ls[''];
  if (none !== undefined) return none;
  for (const k in ls) return ls[k] ?? '';
  return '';
}

/** A copy of `ls` with the `lang` variant set (or removed when empty and other variants exist). */
export function withText(ls: LangString | undefined, lang: string, value: string): LangString {
  const next: LangString = { ...ls };
  if (value === '' && Object.keys(next).length > 1) delete next[lang];
  else next[lang] = value;
  return next;
}

export function isEmpty(ls: LangString | undefined): boolean {
  return !ls || Object.keys(ls).length === 0;
}

export function newId(): string {
  return 'id-' + crypto.randomUUID();
}
