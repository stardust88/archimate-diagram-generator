// Canonical XML form for round-trip comparison (spec §7.4): sorted attributes, whitespace-only
// text dropped, namespace declarations and prefixes ignored (names compared as {uri}local).
// Comments and processing instructions are ignored too: they are not model data.

export interface CanonNode {
  name: string;
  attrs: [string, string][];
  children: (CanonNode | string)[];
}

const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';

function qname(ns: string | null, local: string): string {
  return ns ? `{${ns}}${local}` : local;
}

function canonElement(el: Element): CanonNode {
  const attrs: [string, string][] = [];
  for (const a of Array.from(el.attributes)) {
    if (a.namespaceURI === XMLNS_NS) continue;
    let value = a.value;
    // xsi:type is a QName: compare its local part so prefix choice does not matter.
    if (a.namespaceURI === XSI_NS && a.localName === 'type') value = value.replace(/^[^:]*:/, '');
    // xsi:schemaLocation is a whitespace-separated list.
    if (a.namespaceURI === XSI_NS && a.localName === 'schemaLocation')
      value = value.trim().split(/\s+/).join(' ');
    attrs.push([qname(a.namespaceURI, a.localName), value]);
  }
  attrs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const children: (CanonNode | string)[] = [];
  const hasText = Array.from(el.childNodes).some(
    (n) => (n.nodeType === 3 || n.nodeType === 4) && n.nodeValue?.trim(),
  );
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 1) children.push(canonElement(n as Element));
    else if ((n.nodeType === 3 || n.nodeType === 4) && hasText) {
      const prev = children[children.length - 1];
      if (typeof prev === 'string') children[children.length - 1] = prev + (n.nodeValue ?? '');
      else children.push(n.nodeValue ?? '');
    }
  }
  return { name: qname(el.namespaceURI, el.localName), attrs, children };
}

export function canonicalize(xml: string): CanonNode {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return canonElement(doc.documentElement);
}
