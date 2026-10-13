// Writes the generated 5,000-element model to test-data/large-model.xml (see src/test/large-model.ts).
import { mkdirSync, writeFileSync } from 'node:fs';
import { generateLargeModel } from '../src/test/large-model.ts';

mkdirSync('test-data', { recursive: true });
const xml = generateLargeModel();
writeFileSync('test-data/large-model.xml', xml);
console.log(`Wrote test-data/large-model.xml (${(xml.length / 1024 / 1024).toFixed(1)} MB)`);
