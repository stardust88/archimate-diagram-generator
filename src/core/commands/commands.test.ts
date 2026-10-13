// Spec §13: for each command, apply then invert restores a deep-equal model; plus behaviour checks.
import { importModel } from '../../notation/archimate/exchange/import';
import { exportModel } from '../../notation/archimate/exchange/export';
import { readFixture } from '../../test/fixtures';
import { validateAgainstXsd } from '../../test/xsd';
import type { Model } from '../model/types';
import { execute, type Command } from './command';
import * as C from './model-commands';

function fixture(): Model {
  return importModel(readFixture('synthetic/junctions-labels-containers.xml')).model;
}

function roundTrip(m: Model, cmd: Command): Model {
  const before = structuredClone(m);
  const { model: after, entry } = execute(m, cmd);
  expect(after).not.toEqual(before);
  expect(entry.undo.apply(after)).toEqual(before);
  // Redo replays to the same result.
  expect(entry.redo.apply(entry.undo.apply(after))).toEqual(after);
  return after;
}

const V = 'id-v1';

describe('commands: apply + invert restores the model', () => {
  const cases: [string, (m: Model) => Command][] = [
    ['AddElement', () => C.addElement({ type: 'BusinessActor', name: 'New actor' }).cmd],
    [
      'AddViewNode',
      () =>
        C.addViewNode(V, { kind: 'element', elementRef: 'id-p1', x: 900, y: 40, w: 120, h: 55 })
          .cmd,
    ],
    [
      'AddElementWithNode',
      () =>
        C.addElementWithNode(V, { type: 'Goal', name: 'G' }, { x: 10, y: 400, w: 120, h: 55 }).cmd,
    ],
    [
      'MoveResizeNodes',
      () => C.moveResizeNodes(V, [{ id: 'id-box', x: 40, y: 80, w: 760, h: 260 }]),
    ],
    ['Reparent', () => C.reparent(V, ['id-n-p3'], 'id-box')],
    ['Rename element', () => C.rename({ kind: 'element', id: 'id-p1' }, 'en', 'Check inventory')],
    ['Rename node label', () => C.rename({ kind: 'node', viewId: V, id: 'id-box' }, 'en', 'Lane')],
    ['SetDocumentation', () => C.setDocumentation({ kind: 'element', id: 'id-p1' }, 'en', 'Docs')],
    [
      'SetProperty add',
      () => C.setProperty({ kind: 'element', id: 'id-p1' }, undefined, 'Owner', 'Ops'),
    ],
    [
      'ChangeElementType',
      () => C.changeElementType('id-p1', 'BusinessFunction', 'Business Function'),
    ],
    [
      'AddRelation',
      () => C.addRelation({ type: 'Triggering', source: 'id-p1', target: 'id-p2' }).cmd,
    ],
    [
      'AddRelationWithConnection',
      () =>
        C.addRelationWithConnection(
          V,
          { type: 'Triggering', source: 'id-p1', target: 'id-p2' },
          { source: 'id-n-p1', target: 'id-n-p2' },
        ).cmd,
    ],
    ['AddConnection (line)', () => C.addConnection(V, { source: 'id-lbl', target: 'id-note' }).cmd],
    ['SetBendpoints', () => C.setBendpoints(V, 'id-ct1', [{ x: 1, y: 2 }])],
    ['SetRelationAttrs', () => C.setRelationAttrs('id-t1', { modifier: '+' })],
    ['RemoveFromView', () => C.removeFromView(V, ['id-box'], [])],
    ['DeleteFromModel', () => C.deleteFromModel(['id-and'])],
    ['AddView', () => C.addView('Second').cmd],
    ['RenameView', () => C.renameView(V, 'en', 'Renamed')],
    ['DeleteView', () => C.deleteView(V)],
    ['DuplicateView', () => C.duplicateView(V).cmd],
    ['SetViewpoint', () => C.setViewpoint(V, 'Business Process Cooperation')],
    ['SetStyle', () => C.setStyle(V, ['id-n-p1'], [], { fill: { r: 1, g: 2, b: 3 } })],
    ['MoveToFolder', () => C.moveToFolder('id-p1', { name: 'Other' })],
    [
      'Paste',
      (m) => C.paste(m, V, C.copySelection(m, V, ['id-n-p1', 'id-n-p2'])!, { x: 20, y: 20 }).cmd,
    ],
  ];

  it.each(cases)('%s', (_name, make) => {
    const m = fixture();
    roundTrip(m, make(m));
  });
});

describe('command behaviour', () => {
  it('moving a parent moves its descendants and shared bendpoints', () => {
    const m = fixture();
    const after = roundTrip(
      m,
      C.moveResizeNodes(V, [{ id: 'id-box', x: 120, y: 160, w: 760, h: 260 }]),
    );
    const p3 = after.views[V]!.nodes.find((n) => n.id === 'id-n-p3')!;
    expect([p3.x, p3.y]).toEqual([620, 260]);
    const ct2 = after.views[V]!.connections.find((c) => c.id === 'id-ct2')!;
    expect(ct2.bendpoints).toEqual([{ x: 307, y: 217 }]);
    expect(ct2.sourceAttachment).toBeUndefined();
  });

  it('remove from view keeps the element in the model and drops nested children', () => {
    const after = roundTrip(fixture(), C.removeFromView(V, ['id-n-f1'], []));
    const v = after.views[V]!;
    expect(v.nodes.map((n) => n.id)).not.toContain('id-n-p3');
    expect(v.connections.map((c) => c.id)).not.toContain('id-ct6');
    expect(after.elements['id-f1']).toBeDefined();
  });

  it('delete from model removes attached relationships, nodes, connections and folder entries', () => {
    const m = fixture();
    expect(C.affectedViews(m, ['id-p1'])).toEqual([V]);
    const after = roundTrip(m, C.deleteFromModel(['id-p1']));
    expect(after.elements['id-p1']).toBeUndefined();
    expect(after.relations['id-t2']).toBeUndefined();
    expect(after.relations['id-t4']).toBeUndefined();
    const v = after.views[V]!;
    expect(v.nodes.map((n) => n.id)).not.toContain('id-n-p1');
    expect(v.connections.map((c) => c.id)).not.toContain('id-ct2');
  });

  it('deleting a container element keeps nested children under the next parent', () => {
    const after = roundTrip(fixture(), C.deleteFromModel(['id-f1']));
    const p3 = after.views[V]!.nodes.find((n) => n.id === 'id-n-p3')!;
    expect(p3.parent).toBe('id-box');
  });

  it('new elements go into default folders by layer', () => {
    const m = fixture();
    const { cmd, id } = C.addElement({ type: 'Goal', name: 'Grow' });
    const after = roundTrip(m, cmd);
    const folder = after.organizations.find((o) => o.label?.en === 'Motivation');
    expect(folder?.items.map((i) => i.ref)).toEqual([id]);
  });

  it('paste references existing elements in another view and copies them in the same view', () => {
    const m = fixture();
    const clip = C.copySelection(m, V, ['id-n-p1'])!;
    const sameView = C.paste(m, V, clip, { x: 20, y: 20 });
    const after1 = roundTrip(m, sameView.cmd);
    expect(Object.keys(after1.elements)).toHaveLength(Object.keys(m.elements).length + 1);
    const { cmd: addV, id: v2 } = C.addView('Other');
    const m2 = execute(m, addV).model;
    const other = C.paste(m2, v2, clip, { x: 0, y: 0 });
    const after2 = roundTrip(m2, other.cmd);
    expect(Object.keys(after2.elements)).toHaveLength(Object.keys(m2.elements).length);
    expect(after2.views[v2]!.nodes[0]).toMatchObject({ kind: 'element', elementRef: 'id-p1' });
  });

  it('setProperty reuses a definition with the same name', () => {
    const m = importModel(readFixture('synthetic/multi-lang.xml')).model;
    const after = roundTrip(
      m,
      C.setProperty({ kind: 'element', id: 'id-a1' }, undefined, 'Owner', 'X'),
    );
    expect(after.elements['id-a1']!.properties[0]!.definitionRef).toBe('pd-owner');
    expect(after.propertyDefinitions).toHaveLength(3);
  });
});

describe('from-scratch model', () => {
  it('built via commands exports XSD-valid XML', async () => {
    let m = C.createModel('Scratch');
    const v = m.viewOrder[0]!;
    const a = C.addElementWithNode(
      v,
      { type: 'BusinessActor', name: 'Customer' },
      { x: 40, y: 40, w: 120, h: 55 },
    );
    const r = C.addElementWithNode(
      v,
      { type: 'BusinessRole', name: 'Buyer' },
      { x: 240, y: 40, w: 120, h: 55 },
    );
    const s = C.addElementWithNode(
      v,
      { type: 'BusinessService', name: 'Ordering' },
      { x: 240, y: 160, w: 120, h: 55 },
    );
    for (const c of [a.cmd, r.cmd, s.cmd]) m = execute(m, c).model;
    m = execute(
      m,
      C.addRelationWithConnection(
        v,
        { type: 'Assignment', source: a.elementId, target: r.elementId },
        { source: a.nodeId, target: r.nodeId },
      ).cmd,
    ).model;
    m = execute(
      m,
      C.addRelationWithConnection(
        v,
        { type: 'Serving', source: s.elementId, target: r.elementId },
        { source: s.nodeId, target: r.nodeId },
      ).cmd,
    ).model;
    m = execute(
      m,
      C.setProperty({ kind: 'element', id: a.elementId }, undefined, 'Owner', 'Sales'),
    ).model;
    const xml = exportModel(m);
    const result = await validateAgainstXsd(xml);
    expect(result.errors).toEqual([]);
    const { sourceInfo, ...reimported } = importModel(xml).model;
    expect(sourceInfo?.rootAttributes['xsi:schemaLocation']).toContain('archimate3_Diagram.xsd');
    expect(reimported).toEqual(m);
  });
});
