import { memo } from 'react';
import { elementDef } from '../../notation/archimate/catalog';
import { ICONS } from '../../notation/archimate/icons';

interface Props {
  type: string;
  x: number;
  y: number;
  size?: number;
  color: string;
  fill: string;
}

/** Type icon at (x, y), 16x16 by default; a two-letter code until the real icon exists. */
export const Icon = memo(function Icon({ type, x, y, size = 16, color, fill }: Props) {
  const def = elementDef(type);
  const Comp = def ? ICONS[def.icon] : undefined;
  if (Comp) {
    return (
      <svg
        x={x}
        y={y}
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color, ['--icon-fill' as string]: fill }}
        aria-hidden="true"
      >
        <Comp />
      </svg>
    );
  }
  const code = def ? def.code : '?';
  return (
    <text
      x={x + size / 2}
      y={y + size / 2}
      fontSize={code === '?' ? 12 : 8}
      fontWeight={code === '?' ? 700 : 600}
      fontFamily="system-ui, sans-serif"
      textAnchor="middle"
      dominantBaseline="central"
      fill={color}
      aria-hidden="true"
    >
      {code}
    </text>
  );
});
