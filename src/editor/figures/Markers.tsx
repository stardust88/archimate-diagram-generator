// Shared SVG <marker> definitions for relationship ends (spec §8.6). Render once per SVG root
// (the canvas renders it once in a zero-size SVG; ids are global in the document).
import type { MarkerKind } from '../../notation/archimate/relationships';

export function markerId(
  kind: MarkerKind,
  variant: 'normal' | 'selected' = 'normal',
  prefix = 'am',
): string {
  return `${prefix}-marker-${kind}-${variant}`;
}

function shape(kind: MarkerKind, color: string) {
  const bg = 'var(--am-marker-bg)';
  switch (kind) {
    case 'diamondFilled':
      return <path d="M0,5 L6,1 L12,5 L6,9 Z" fill={color} stroke={color} />;
    case 'diamondHollow':
      return <path d="M0,5 L6,1 L12,5 L6,9 Z" fill={bg} stroke={color} />;
    case 'dot':
      return <circle cx={3} cy={5} r={2.6} fill={color} stroke={color} />;
    case 'arrowFilled':
      return <path d="M0,1 L10,5 L0,9 Z" fill={color} stroke={color} />;
    case 'arrowOpen':
      return <path d="M1,1 L10,5 L1,9" fill="none" stroke={color} strokeWidth={1.2} />;
    case 'triangleHollow':
      return <path d="M0,0.5 L11,5 L0,9.5 Z" fill={bg} stroke={color} />;
    case 'halfArrow':
      return <path d="M1,1 L10,5" fill="none" stroke={color} strokeWidth={1.2} />;
    case 'none':
      return null;
  }
}

/**
 * Where each marker's tip sits (refX) so it touches the node border. Every marker is drawn as an
 * end marker pointing into the node along +x; with orient="auto-start-reverse" the same
 * definition is correct at the source end too.
 */
const REF_X: Record<MarkerKind, number> = {
  none: 0,
  diamondFilled: 12,
  diamondHollow: 12,
  dot: 5.6,
  arrowFilled: 10,
  arrowOpen: 10,
  triangleHollow: 11,
  halfArrow: 10,
};

const KINDS: MarkerKind[] = [
  'diamondFilled',
  'diamondHollow',
  'dot',
  'arrowFilled',
  'arrowOpen',
  'triangleHollow',
  'halfArrow',
];

/** `prefix` lets one page hold several marker sets (e.g. light and dark gallery sections). */
export function MarkerDefs({ prefix = 'am' }: { prefix?: string }) {
  return (
    <defs>
      {(['normal', 'selected'] as const).flatMap((variant) =>
        KINDS.map((k) => (
          <marker
            key={`${k}-${variant}`}
            id={markerId(k, variant, prefix)}
            viewBox="-1 -1 14 12"
            refX={REF_X[k]}
            refY={5}
            markerWidth={14}
            markerHeight={12}
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            {shape(k, variant === 'selected' ? 'var(--am-selection)' : 'var(--am-edge)')}
          </marker>
        )),
      )}
    </defs>
  );
}
