// Icon registry (spec §8.4). Each icon is drawn in a 16x16 viewBox with stroke="currentColor";
// the figure sets `color` to the layer stroke and `--icon-fill` to the node fill. Types without
// a registered icon render the two-letter placeholder; the editor works fully with placeholders.
import type { ReactElement } from 'react';

export type IconComponent = () => ReactElement;

export const ICONS: Record<string, IconComponent> = {};
