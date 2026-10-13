import { memo, useMemo } from 'react';
import type { FontStyle } from '../../core/model/types';
import { rgba } from '../../notation/archimate/colors';
import { DEFAULT_FONT, type FontSpec, wrapText } from './text';

export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  text: string;
  box: LabelBox;
  align?: 'center' | 'left';
  valign?: 'middle' | 'top';
  font?: FontStyle;
  color?: string;
}

export function fontSpec(font: FontStyle | undefined): FontSpec {
  const styles = (font?.style ?? '').split(/\s+/);
  return {
    family: font?.name ? `"${font.name}", ${DEFAULT_FONT.family}` : DEFAULT_FONT.family,
    size: font?.size ?? DEFAULT_FONT.size,
    weight: styles.includes('bold') ? 'bold' : undefined,
    style: styles.includes('italic') ? 'italic' : undefined,
  };
}

/** Measured, wrapped SVG label (spec §8.7); text only, never HTML. */
export const Label = memo(function Label({
  text,
  box,
  align = 'center',
  valign = 'middle',
  font,
  color,
}: Props) {
  const spec = useMemo(() => fontSpec(font), [font]);
  const lineH = spec.size * 1.15;
  const maxLines = Math.max(1, Math.floor(box.h / lineH));

  const layout = useMemo(() => {
    const r = wrapText(text, spec, () => box.w, maxLines);
    const top = valign === 'top' ? box.y : box.y + (box.h - r.lines.length * lineH) / 2;
    return { ...r, top };
  }, [text, spec, box.w, box.h, box.y, maxLines, valign, lineH]);

  const x = align === 'center' ? box.x + box.w / 2 : box.x;
  return (
    <text
      fontFamily={spec.family}
      fontSize={spec.size}
      fontWeight={spec.weight}
      fontStyle={spec.style}
      textDecoration={(font?.style ?? '').includes('underline') ? 'underline' : undefined}
      fill={rgba(font?.color) ?? color ?? 'var(--am-text)'}
      textAnchor={align === 'center' ? 'middle' : 'start'}
      style={{ userSelect: 'none' }}
    >
      {layout.truncated && <title>{text}</title>}
      {layout.lines.map((line, i) => (
        <tspan key={i} x={x} y={layout.top + i * lineH + spec.size * 0.9}>
          {line}
        </tspan>
      ))}
    </text>
  );
});
