// Deterministic generator for the "large model" fixture (spec §3 US-1, §12): 5,000 elements,
// 200 views. Generated on demand rather than committed; `npm run fixtures:large` writes it to
// test-data/large-model.xml (gitignored) for manual and E2E testing.

const TYPES = [
  'BusinessActor',
  'BusinessRole',
  'BusinessProcess',
  'BusinessFunction',
  'BusinessService',
  'BusinessObject',
  'ApplicationComponent',
  'ApplicationService',
  'ApplicationFunction',
  'ApplicationInterface',
  'DataObject',
  'Node',
  'Device',
  'SystemSoftware',
  'TechnologyService',
  'Artifact',
  'Capability',
  'Goal',
  'Requirement',
  'WorkPackage',
];

function parentOf(i: number): number {
  return Math.floor(i / 2);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export function generateLargeModel(elements = 5000, views = 200, nodesPerView = 25): string {
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    '<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="id-large">',
  );
  out.push('  <name xml:lang="en">Large generated model</name>');
  out.push('  <elements>');
  for (let i = 0; i < elements; i++) {
    const t = TYPES[i % TYPES.length] ?? 'BusinessActor';
    out.push(
      `    <element identifier="id-e${i}" xsi:type="${t}"><name xml:lang="en">${esc(`${t} ${i}`)}</name></element>`,
    );
  }
  out.push('  </elements>');
  out.push('  <relationships>');
  // Relationship r(i-1) links element i to its binary-tree parent floor(i/2). Association is
  // allowed between any two element types, so the model is also valid against the table (§10).
  for (let i = 1; i < elements; i++) {
    out.push(
      `    <relationship identifier="id-r${i - 1}" source="id-e${i}" target="id-e${parentOf(i)}" xsi:type="Association"/>`,
    );
  }
  out.push('  </relationships>');
  out.push('  <views>');
  out.push('    <diagrams>');
  for (let v = 0; v < views; v++) {
    out.push(`      <view identifier="id-v${v}" xsi:type="Diagram">`);
    out.push(`        <name xml:lang="en">View ${v}</name>`);
    const first = (v * nodesPerView) % elements;
    for (let n = 0; n < nodesPerView; n++) {
      const e = (first + n) % elements;
      const x = 20 + (n % 5) * 160;
      const y = 20 + Math.floor(n / 5) * 100;
      out.push(
        `        <node identifier="id-v${v}-n${n}" elementRef="id-e${e}" xsi:type="Element" x="${x}" y="${y}" w="120" h="55"/>`,
      );
    }
    // Draw r(e-1) when both e and its parent are on this view.
    for (let n = 1; n < nodesPerView; n++) {
      const e = (first + n) % elements;
      if (e === 0) continue;
      const tn = parentOf(e) - first;
      if (tn >= 0 && tn < nodesPerView && tn !== n) {
        out.push(
          `        <connection identifier="id-v${v}-c${n}" relationshipRef="id-r${e - 1}" xsi:type="Relationship" source="id-v${v}-n${n}" target="id-v${v}-n${tn}"/>`,
        );
      }
    }
    out.push('      </view>');
  }
  out.push('    </diagrams>');
  out.push('  </views>');
  out.push('</model>');
  return out.join('\n') + '\n';
}
