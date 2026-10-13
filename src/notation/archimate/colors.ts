// Default figure colours (spec §8.3) as CSS variables, defined for light and dark themes in
// src/styles/archimate.css. An imported or user-set style.fill / style.line overrides them.
import type { RGBA } from '../../core/model/types';
import { elementDef } from './catalog';
import { isUnknownType } from './exchange/mapping';

export interface FigureColors {
  fill: string;
  stroke: string;
}

/** Colour key for a type: a layer name or one of the special cases in the §8.3 table. */
export function colorKey(type: string): string {
  if (isUnknownType(type)) return 'unknown';
  const def = elementDef(type);
  if (!def) return 'unknown';
  if (type === 'Location') return 'location';
  if (type === 'Grouping') return 'grouping';
  if (type === 'Plateau' || type === 'Gap') return 'implementation-alt';
  if (def.aspect === 'connector') return 'junction';
  if (def.layer === 'physical') return 'technology';
  return def.layer;
}

export function defaultColors(type: string): FigureColors {
  const k = colorKey(type);
  return { fill: `var(--am-${k}-fill)`, stroke: `var(--am-${k}-stroke)` };
}

export function rgba(c: RGBA | undefined): string | undefined {
  if (!c) return undefined;
  const a = c.a === undefined ? 1 : c.a / 100;
  return a >= 1 ? `rgb(${c.r} ${c.g} ${c.b})` : `rgb(${c.r} ${c.g} ${c.b} / ${a})`;
}
