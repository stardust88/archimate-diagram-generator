// One-off converter (spec US-7): Archi's viewpoints.xml -> viewpoints.json.
//
// Source: https://github.com/archimatetool/archi/blob/master/com.archimatetool.model/model/viewpoints.xml
// (copy in scripts/data/archi-viewpoints.xml), MIT; see relationship-table.LICENSE.txt.
// Output: { source, viewpoints: { [Exchange Format viewpoint name]: concepts[] } }. Concepts may
// be "$BusinessElements$"-style macros, expanded in viewpoints.ts. An empty list = all allowed.
import { readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const xml = readFileSync('scripts/data/archi-viewpoints.xml', 'utf8');
const doc = new new JSDOM('').window.DOMParser().parseFromString(xml, 'application/xml');
const viewpoints = {};
for (const vp of Array.from(doc.getElementsByTagName('viewpoint'))) {
  const name = vp.getElementsByTagName('name')[0]?.textContent?.trim();
  if (!name) continue;
  viewpoints[name] = Array.from(vp.getElementsByTagName('concept')).map((c) =>
    c.textContent.trim(),
  );
}
writeFileSync(
  'src/notation/archimate/viewpoints.json',
  JSON.stringify(
    { source: 'Archi viewpoints.xml (MIT), https://github.com/archimatetool/archi', viewpoints },
    null,
    1,
  ) + '\n',
);
console.log(`Wrote ${Object.keys(viewpoints).length} viewpoints`);
