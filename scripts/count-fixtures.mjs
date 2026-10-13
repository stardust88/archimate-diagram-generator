// Writes fixtures/expected.json: element/relationship/view/node/connection counts per fixture,
// computed with plain text matching, independently of the importer under test (spec §13).
// Flags (xsdInvalid, minWarnings) already in the file are kept.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIR = 'fixtures';
const OUT = join(DIR, 'expected.json');
const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : n.endsWith('.xml') ? [p] : [];
  });

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const out = {};
for (const f of walk(DIR).sort()) {
  const t = readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const count = (re) => (t.match(re) ?? []).length;
  const key = relative(DIR, f).split(sep).join('/');
  const { xsdInvalid, minWarnings } = previous[key] ?? {};
  out[key] = {
    elements: count(/<element\s/g),
    relations: count(/<relationship\s/g),
    views: count(/<view\s/g),
    nodes: count(/<node\s/g),
    connections: count(/<connection\s/g),
    ...(xsdInvalid ? { xsdInvalid } : {}),
    ...(minWarnings ? { minWarnings } : {}),
  };
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${Object.keys(out).length} entries to ${OUT}`);
