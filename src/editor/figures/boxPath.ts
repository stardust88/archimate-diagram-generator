import type { BoxShape } from '../../notation/archimate/catalog';

/** SVG path for a box figure (spec §8.2), in local coordinates (0,0)-(w,h). */
export function boxPath(shape: BoxShape, w: number, h: number): string {
  if (shape === 'rect') return `M0,0 H${w} V${h} H0 Z`;
  if (shape === 'cut') {
    const c = 8;
    return `M${c},0 H${w - c} L${w},${c} V${h - c} L${w - c},${h} H${c} L0,${h - c} V${c} Z`;
  }
  const r = Math.min(10, h / 2);
  return `M${r},0 H${w - r} A${r},${r} 0 0 1 ${w},${r} V${h - r} A${r},${r} 0 0 1 ${w - r},${h} H${r} A${r},${r} 0 0 1 0,${h - r} V${r} A${r},${r} 0 0 1 ${r},0 Z`;
}
