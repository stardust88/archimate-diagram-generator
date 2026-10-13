// Verifies catalog spellings against the XSD enumerations (spec §8.1 "verify") and spot-checks the
// relationship table (spec §13 validator tests).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { importModel } from './exchange/import';
import { readFixture } from '../../test/fixtures';
import { ELEMENT_TYPES } from './catalog';
import { ICONS } from './icons';
import { RELATIONSHIP_TYPES } from './relationships';
import tableJson from './relationship-table.json';
import { allowedRelationships, isAllowed, validateModel } from './validation';

function enumeration(name: string): string[] {
  const xsd = readFileSync(join(__dirname, '../../../schemas/archimate3_Model.xsd'), 'utf8');
  const doc = new DOMParser().parseFromString(xsd, 'application/xml');
  const XS = 'http://www.w3.org/2001/XMLSchema';
  const st = Array.from(doc.getElementsByTagNameNS(XS, 'simpleType')).find(
    (e) => e.getAttribute('name') === name,
  );
  return Array.from(st!.getElementsByTagNameNS(XS, 'enumeration')).map(
    (e) => e.getAttribute('value') ?? '',
  );
}

describe('catalog', () => {
  it('element types match the XSD ElementTypeEnum exactly', () => {
    expect(ELEMENT_TYPES.map((d) => d.type).sort()).toEqual(enumeration('ElementTypeEnum').sort());
  });

  it('relationship types match the XSD RelationshipTypeEnum exactly', () => {
    expect(RELATIONSHIP_TYPES.map((d) => d.type).sort()).toEqual(
      enumeration('RelationshipTypeEnum').sort(),
    );
  });

  it('every element type has a row and a column in the relationship table', () => {
    const table = (tableJson as { table: Record<string, Record<string, string>> }).table;
    for (const d of ELEMENT_TYPES) {
      expect(table[d.type], d.type).toBeDefined();
      expect(table.BusinessActor![d.type], d.type).toBeDefined();
    }
  });

  it('has a real icon for every type except the special figures (§8.4)', () => {
    const missing = ELEMENT_TYPES.filter((d) => !ICONS[d.icon]).map((d) => d.type);
    expect(missing).toEqual(['Grouping', 'AndJunction', 'OrJunction']);
  });

  it('applies box shapes by aspect (§8.2)', () => {
    const by = Object.fromEntries(ELEMENT_TYPES.map((d) => [d.type, d.box]));
    expect(by.BusinessActor).toBe('rect');
    expect(by.BusinessProcess).toBe('rounded');
    expect(by.Goal).toBe('cut');
    expect(by.Product).toBe('rect');
  });
});

describe('relationship table', () => {
  it.each([
    ['Serving', 'BusinessService', 'BusinessActor'],
    ['Assignment', 'BusinessActor', 'BusinessRole'],
    ['Realization', 'ApplicationComponent', 'ApplicationService'],
    ['Access', 'ApplicationFunction', 'DataObject'],
    ['Triggering', 'BusinessProcess', 'BusinessEvent'],
    ['Composition', 'Node', 'Device'],
    ['Influence', 'Driver', 'Goal'],
    ['Association', 'BusinessActor', 'DataObject'],
    ['Specialization', 'BusinessActor', 'BusinessActor'],
    ['Aggregation', 'Plateau', 'Relationship'],
    ['Association', 'BusinessObject', 'Relationship'],
  ])('allows %s from %s to %s', (rel, s, t) => {
    expect(isAllowed(rel, s, t)).toBe(true);
  });

  it.each([
    ['Triggering', 'DataObject', 'BusinessActor'],
    ['Access', 'DataObject', 'ApplicationFunction'],
    ['Serving', 'DataObject', 'BusinessActor'],
    ['Specialization', 'BusinessActor', 'BusinessRole'],
    ['Composition', 'BusinessObject', 'Relationship'],
    ['Assignment', 'Goal', 'BusinessActor'],
  ])('rejects %s from %s to %s', (rel, s, t) => {
    expect(isAllowed(rel, s, t)).toBe(false);
  });

  it('allows everything for unknown types', () => {
    expect(allowedRelationships('Unknown:Widget', 'BusinessActor')).toHaveLength(11);
  });
});

describe('validateModel', () => {
  it('flags the invalid relationship in the dangling fixture', () => {
    const { model } = importModel(readFixture('synthetic/dangling-and-unknown.xml'));
    const w = validateModel(model);
    expect(w.filter((x) => x.code === 'invalid-relationship').map((x) => x.id)).toEqual(['id-r3']);
  });

  it('accepts the junction fixture and catches mixed junction types', () => {
    const { model } = importModel(readFixture('synthetic/junctions-labels-containers.xml'));
    expect(validateModel(model)).toEqual([]);
    model.relations['id-t2']!.type = 'Flow';
    expect(validateModel(model).map((w) => w.code)).toContain('junction-mixed-types');
  });

  it.each([
    'opengroup/interop-snippet-01.xml',
    'opengroup/interop-snippet-05.xml',
    'archi/bendpoint.test.xml',
  ])('finds no problems in real file %s', (f) => {
    expect(validateModel(importModel(readFixture(f)).model)).toEqual([]);
  });
});
