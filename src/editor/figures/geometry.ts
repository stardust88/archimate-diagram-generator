// Edge geometry (spec §8.6 floating edges): ends attach where the line towards the next point
// leaves the node's bounding box.
import type { Point } from '../../core/model/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function contains(r: Rect, p: Point, tolerance = 0.5): boolean {
  return (
    p.x >= r.x - tolerance &&
    p.x <= r.x + r.w + tolerance &&
    p.y >= r.y - tolerance &&
    p.y <= r.y + r.h + tolerance
  );
}

/** Point where the segment from the centre of `r` towards `toward` crosses the border of `r`. */
export function borderPoint(r: Rect, toward: Point): Point {
  const c = center(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = r.w / 2;
  const hh = r.h / 2;
  const tx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const ty = dy === 0 ? Infinity : hh / Math.abs(dy);
  const t = Math.min(tx, ty, 1);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/** Point on a circle (junctions) towards `toward`. */
export function circlePoint(r: Rect, toward: Point): Point {
  const c = center(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  const len = Math.hypot(dx, dy);
  const rad = Math.min(r.w, r.h) / 2;
  if (len === 0 || len <= rad) return c;
  return { x: c.x + (dx / len) * rad, y: c.y + (dy / len) * rad };
}

export type EndShape = 'rect' | 'circle' | 'point';

export interface End {
  rect: Rect;
  shape: EndShape;
  /** Stored attachment point; used when it still lies on/in the rect. */
  attachment?: Point;
}

function attach(end: End, toward: Point): Point {
  if (end.shape === 'point') return center(end.rect);
  if (end.attachment && contains(end.rect, end.attachment)) return end.attachment;
  return end.shape === 'circle' ? circlePoint(end.rect, toward) : borderPoint(end.rect, toward);
}

/** Full polyline of a connection: source border point, bendpoints, target border point. */
export function connectionPoints(source: End, target: End, bendpoints: Point[]): Point[] {
  const firstToward = bendpoints[0] ?? target.attachment ?? center(target.rect);
  const lastToward = bendpoints[bendpoints.length - 1] ?? source.attachment ?? center(source.rect);
  const s = attach(source, firstToward);
  const t = attach(target, lastToward);
  return [s, ...bendpoints, t];
}

export function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  }
  return len;
}

/** Point halfway along a polyline. */
export function polylineMidpoint(pts: Point[]): Point {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0]!;
  let remaining = polylineLength(pts) / 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg >= remaining && seg > 0) {
      const t = remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  return pts[pts.length - 1]!;
}

export function pointsToPath(pts: Point[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
}

/** Distance from point to segment, for hit-testing bendpoint insertion. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
