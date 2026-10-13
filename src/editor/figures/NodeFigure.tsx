// Presentational SVG for one view node (spec §8.2, §8.5). Shared by the canvas and the gallery.
import { memo } from 'react';
import type { Style } from '../../core/model/types';
import { elementDef } from '../../notation/archimate/catalog';
import { defaultColors, rgba } from '../../notation/archimate/colors';
import { boxPath } from './boxPath';
import { Icon } from './Icon';
import { Label, fontSpec } from './Label';
import { measure } from './text';

export interface NodeFigureProps {
  kind: 'element' | 'label' | 'container';
  /** Element type (internal name) for element nodes. */
  type?: string;
  name: string;
  w: number;
  h: number;
  style?: Style;
  selected?: boolean;
  /** Has nested child nodes: the label moves to the top. */
  hasChildren?: boolean;
  /** Off-viewpoint or other warning badge (US-7). */
  warning?: string;
  /** Original xsi:type for unknown types, shown under the label. */
  unknownType?: string;
}

const PAD = 6;
const VPAD = 4;
const ICON = 16;

export const NodeFigure = memo(function NodeFigure(p: NodeFigureProps) {
  const { w, h, style, selected } = p;
  const sel = selected ? 'var(--am-selection)' : undefined;
  const strokeWidth = selected ? 2 : (style?.lineWidth ?? 1);

  let body: React.ReactNode;
  if (p.kind === 'label') {
    body = (
      <>
        {(style?.fill || style?.line || selected) && (
          <rect
            x={0.5}
            y={0.5}
            width={w - 1}
            height={h - 1}
            fill={rgba(style?.fill) ?? 'none'}
            stroke={sel ?? rgba(style?.line) ?? 'none'}
            strokeWidth={strokeWidth}
          />
        )}
        <Label
          text={p.name}
          box={{ x: PAD, y: PAD, w: w - 2 * PAD, h: h - 2 * PAD }}
          align="left"
          valign="top"
          font={style?.font}
        />
      </>
    );
  } else if (p.kind === 'container') {
    body = (
      <>
        <rect
          x={0.5}
          y={0.5}
          width={w - 1}
          height={h - 1}
          fill={rgba(style?.fill) ?? 'var(--am-container-fill)'}
          stroke={sel ?? rgba(style?.line) ?? 'var(--am-container-stroke)'}
          strokeWidth={strokeWidth}
        />
        <Label
          text={p.name}
          box={{ x: PAD, y: PAD, w: w - 2 * PAD, h: Math.min(h - 2 * PAD, 40) }}
          align="left"
          valign="top"
          font={style?.font}
        />
      </>
    );
  } else {
    body = <ElementBody {...p} strokeWidth={strokeWidth} sel={sel} />;
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      overflow="visible"
      style={{ display: 'block' }}
    >
      {body}
      {p.warning && (
        <g>
          <title>{p.warning}</title>
          <circle cx={0} cy={0} r={7} fill="var(--am-warning)" />
          <text
            x={0}
            y={0}
            fontSize={10}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#000"
          >
            !
          </text>
        </g>
      )}
    </svg>
  );
});

function ElementBody(p: NodeFigureProps & { strokeWidth: number; sel?: string }) {
  const type = p.type ?? '';
  const { w, h, style } = p;
  const def = elementDef(type);
  const colors = defaultColors(type);
  const fill = rgba(style?.fill) ?? colors.fill;
  const stroke = rgba(style?.line) ?? colors.stroke;
  const outline = p.sel ?? stroke;

  if (type === 'AndJunction' || type === 'OrJunction') {
    const r = Math.max(2, Math.min(w, h) / 2 - 0.5);
    return (
      <circle
        cx={w / 2}
        cy={h / 2}
        r={r}
        fill={
          type === 'AndJunction'
            ? (rgba(style?.fill) ?? 'var(--am-junction-fill)')
            : 'var(--bg-canvas)'
        }
        stroke={p.sel ?? rgba(style?.line) ?? 'var(--am-junction-stroke)'}
        strokeWidth={p.sel ? 2 : 1.2}
      />
    );
  }

  if (type === 'Grouping') {
    const font = fontSpec(style?.font);
    const tabH = Math.min(h, font.size * 1.2 + 8);
    const tabW = Math.min(w, Math.max(40, measure(p.name, font) + 2 * PAD));
    return (
      <>
        <rect
          x={0.5}
          y={tabH}
          width={w - 1}
          height={Math.max(0, h - tabH - 0.5)}
          fill={fill}
          stroke={outline}
          strokeWidth={p.strokeWidth}
          strokeDasharray="6 4"
        />
        <rect
          x={0.5}
          y={0.5}
          width={tabW}
          height={tabH - 0.5}
          fill={fill}
          stroke={outline}
          strokeWidth={p.strokeWidth}
        />
        <Label
          text={p.name}
          box={{ x: PAD, y: 3, w: tabW - 2 * PAD + 2, h: tabH - 4 }}
          align="left"
          valign="top"
          font={style?.font}
        />
      </>
    );
  }

  const shape = def?.box ?? 'rect';
  const unknown = !def;
  const labelH = unknown ? h - 2 * VPAD - 14 : h - 2 * VPAD;
  return (
    <>
      <path
        d={boxPath(shape, w, h)}
        fill={fill}
        stroke={outline}
        strokeWidth={p.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
      <Icon type={type} x={w - PAD - ICON} y={PAD} color={stroke} fill={fill} />
      {/* The label column stops short of the icon on every line, so wrapped text never
          overlaps it (§8.2); centred within that column. */}
      <Label
        text={p.name}
        box={{ x: PAD, y: VPAD, w: w - 2 * PAD - ICON - 2, h: labelH }}
        valign={p.hasChildren ? 'top' : 'middle'}
        font={style?.font}
      />
      {unknown && p.unknownType && (
        <text
          x={w / 2}
          y={h - PAD}
          fontSize={9}
          fontStyle="italic"
          textAnchor="middle"
          fill="var(--am-text)"
          opacity={0.7}
        >
          {p.unknownType}
        </text>
      )}
    </>
  );
}
