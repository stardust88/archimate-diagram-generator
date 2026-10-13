// Visual test page (spec §13): every element type x {short, long name} x {light, dark}, the
// special figures, and every relationship type between two boxes. Rendered with the same
// figure components as the canvas, without React Flow, so screenshots are deterministic.
import { useEffect } from 'react';
import type { AccessType, Point } from '../core/model/types';
import { EdgeFigure } from '../editor/figures/EdgeFigure';
import { connectionPoints } from '../editor/figures/geometry';
import { MarkerDefs } from '../editor/figures/Markers';
import { NodeFigure, type NodeFigureProps } from '../editor/figures/NodeFigure';
import { ELEMENT_TYPES, LAYERS } from '../notation/archimate/catalog';
import { defaultColors } from '../notation/archimate/colors';
import { ICONS } from '../notation/archimate/icons';
import styles from './Gallery.module.css';

const LONG = 'A considerably longer element name that needs to wrap onto several lines';

function Figure(p: NodeFigureProps & { caption?: string }) {
  return (
    <figure className={styles.cell}>
      <svg width={p.w + 16} height={p.h + 16} className={styles.svg}>
        <g transform="translate(8,8)">
          <NodeFigure {...p} />
        </g>
      </svg>
      {p.caption && <figcaption>{p.caption}</figcaption>}
    </figure>
  );
}

interface RelSample {
  label: string;
  relType?: string;
  accessType?: AccessType;
  isDirected?: boolean;
  modifier?: string;
  invalid?: boolean;
}

const RELS: RelSample[] = [
  { label: 'Composition', relType: 'Composition' },
  { label: 'Aggregation', relType: 'Aggregation' },
  { label: 'Assignment', relType: 'Assignment' },
  { label: 'Realization', relType: 'Realization' },
  { label: 'Serving', relType: 'Serving' },
  { label: 'Access', relType: 'Access', accessType: 'Access' },
  { label: 'Access (read)', relType: 'Access', accessType: 'Read' },
  { label: 'Access (write)', relType: 'Access', accessType: 'Write' },
  { label: 'Access (read/write)', relType: 'Access', accessType: 'ReadWrite' },
  { label: 'Influence', relType: 'Influence', modifier: '+' },
  { label: 'Triggering', relType: 'Triggering' },
  { label: 'Flow', relType: 'Flow' },
  { label: 'Specialization', relType: 'Specialization' },
  { label: 'Association', relType: 'Association' },
  { label: 'Association (directed)', relType: 'Association', isDirected: true },
  { label: 'Line (no relationship)' },
  { label: 'Invalid relationship', relType: 'Triggering', invalid: true },
];

function Relationship({ sample, prefix }: { sample: RelSample; prefix: string }) {
  const a = { x: 8, y: 20, w: 90, h: 40 };
  const b = { x: 238, y: 20, w: 90, h: 40 };
  const pts: Point[] = connectionPoints({ rect: a, shape: 'rect' }, { rect: b, shape: 'rect' }, []);
  return (
    <figure className={styles.relCell}>
      <svg width={336} height={80} className={styles.svg}>
        <g transform={`translate(${a.x},${a.y})`}>
          <NodeFigure kind="element" type="BusinessProcess" name="Source" w={a.w} h={a.h} />
        </g>
        <g transform={`translate(${b.x},${b.y})`}>
          <NodeFigure kind="element" type="BusinessObject" name="Target" w={b.w} h={b.h} />
        </g>
        <EdgeFigure
          points={pts}
          relType={sample.relType}
          accessType={sample.accessType}
          isDirected={sample.isDirected}
          modifier={sample.modifier}
          invalid={sample.invalid}
          markerPrefix={prefix}
        />
      </svg>
      <figcaption>{sample.label}</figcaption>
    </figure>
  );
}

function Section({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <section
      className={`${styles.section} ${theme === 'dark' ? 'theme-dark' : ''}`}
      data-testid={`gallery-${theme}`}
    >
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden="true">
        <MarkerDefs prefix={`gallery-${theme}`} />
      </svg>
      <h2>{theme === 'light' ? 'Light' : 'Dark'}</h2>
      {LAYERS.map(({ layer, label }) => {
        const types = ELEMENT_TYPES.filter(
          (d) => d.layer === layer && d.aspect !== 'connector' && d.type !== 'Grouping',
        );
        if (!types.length) return null;
        return (
          <div key={layer}>
            <h3>{label}</h3>
            <div className={styles.grid}>
              {types.map((d) => (
                <div key={d.type} className={styles.pair}>
                  <Figure
                    kind="element"
                    type={d.type}
                    name={d.label}
                    w={120}
                    h={55}
                    caption={d.type}
                  />
                  <Figure kind="element" type={d.type} name={LONG} w={120} h={55} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <h3>Special figures</h3>
      <div className={styles.grid}>
        <Figure kind="element" type="Grouping" name="Grouping" w={200} h={110} caption="Grouping" />
        <Figure kind="element" type="AndJunction" name="" w={15} h={15} caption="And" />
        <Figure kind="element" type="OrJunction" name="" w={15} h={15} caption="Or" />
        <Figure kind="label" name={'A label node\nwith two lines'} w={160} h={50} caption="Label" />
        <Figure
          kind="label"
          name="Styled label"
          w={160}
          h={50}
          style={{ fill: { r: 255, g: 255, b: 255 }, line: { r: 92, g: 92, b: 92 } }}
          caption="Label (styled)"
        />
        <Figure kind="container" name="Container" w={160} h={80} caption="Container" />
        <Figure
          kind="element"
          type="Unknown:FancyWidget"
          name="Unknown type"
          w={120}
          h={55}
          unknownType="FancyWidget"
          caption="Unknown"
        />
        <Figure
          kind="element"
          type="BusinessActor"
          name="Selected"
          w={120}
          h={55}
          selected
          caption="Selected"
        />
        <Figure
          kind="element"
          type="Goal"
          name="Off viewpoint"
          w={120}
          h={55}
          warning="Not in viewpoint"
          caption="Warning badge"
        />
        <Figure
          kind="element"
          type="ApplicationComponent"
          name="Imported style"
          w={120}
          h={55}
          style={{
            fill: { r: 255, g: 200, b: 200 },
            line: { r: 160, g: 0, b: 0 },
            font: { size: 10, style: 'bold', color: { r: 120, g: 0, b: 0 } },
          }}
          caption="style override"
        />
      </div>
      <h3>Icons (3x)</h3>
      <div className={styles.grid}>
        {ELEMENT_TYPES.filter((d) => ICONS[d.icon]).map((d) => {
          const Comp = ICONS[d.icon]!;
          const c = defaultColors(d.type);
          return (
            <figure key={d.type} className={styles.cell}>
              <svg
                width={48}
                height={48}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: c.stroke, background: c.fill, ['--icon-fill' as string]: c.fill }}
              >
                <Comp />
              </svg>
              <figcaption>{d.label}</figcaption>
            </figure>
          );
        })}
      </div>
      <h3>Relationships</h3>
      <div className={styles.grid}>
        {RELS.map((r) => (
          <Relationship key={r.label} sample={r} prefix={`gallery-${theme}`} />
        ))}
      </div>
    </section>
  );
}

export function Gallery() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.dataset.theme;
    root.dataset.theme = 'light';
    return () => {
      if (prev === undefined) delete root.dataset.theme;
      else root.dataset.theme = prev;
    };
  }, []);
  return (
    <div className={styles.page}>
      <h1>ArchiMate figure gallery</h1>
      <Section theme="light" />
      <Section theme="dark" />
    </div>
  );
}
