// Presentational SVG for one connection (spec §8.6). Shared by the canvas and the gallery.
import { memo } from 'react';
import type { AccessType, Point, Style } from '../../core/model/types';
import { rgba } from '../../notation/archimate/colors';
import {
  relationshipDef,
  type LineStyle,
  type MarkerKind,
} from '../../notation/archimate/relationships';
import { pointsToPath, polylineMidpoint } from './geometry';
import { markerId } from './Markers';
import { fontSpec } from './Label';
import { measure } from './text';

export interface EdgeFigureProps {
  points: Point[];
  /** Relationship type; undefined for a plain "line" connection. */
  relType?: string;
  accessType?: AccessType;
  isDirected?: boolean;
  modifier?: string;
  label?: string;
  style?: Style;
  selected?: boolean;
  /** Not allowed by the relationship table: red dashed outline (§10). */
  invalid?: boolean;
  /** Id prefix of the MarkerDefs to use (default "am"). */
  markerPrefix?: string;
}

const DASH: Record<LineStyle, string | undefined> = {
  solid: undefined,
  dashed: '6 4',
  dotted: '2 3',
  longDash: '10 5',
};

/**
 * Markers for a relationship. Access (verified against the ArchiMate 3.2 spec, §5.2.1): the
 * relationship is always modelled from the behaviour/active element to the passive object; the
 * arrowhead shows the direction of data flow. Read: arrow at the source (the reader); Write:
 * arrow at the target (the object); ReadWrite: both; Access (unspecified): none.
 */
export function edgeMarkers(
  relType: string | undefined,
  accessType: AccessType | undefined,
  isDirected: boolean | undefined,
): { start: MarkerKind; end: MarkerKind; line: LineStyle } {
  const def = relType ? relationshipDef(relType) : undefined;
  if (!def) return { start: 'none', end: 'none', line: 'solid' };
  if (def.type === 'Access') {
    const t = accessType ?? 'Access';
    return {
      start: t === 'Read' || t === 'ReadWrite' ? 'arrowOpen' : 'none',
      end: t === 'Write' || t === 'ReadWrite' ? 'arrowOpen' : 'none',
      line: def.line,
    };
  }
  if (def.type === 'Association') {
    return { start: 'none', end: isDirected ? 'halfArrow' : 'none', line: def.line };
  }
  return { start: def.sourceMarker, end: def.targetMarker, line: def.line };
}

export const EdgeFigure = memo(function EdgeFigure(p: EdgeFigureProps) {
  const { start, end, line } = edgeMarkers(p.relType, p.accessType, p.isDirected);
  const d = pointsToPath(p.points);
  const variant = p.selected ? 'selected' : 'normal';
  const color = p.selected ? 'var(--am-selection)' : (rgba(p.style?.line) ?? 'var(--am-edge)');
  const width = p.selected ? 2 : (p.style?.lineWidth ?? 1);
  const mid = polylineMidpoint(p.points);
  const text = [p.label, p.relType === 'Influence' ? p.modifier : undefined]
    .filter((s) => s)
    .join(' ');
  const font = fontSpec(p.style?.font ?? { size: 11 });
  const tw = text ? measure(text, font) + 6 : 0;
  return (
    <g>
      {p.invalid && (
        <path
          d={d}
          fill="none"
          stroke="var(--am-invalid)"
          strokeWidth={5}
          strokeDasharray="4 3"
          opacity={0.6}
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={DASH[line]}
        markerStart={
          start !== 'none' ? `url(#${markerId(start, variant, p.markerPrefix)})` : undefined
        }
        markerEnd={end !== 'none' ? `url(#${markerId(end, variant, p.markerPrefix)})` : undefined}
      />
      {text && (
        <g transform={`translate(${mid.x},${mid.y})`}>
          <rect
            x={-tw / 2}
            y={-font.size * 0.75}
            width={tw}
            height={font.size * 1.5}
            fill="var(--am-marker-bg)"
            opacity={0.85}
          />
          <text
            fontFamily={font.family}
            fontSize={font.size}
            textAnchor="middle"
            dominantBaseline="central"
            fill={rgba(p.style?.font?.color) ?? 'var(--am-text)'}
            style={{ userSelect: 'none' }}
          >
            {text}
          </text>
        </g>
      )}
    </g>
  );
});
