import { boxPath } from './boxPath';
import { borderPoint, connectionPoints, polylineMidpoint } from './geometry';
import { DEFAULT_FONT, measure, wrapText } from './text';

describe('boxPath (§8.2)', () => {
  it('draws square corners for rect', () => {
    expect(boxPath('rect', 120, 55)).toBe('M0,0 H120 V55 H0 Z');
  });

  it('bevels corners by 8px for cut', () => {
    expect(boxPath('cut', 120, 55)).toBe('M8,0 H112 L120,8 V47 L112,55 H8 L0,47 V8 Z');
  });

  it('rounds corners with radius 10, capped at h/2', () => {
    expect(boxPath('rounded', 120, 55)).toContain('A10,10');
    expect(boxPath('rounded', 120, 12)).toContain('A6,6');
  });
});

describe('wrapText (§8.7)', () => {
  // In jsdom, measure() estimates 0.55em per character: 12px font -> 6.6px per char.
  const w = (chars: number) => chars * DEFAULT_FONT.size * 0.55 + 0.01;

  it('keeps short text on one line', () => {
    expect(wrapText('Customer', DEFAULT_FONT, () => w(20), 3)).toEqual({
      lines: ['Customer'],
      truncated: false,
    });
  });

  it('wraps at word boundaries', () => {
    const r = wrapText('Order management service', DEFAULT_FONT, () => w(16), 3);
    expect(r.lines).toEqual(['Order management', 'service']);
  });

  it('honours explicit newlines', () => {
    expect(wrapText('a\nb', DEFAULT_FONT, () => w(20), 3).lines).toEqual(['a', 'b']);
  });

  it('breaks a word longer than the line', () => {
    const r = wrapText('Supercalifragilistic', DEFAULT_FONT, () => w(8), 5);
    expect(r.lines.every((l) => measure(l, DEFAULT_FONT) <= w(8))).toBe(true);
    expect(r.lines.join('')).toBe('Supercalifragilistic');
  });

  it('truncates with an ellipsis when out of lines', () => {
    const r = wrapText('one two three four five six', DEFAULT_FONT, () => w(9), 2);
    expect(r.truncated).toBe(true);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[1]!.endsWith('…')).toBe(true);
  });

  it('can use a different width per line', () => {
    const r = wrapText('aaa bbb ccc', DEFAULT_FONT, (i) => (i === 0 ? w(3) : w(7)), 3);
    expect(r.lines).toEqual(['aaa', 'bbb ccc']);
  });
});

describe('edge geometry (§8.6 floating edges)', () => {
  const a = { x: 0, y: 0, w: 100, h: 50 };
  const b = { x: 300, y: 0, w: 100, h: 50 };

  it('attaches on the bounding box towards the other centre', () => {
    expect(borderPoint(a, { x: 350, y: 25 })).toEqual({ x: 100, y: 25 });
  });

  it('respects bendpoints', () => {
    const pts = connectionPoints({ rect: a, shape: 'rect' }, { rect: b, shape: 'rect' }, [
      { x: 50, y: 200 },
      { x: 350, y: 200 },
    ]);
    expect(pts).toEqual([
      { x: 50, y: 50 },
      { x: 50, y: 200 },
      { x: 350, y: 200 },
      { x: 350, y: 50 },
    ]);
  });

  it('uses stored attachments that still lie on the node', () => {
    const pts = connectionPoints(
      { rect: a, shape: 'rect', attachment: { x: 10, y: 50 } },
      { rect: b, shape: 'rect', attachment: { x: 999, y: 999 } },
      [],
    );
    expect(pts[0]).toEqual({ x: 10, y: 50 });
    expect(pts[1]!.x).toBe(300); // stale attachment ignored
  });

  it('finds the midpoint along a polyline', () => {
    expect(
      polylineMidpoint([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toEqual({ x: 10, y: 0 });
  });
});
