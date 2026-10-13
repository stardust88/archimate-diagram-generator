// One-off converter (spec §10): Archi's relationships.xml -> relationship-table.json.
//
// Source: https://github.com/archimatetool/archi/blob/master/com.archimatetool.model/model/relationships.xml
// (copy in scripts/data/archi-relationships.xml). Archi is MIT-licensed; the notice is kept in
// src/notation/archimate/relationship-table.LICENSE.txt next to the derived data.
//
// Output shape: { source, version, table: { [sourceType]: { [targetType]: letters } } }.
// Archi's "Junction" concept is expanded to AndJunction and OrJunction; "Relationship" is kept as
// the key for relationship-to-relationship rules.
import { readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const IN = 'scripts/data/archi-relationships.xml';
const OUT = 'src/notation/archimate/relationship-table.json';

const xml = readFileSync(IN, 'utf8');
const doc = new new JSDOM('').window.DOMParser().parseFromString(xml, 'application/xml');
const root = doc.documentElement;
const expand = (c) => (c === 'Junction' ? ['AndJunction', 'OrJunction'] : [c]);

const table = {};
for (const src of Array.from(root.getElementsByTagName('source'))) {
  for (const s of expand(src.getAttribute('concept'))) {
    const row = (table[s] ??= {});
    for (const tgt of Array.from(src.getElementsByTagName('target'))) {
      const letters = tgt.getAttribute('relations') ?? '';
      for (const t of expand(tgt.getAttribute('concept'))) row[t] = letters;
    }
  }
}

const out = {
  source: 'Archi relationships.xml (MIT), https://github.com/archimatetool/archi',
  version: root.getAttribute('version'),
  table,
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`Wrote ${OUT}: ${Object.keys(table).length} source types, ArchiMate ${out.version}`);
