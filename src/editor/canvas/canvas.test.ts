import { readFixture } from '../../test/fixtures';
import { importModel } from '../../notation/archimate/exchange/import';
import { ANCHOR_PREFIX, toFlow } from './adapter';
import { computeViewGeometry } from './viewGeometry';

describe('canvas adapter (§6.2)', () => {
  it('converts absolute coordinates to parent-relative positions', () => {
    const { model } = importModel(readFixture('synthetic/nested-3-levels.xml'));
    const { nodes } = toFlow(model, model.views['id-v1']!);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    expect(byId['id-n-grp']).toMatchObject({ position: { x: 20, y: 20 } });
    expect(byId['id-n-grp']!.parentId).toBeUndefined();
    expect(byId['id-n-node']).toMatchObject({ parentId: 'id-n-grp', position: { x: 20, y: 40 } });
    expect(byId['id-n-sw']).toMatchObject({ parentId: 'id-n-dev', position: { x: 20, y: 40 } });
    // Parents come before children, as React Flow requires.
    const order = nodes.map((n) => n.id);
    expect(order.indexOf('id-n-dev')).toBeLessThan(order.indexOf('id-n-sw'));
  });

  it('hides nodes and connections with dangling references but keeps them in the model', () => {
    const { model } = importModel(readFixture('synthetic/dangling-and-unknown.xml'));
    const view = model.views['id-v1']!;
    const { nodes, edges } = toFlow(model, view);
    expect(nodes.map((n) => n.id)).not.toContain('id-n2');
    expect(edges.map((e) => e.id)).toEqual(['id-c3']);
    expect(view.nodes).toHaveLength(4);
  });

  it('anchors connection-to-connection edges at the target midpoint', () => {
    const { model } = importModel(readFixture('synthetic/relationship-to-relationship.xml'));
    const { nodes, edges } = toFlow(model, model.views['id-v1']!);
    const e = edges.find((x) => x.id === 'id-c-assoc')!;
    expect(e.target).toBe(ANCHOR_PREFIX + 'id-c-acc');
    expect(nodes.find((n) => n.id === e.target)).toMatchObject({
      type: 'anchor',
      position: { x: 280, y: 67.5 },
    });
  });

  it('hides relationships shown by nesting unless the view toggle is on', () => {
    const { model } = importModel(readFixture('synthetic/nested-3-levels.xml'));
    const view = model.views['id-v1']!;
    // id-c4 connects id-n-sw to a node outside its parent chain, so it stays visible.
    expect([...computeViewGeometry(model, view).lines.keys()]).toEqual(['id-c4']);
    const { model: m2 } = importModel(readFixture('synthetic/junctions-labels-containers.xml'));
    const v2 = m2.views['id-v1']!;
    expect(computeViewGeometry(m2, v2).lines.has('id-cc1')).toBe(false);
    expect(computeViewGeometry(m2, v2, { showNested: true }).lines.has('id-cc1')).toBe(true);
  });
});
