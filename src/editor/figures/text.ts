// Label measurement and word wrapping (spec §8.7). Uses CanvasRenderingContext2D.measureText so
// SVG <tspan> lines match the screen; falls back to an average-width estimate where no canvas
// is available (jsdom in unit tests).

export interface FontSpec {
  family: string;
  size: number;
  weight?: string;
  style?: string;
}

export const DEFAULT_FONT: FontSpec = {
  family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  size: 12,
};

export function cssFont(f: FontSpec): string {
  return `${f.style ?? 'normal'} ${f.weight ?? 'normal'} ${f.size}px ${f.family}`;
}

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

export function measure(textValue: string, font: FontSpec): number {
  const key = cssFont(font) + '\u0000' + textValue;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (ctx === undefined) {
    try {
      // jsdom has no canvas; getContext returns null (and logs "not implemented").
      ctx =
        typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
          ? null
          : document.createElement('canvas').getContext('2d');
    } catch {
      ctx = null;
    }
  }
  let w: number;
  if (ctx) {
    ctx.font = cssFont(font);
    w = ctx.measureText(textValue).width;
  } else {
    w = textValue.length * font.size * 0.55;
  }
  if (cache.size > 20000) cache.clear();
  cache.set(key, w);
  return w;
}

export interface WrapResult {
  lines: string[];
  /** True when text was cut and an ellipsis added. */
  truncated: boolean;
}

function fitWithEllipsis(s: string, width: number, font: FontSpec): string {
  const ell = '…';
  if (measure(s + ell, font) <= width) return s + ell;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(s.slice(0, mid) + ell, font) <= width) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo) + ell;
}

/**
 * Wraps `text` into lines. `widthAt(i)` gives the available width of line i (the first line can
 * be shorter, to avoid the corner icon). Explicit newlines are honoured. Words longer than a
 * line are broken by character. At most `maxLines`; overflow ends with an ellipsis.
 */
export function wrapText(
  text: string,
  font: FontSpec,
  widthAt: (line: number) => number,
  maxLines: number,
): WrapResult {
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);
  let truncated = false;
  outer: for (let p = 0; p < paragraphs.length; p++) {
    const words = (paragraphs[p] ?? '').split(/\s+/).filter(Boolean);
    let cur = '';
    const push = (s: string): boolean => {
      if (lines.length >= maxLines) {
        truncated = true;
        return false;
      }
      lines.push(s);
      return true;
    };
    if (words.length === 0) {
      if (!push('')) break;
      continue;
    }
    for (let wi = 0; wi < words.length; wi++) {
      let word = words[wi]!;
      const width = Math.max(1, widthAt(lines.length));
      const candidate = cur ? cur + ' ' + word : word;
      if (measure(candidate, font) <= width) {
        cur = candidate;
        continue;
      }
      if (cur && !push(cur)) break outer;
      // Break a long word by characters.
      while (measure(word, font) > Math.max(1, widthAt(lines.length))) {
        const w2 = Math.max(1, widthAt(lines.length));
        let n = 1;
        while (n < word.length && measure(word.slice(0, n + 1), font) <= w2) n++;
        if (!push(word.slice(0, n))) break outer;
        word = word.slice(n);
      }
      cur = word;
    }
    if (cur && !push(cur)) break;
  }
  // Drop trailing empty lines from trailing newlines.
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  if (truncated && lines.length > 0) {
    const i = lines.length - 1;
    lines[i] = fitWithEllipsis(lines[i]!, Math.max(1, widthAt(i)), font);
  }
  return { lines, truncated };
}
