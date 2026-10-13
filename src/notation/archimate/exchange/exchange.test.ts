// Phase 1 gate (spec §7.4, §13): every fixture imports with the expected counts, round-trips to a
// deep-equal model, exports XML that validates against the XSD, and matches the original after
// canonicalization.
import { canonicalize } from '../../../test/canonical';
import { expectations, fixtureFiles, readFixture } from '../../../test/fixtures';
import { generateLargeModel } from '../../../test/large-model';
import { validateAgainstXsd } from '../../../test/xsd';
import { exportModel } from './export';
import { ImportError, importModel } from './import';

const files = fixtureFiles();
const expected = expectations();

describe('fixtures', () => {
  it('has an expectation entry for every fixture', () => {
    expect(Object.keys(expected).sort()).toEqual(files);
  });
});

describe.each(files)('%s', (file) => {
  const xml = readFixture(file);
  const exp = expected[file]!;

  it('imports with the hand-computed counts', () => {
    const { model, warnings } = importModel(xml, file);
    const views = Object.values(model.views);
    expect({
      elements: Object.keys(model.elements).length,
      relations: Object.keys(model.relations).length,
      views: views.length,
      nodes: views.reduce((n, v) => n + v.nodes.length, 0),
      connections: views.reduce((n, v) => n + v.connections.length, 0),
    }).toEqual({
      elements: exp.elements,
      relations: exp.relations,
      views: exp.views,
      nodes: exp.nodes,
      connections: exp.connections,
    });
    if (exp.minWarnings) expect(warnings.length).toBeGreaterThanOrEqual(exp.minWarnings);
    else expect(warnings).toEqual([]);
  });

  it('round-trips: import -> export -> import is deep-equal', () => {
    const first = importModel(xml, file).model;
    const second = importModel(exportModel(first), file).model;
    expect(second).toEqual(first);
  });

  it('exported XML matches the original after canonicalization', () => {
    const exported = exportModel(importModel(xml, file).model);
    expect(canonicalize(exported)).toEqual(canonicalize(xml));
  });

  it.skipIf(exp.xsdInvalid)('exported XML validates against the XSD', async () => {
    const exported = exportModel(importModel(xml, file).model);
    const result = await validateAgainstXsd(exported, file);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('import details', () => {
  it('keeps absolute coordinates and parents for 3-level nesting', () => {
    const { model } = importModel(readFixture('synthetic/nested-3-levels.xml'));
    const nodes = model.views['id-v1']!.nodes;
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    expect(byId['id-n-sw']).toMatchObject({ parent: 'id-n-dev', x: 80, y: 140, w: 200, h: 120 });
    expect(byId['id-n-dev']).toMatchObject({ parent: 'id-n-node', x: 60, y: 100 });
    expect(byId['id-n-node']).toMatchObject({ parent: 'id-n-grp' });
    expect(byId['id-n-grp']!.parent).toBeUndefined();
  });

  it('reads all xml:lang variants and picks the primary language', () => {
    const { model } = importModel(readFixture('synthetic/multi-lang.xml'));
    expect(model.elements['id-a1']!.name).toEqual({ fr: 'Client', en: 'Customer', de: 'Kunde' });
    expect(model.elements['id-p2']!.name).toEqual({ '': 'Sans langue' });
    expect(model.primaryLang).toBe('fr');
    expect(model.documentation!.en).toBe('Bilingual model.\nSecond line & "quotes" <kept>.');
  });

  it('supports relationship-to-relationship and connection-to-connection', () => {
    const { model } = importModel(readFixture('synthetic/relationship-to-relationship.xml'));
    expect(model.relations['id-assoc']).toMatchObject({ target: 'id-acc', isDirected: true });
    expect(model.relations['id-acc']!.accessType).toBe('ReadWrite');
    expect(model.relations['id-acc3']!.accessType).toBeUndefined();
    expect(model.relations['id-inf']!.modifier).toBe('++');
    const c = model.views['id-v1']!.connections.find((x) => x.id === 'id-c-assoc');
    expect(c!.target).toBe('id-c-acc');
  });

  it('reads label, container, line and nesting connections', () => {
    const { model } = importModel(readFixture('synthetic/junctions-labels-containers.xml'));
    const v = model.views['id-v1']!;
    expect(v.nodes.find((n) => n.id === 'id-lbl')).toMatchObject({
      kind: 'label',
      label: { en: 'Order handling\n(two checks in parallel)' },
    });
    expect(v.nodes.find((n) => n.id === 'id-box')).toMatchObject({ kind: 'container' });
    expect(v.connections.find((c) => c.id === 'id-line')).toMatchObject({ kind: 'line' });
    expect(v.connections.find((c) => c.id === 'id-cc1')).toMatchObject({
      kind: 'relationship',
      extra: { xsiType: 'NestingRelationship' },
    });
    expect(v.connections.find((c) => c.id === 'id-ct2')).toMatchObject({
      sourceAttachment: { x: 207, y: 180 },
      bendpoints: [{ x: 207, y: 117 }],
      targetAttachment: { x: 260, y: 117 },
    });
    expect(model.elements['id-and']!.name).toEqual({});
  });

  it('preserves vendor extensions in place', () => {
    const { model } = importModel(readFixture('synthetic/vendor-extensions.xml'));
    const a1 = model.elements['id-a1']!;
    expect(a1.extra?.attrs).toEqual([
      { ns: 'urn:example:vendor', name: 'v:flag', value: 'element-level' },
    ]);
    expect(a1.extra?.children?.[0]?.after).toBe('documentation');
    expect(a1.properties).toHaveLength(1);
    expect(model.views['id-v1']!.extra?.xsiType).toBeNull();
    expect(model.organizationSections).toEqual([1, 1]);
    expect(model.containerExtra?.views?.children?.[0]?.xml).toContain('Custom viewpoint');
  });

  it('flags unknown types and dangling references without dropping them', () => {
    const { model, warnings } = importModel(readFixture('synthetic/dangling-and-unknown.xml'));
    expect(model.elements['id-u1']!.type).toBe('Unknown:FancyWidget');
    expect(model.relations['id-r2']!.type).toBe('Unknown:Teleports');
    const codes = new Set(warnings.map((w) => w.code));
    for (const c of [
      'unknown-type',
      'dangling-property-definition',
      'dangling-relationship-end',
      'dangling-organization-ref',
      'dangling-element-ref',
      'dangling-relationship-ref',
      'dangling-connection-end',
    ]) {
      expect(codes).toContain(c);
    }
    expect(model.views['id-v1']!.nodes.map((n) => n.id)).toContain('id-n2');
    const out = exportModel(model);
    expect(out).toContain('xsi:type="FancyWidget"');
    expect(out).toContain('elementRef="id-nowhere"');
  });

  it('reports parse errors with a position and leaves no model', () => {
    let err: unknown;
    try {
      importModel(
        '<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/">\n  <name>x</nam>\n</model>',
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ImportError);
    expect((err as ImportError).message).toMatch(/well-formed/);
  });

  it('rejects XML that is not an Exchange Format model', () => {
    expect(() => importModel('<foo/>')).toThrow(/Not an ArchiMate Exchange Format file/);
  });
});

describe('large model (5,000 elements / 200 views)', () => {
  const xml = generateLargeModel();

  it('imports and exports within budget and validates', async () => {
    const t0 = performance.now();
    const { model, warnings } = importModel(xml);
    const t1 = performance.now();
    const out = exportModel(model);
    const t2 = performance.now();
    expect(warnings).toEqual([]);
    expect(Object.keys(model.elements)).toHaveLength(5000);
    expect(model.viewOrder).toHaveLength(200);
    // jsdom is several times slower than a browser DOM; these bounds are generous.
    expect(t1 - t0).toBeLessThan(15000);
    expect(t2 - t1).toBeLessThan(15000);
    expect(importModel(out).model).toEqual(model);
    const result = await validateAgainstXsd(out);
    expect(result.errors.slice(0, 3)).toEqual([]);
  }, 120_000);
});
