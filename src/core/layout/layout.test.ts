import { importModel } from '../../notation/archimate/exchange/import';
import { readFixture } from '../../test/fixtures';
import { execute } from '../commands/command';
import * as C from '../commands/model-commands';
import type { Model } from '../model/types';
import { layoutView } from './elk';

function layered(): { m: Model; viewId: string; ids: Record<string, string> } {
  let m = C.createModel('Layers');
  const viewId = m.viewOrder[0]!;
  const ids: Record<string, string> = {};
  const add = (key: string, type: string) => {
    const r = C.addElementWithNode(viewId, { type, name: key }, { x: 0, y: 0, w: 120, h: 55 });
    m = execute(m, r.cmd).model;
    ids[key] = r.nodeId;
    return r.elementId;
  };
  // Deliberately added bottom-up.
  const node = add('node', 'Node');
  const app = add('app', 'ApplicationComponent');
  const proc = add('proc', 'BusinessProcess');
  const goal = add('goal', 'Goal');
  m = execute(
    m,
    C.addRelationWithConnection(
      viewId,
      { type: 'Realization', source: node, target: app },
      { source: ids.node!, target: ids.app! },
    ).cmd,
  ).model;
  m = execute(
    m,
    C.addRelationWithConnection(
      viewId,
      { type: 'Serving', source: app, target: proc },
      { source: ids.app!, target: ids.proc! },
    ).cmd,
  ).model;
  m = execute(
    m,
    C.addRelationWithConnection(
      viewId,
      { type: 'Realization', source: proc, target: goal },
      { source: ids.proc!, target: ids.goal! },
    ).cmd,
  ).model;
  return { m, viewId, ids };
}

describe('auto-layout (§9.5)', () => {
  it('orders layers top-down: motivation, business, application, technology', async () => {
    const { m, viewId, ids } = layered();
    const { rects } = await layoutView(m, m.views[viewId]!);
    const y = (k: string) => rects.find((r) => r.id === ids[k])!.y;
    expect(y('goal')).toBeLessThan(y('proc'));
    expect(y('proc')).toBeLessThan(y('app'));
    expect(y('app')).toBeLessThan(y('node'));
  });

  it('keeps children inside their laid-out parents and is one undoable command', async () => {
    const { model: m } = importModel(readFixture('synthetic/nested-3-levels.xml'));
    const v = m.views['id-v1']!;
    const res = await layoutView(m, v);
    const by = Object.fromEntries(res.rects.map((r) => [r.id, r]));
    for (const n of v.nodes) {
      if (!n.parent) continue;
      const c = by[n.id]!;
      const p = by[n.parent]!;
      expect(c.x).toBeGreaterThanOrEqual(p.x);
      expect(c.y).toBeGreaterThanOrEqual(p.y);
      expect(c.x + c.w).toBeLessThanOrEqual(p.x + p.w);
      expect(c.y + c.h).toBeLessThanOrEqual(p.y + p.h);
    }
    const { model: after, entry } = execute(m, C.applyLayout('id-v1', res.rects, res.connections));
    expect(after.views['id-v1']!.connections[0]!.bendpoints).toEqual([]);
    expect(entry.undo.apply(after)).toEqual(m);
  });

  it('lays out a selection in place', async () => {
    const { m, viewId, ids } = layered();
    const moved = execute(
      m,
      C.moveResizeNodes(viewId, [{ id: ids.app!, x: 500, y: 400, w: 120, h: 55 }]),
    ).model;
    const { rects } = await layoutView(moved, moved.views[viewId]!, [ids.app!]);
    expect(rects).toEqual([{ id: ids.app, x: 500, y: 400, w: 120, h: 55 }]);
  });
});

describe('align and distribute', () => {
  const nodes = [
    { kind: 'container' as const, id: 'a', x: 10, y: 10, w: 100, h: 50 },
    { kind: 'container' as const, id: 'b', x: 200, y: 40, w: 60, h: 30 },
    { kind: 'container' as const, id: 'c', x: 500, y: 90, w: 100, h: 50 },
  ];
  const m = (): Model => {
    const base = C.createModel('A');
    base.views[base.viewOrder[0]!]!.nodes = structuredClone(nodes);
    return base;
  };

  it('aligns to the first node', () => {
    const model = m();
    const vid = model.viewOrder[0]!;
    const after = execute(model, C.alignNodes(vid, model.views[vid]!.nodes, 'right')).model;
    expect(after.views[vid]!.nodes.map((n) => n.x + n.w)).toEqual([110, 110, 110]);
    const mid = execute(model, C.alignNodes(vid, model.views[vid]!.nodes, 'middle')).model;
    expect(mid.views[vid]!.nodes.map((n) => n.y + n.h / 2)).toEqual([35, 35, 35]);
  });

  it('distributes with equal gaps', () => {
    const model = m();
    const vid = model.viewOrder[0]!;
    const after = execute(
      model,
      C.distributeNodes(vid, model.views[vid]!.nodes, 'horizontal'),
    ).model;
    const [a, b, c] = after.views[vid]!.nodes;
    expect(b!.x - (a!.x + a!.w)).toBe(c!.x - (b!.x + b!.w));
    expect([a!.x, c!.x]).toEqual([10, 500]);
  });
});
