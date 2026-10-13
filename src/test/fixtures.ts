// Fixture discovery for tests. Every .xml under /fixtures takes part in the round-trip tests;
// fixtures/expected.json lists hand-computed counts and which files are expected to fail XSD
// validation on purpose (e.g. dangling references).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const FIXTURE_DIR = join(__dirname, '../../fixtures');

export interface FixtureExpectation {
  elements: number;
  relations: number;
  views: number;
  nodes: number;
  connections: number;
  /** Set when the file is intentionally not XSD-valid. */
  xsdInvalid?: boolean;
  /** Minimum number of import warnings expected. */
  minWarnings?: number;
}

export function fixtureFiles(dir = FIXTURE_DIR): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...fixtureFiles(p));
    else if (name.endsWith('.xml')) out.push(relative(FIXTURE_DIR, p).replace(/\\/g, '/'));
  }
  return out;
}

export function readFixture(rel: string): string {
  return readFileSync(join(FIXTURE_DIR, rel), 'utf8');
}

export function expectations(): Record<string, FixtureExpectation> {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, 'expected.json'), 'utf8')) as Record<
    string,
    FixtureExpectation
  >;
}
