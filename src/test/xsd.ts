// XSD validation for tests (spec §7.5.8, §13). Runs xmllint (WASM) against the official schemas
// in /schemas (paths relative to the repo root, where Vitest and Playwright run). Fully offline: remote schemaLocations are rewritten to the local copies.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateXML } from 'xmllint-wasm';

const SCHEMA_DIR = join(process.cwd(), 'schemas');
const ARCHIMATE_NS = 'http://www.opengroup.org/xsd/archimate/3.0/';
const DC_NS = 'http://purl.org/dc/elements/1.1/';
const VENDOR_NS = 'urn:example:vendor';

function load(file: string): string {
  return readFileSync(join(SCHEMA_DIR, file), 'utf8').replace(
    'http://www.w3.org/2001/xml.xsd',
    'xml.xsd',
  );
}

// Wrapper with no target namespace that pulls in the ArchiMate Diagram schema (which includes
// View and Model), Dublin Core (used by <metadata> in the Open Group examples) and the test-only
// vendor schema for fixtures/synthetic/vendor-extensions.xml.
const WRAPPER = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:import namespace="${ARCHIMATE_NS}" schemaLocation="archimate3_Diagram.xsd"/>
  <xs:import namespace="${DC_NS}" schemaLocation="dc.xsd"/>
  <xs:import namespace="${VENDOR_NS}" schemaLocation="vendor-ext.xsd"/>
</xs:schema>`;

let preload: { fileName: string; contents: string }[] | undefined;

export interface XsdResult {
  valid: boolean;
  errors: string[];
}

export async function validateAgainstXsd(xml: string, fileName = 'input.xml'): Promise<XsdResult> {
  preload ??= [
    'archimate3_Model.xsd',
    'archimate3_View.xsd',
    'archimate3_Diagram.xsd',
    'dc.xsd',
    'xml.xsd',
  ].map((f) => ({ fileName: f, contents: load(f) }));
  preload.push({
    fileName: 'vendor-ext.xsd',
    contents: readFileSync(join(process.cwd(), 'src/test/vendor-ext.xsd'), 'utf8'),
  });
  const result = await validateXML({
    xml: { fileName, contents: xml },
    schema: { fileName: 'wrapper.xsd', contents: WRAPPER },
    preload,
    maxMemoryPages: 16384,
  });
  return { valid: result.valid, errors: result.errors.map((e) => e.rawMessage) };
}
