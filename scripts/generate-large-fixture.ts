// Writes the generated 5,000-element model to test-data/large-model.xml (see src/test/large-model.ts).
import { mkdirSync, writeFileSync } from 'node:fs';
import { generateLargeModel } from '../src/test/large-model.ts';

mkdirSync('test-data', { recursive: true });
// ~5 MB, 5,000 elements, 200 views; view 0 has 500 nodes (spec §3 US-1, §12).
const xml = generateLargeModel(5000, 200, 25, 500, 680);
writeFileSync('test-data/large-model.xml', xml);
console.log(`Wrote test-data/large-model.xml (${(xml.length / 1024 / 1024).toFixed(1)} MB)`);
