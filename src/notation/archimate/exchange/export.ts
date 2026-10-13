// Model -> Exchange Format XML (spec §7.5). Built with DOM APIs + XMLSerializer, then indented.
// Child order follows the XSD sequences (verified in schemas/*.xsd):
//   model:   name, documentation, ##other, properties, metadata, elements, relationships,
//            organizations*, propertyDefinitions, views
//   element: name, documentation, ##other, properties
//   view:    name, documentation, ##other, properties, node*, connection*
//   node:    label, documentation, style, viewRef, node*
//   conn.:   label, documentation, style, viewRef, sourceAttachment, bendpoint*, targetAttachment
import type {
  ContainerName,
  LangString,
  Model,
  OrgItem,
  Point,
  PreservedXml,
  Property,
  RGBA,
  Style,
  StylePart,
  View,
  ViewConnection,
  ViewNode,
} from '../../../core/model/types';
import { xsiFromType } from './mapping';
import { DEFAULT_SCHEMA_LOCATION, NS, XMLNS_NS, XML_NS, XSI_NS, indent } from './xml';

type Slot = [name: string, emit: () => void];

class Writer {
  readonly doc: XMLDocument;
  private readonly namespaces: Record<string, string>;

  constructor(private readonly model: Model) {
    this.doc = document.implementation.createDocument(NS, 'model', null);
    this.namespaces = { '': NS, xsi: XSI_NS, ...model.sourceInfo?.namespaces };
  }

  el(parent: Element, name: string): Element {
    const e = this.doc.createElementNS(NS, name);
    parent.appendChild(e);
    return e;
  }

  /** One element per language variant. `required` emits an empty one when there are none. */
  lang(parent: Element, name: string, ls: LangString | undefined, required = false): void {
    const entries = Object.entries(ls ?? {});
    if (entries.length === 0 && required) entries.push([this.model.primaryLang, '']);
    for (const [lang, value] of entries) {
      const e = this.el(parent, name);
      if (lang !== '') e.setAttributeNS(XML_NS, 'xml:lang', lang);
      e.textContent = value;
    }
  }

  xsiType(el: Element, defaultType: string, extra: PreservedXml | undefined): void {
    const t = extra?.xsiType === undefined ? defaultType : extra.xsiType;
    if (t) el.setAttributeNS(XSI_NS, 'xsi:type', t);
  }

  extraAttrs(el: Element, extra: PreservedXml | undefined): void {
    for (const a of extra?.attrs ?? []) {
      if (a.ns) el.setAttributeNS(a.ns, a.name, a.value);
      else el.setAttribute(a.name, a.value);
    }
  }

  private preserved(parent: Element, xml: string): void {
    const decls = Object.entries(this.namespaces)
      .map(([p, uri]) => `${p ? `xmlns:${p}` : 'xmlns'}="${uri.replace(/"/g, '&quot;')}"`)
      .join(' ');
    const wrap = new DOMParser().parseFromString(`<w ${decls}>${xml}</w>`, 'application/xml');
    if (wrap.getElementsByTagName('parsererror').length) return;
    for (let c = wrap.documentElement.firstElementChild; c; c = c.nextElementSibling) {
      parent.appendChild(this.doc.importNode(c, true));
    }
  }

  /** Emits known children slot by slot, re-inserting preserved children at their anchors. */
  slots(el: Element, extra: PreservedXml | undefined, slots: Slot[]): void {
    const children = extra?.children ?? [];
    const names = new Set(slots.map((s) => s[0]));
    for (const c of children) if (c.after === null) this.preserved(el, c.xml);
    for (const [name, emit] of slots) {
      emit();
      for (const c of children) if (c.after === name) this.preserved(el, c.xml);
    }
    for (const c of children) {
      if (c.after !== null && !names.has(c.after)) this.preserved(el, c.xml);
    }
  }

  properties(parent: Element, props: Property[]): void {
    if (props.length === 0) return;
    const ps = this.el(parent, 'properties');
    for (const p of props) {
      const pe = this.el(ps, 'property');
      pe.setAttribute('propertyDefinitionRef', p.definitionRef);
      this.lang(pe, 'value', p.values, true);
    }
  }

  container(
    parent: Element,
    name: ContainerName,
    hasItems: boolean,
    item: string,
    emit: (c: Element) => void,
  ): void {
    const extra = this.model.containerExtra?.[name];
    if (!hasItems && !extra) return;
    const c = this.el(parent, name);
    this.extraAttrs(c, extra);
    this.slots(c, extra, [[item, () => emit(c)]]);
  }

  color(parent: Element, name: string, c: RGBA): void {
    const e = this.el(parent, name);
    e.setAttribute('r', String(c.r));
    e.setAttribute('g', String(c.g));
    e.setAttribute('b', String(c.b));
    if (c.a !== undefined) e.setAttribute('a', String(c.a));
  }

  style(parent: Element, s: Style | undefined): void {
    if (!s) return;
    const e = this.el(parent, 'style');
    if (s.lineWidth !== undefined) e.setAttribute('lineWidth', String(s.lineWidth));
    this.extraAttrs(e, s.extra);
    const parts: Record<StylePart, () => void> = {
      fillColor: () => s.fill && this.color(e, 'fillColor', s.fill),
      lineColor: () => s.line && this.color(e, 'lineColor', s.line),
      font: () => {
        const f = s.font;
        if (!f) return;
        const fe = this.el(e, 'font');
        if (f.name !== undefined) fe.setAttribute('name', f.name);
        if (f.size !== undefined) fe.setAttribute('size', String(f.size));
        if (f.style !== undefined) fe.setAttribute('style', f.style);
        if (f.color) this.color(fe, 'color', f.color);
      },
    };
    const order: StylePart[] = [...(s.order ?? [])];
    for (const p of ['fillColor', 'lineColor', 'font'] as const)
      if (!order.includes(p)) order.push(p);
    this.slots(
      e,
      s.extra,
      order.map((p) => [p, parts[p]]),
    );
  }

  point(parent: Element, name: string, p: Point | undefined): void {
    if (!p) return;
    const e = this.el(parent, name);
    e.setAttribute('x', String(Math.round(p.x)));
    e.setAttribute('y', String(Math.round(p.y)));
  }

  orgItem(parent: Element, it: OrgItem): void {
    const e = this.el(parent, 'item');
    if (it.identifier !== undefined) e.setAttribute('identifier', it.identifier);
    if (it.ref !== undefined) e.setAttribute('identifierRef', it.ref);
    this.extraAttrs(e, it.extra);
    this.slots(e, it.extra, [
      ['label', () => this.lang(e, 'label', it.label)],
      ['documentation', () => this.lang(e, 'documentation', it.documentation)],
      ['item', () => it.items.forEach((c) => this.orgItem(e, c))],
    ]);
  }

  node(parent: Element, n: ViewNode, children: Map<string, ViewNode[]>): void {
    const e = this.el(parent, 'node');
    e.setAttribute('identifier', n.id);
    const defaultType =
      n.kind === 'element' ? 'Element' : n.kind === 'label' ? 'Label' : 'Container';
    this.xsiType(e, defaultType, n.extra);
    if (n.kind === 'element') e.setAttribute('elementRef', n.elementRef);
    e.setAttribute('x', String(Math.max(0, Math.round(n.x))));
    e.setAttribute('y', String(Math.max(0, Math.round(n.y))));
    e.setAttribute('w', String(Math.max(1, Math.round(n.w))));
    e.setAttribute('h', String(Math.max(1, Math.round(n.h))));
    this.extraAttrs(e, n.extra);
    this.slots(e, n.extra, [
      ['label', () => this.lang(e, 'label', n.label)],
      ['documentation', () => this.lang(e, 'documentation', n.documentation)],
      ['style', () => this.style(e, n.style)],
      ['node', () => (children.get(n.id) ?? []).forEach((c) => this.node(e, c, children))],
    ]);
  }

  connection(parent: Element, c: ViewConnection): void {
    const e = this.el(parent, 'connection');
    e.setAttribute('identifier', c.id);
    this.xsiType(e, c.kind === 'relationship' ? 'Relationship' : 'Line', c.extra);
    if (c.relationshipRef !== undefined) e.setAttribute('relationshipRef', c.relationshipRef);
    if (c.source !== '') e.setAttribute('source', c.source);
    if (c.target !== '') e.setAttribute('target', c.target);
    this.extraAttrs(e, c.extra);
    this.slots(e, c.extra, [
      ['label', () => this.lang(e, 'label', c.label)],
      ['documentation', () => this.lang(e, 'documentation', c.documentation)],
      ['style', () => this.style(e, c.style)],
      ['sourceAttachment', () => this.point(e, 'sourceAttachment', c.sourceAttachment)],
      ['bendpoint', () => c.bendpoints.forEach((p) => this.point(e, 'bendpoint', p))],
      ['targetAttachment', () => this.point(e, 'targetAttachment', c.targetAttachment)],
    ]);
  }

  view(parent: Element, v: View): void {
    const e = this.el(parent, 'view');
    e.setAttribute('identifier', v.id);
    this.xsiType(e, 'Diagram', v.extra);
    if (v.viewpoint !== undefined) e.setAttribute('viewpoint', v.viewpoint);
    this.extraAttrs(e, v.extra);
    const children = new Map<string, ViewNode[]>();
    const ids = new Set(v.nodes.map((n) => n.id));
    const roots: ViewNode[] = [];
    for (const n of v.nodes) {
      if (n.parent !== undefined && ids.has(n.parent)) {
        const list = children.get(n.parent) ?? [];
        list.push(n);
        children.set(n.parent, list);
      } else roots.push(n);
    }
    this.slots(e, v.extra, [
      ['name', () => this.lang(e, 'name', v.name, true)],
      ['documentation', () => this.lang(e, 'documentation', v.documentation)],
      ['properties', () => this.properties(e, v.properties)],
      ['node', () => roots.forEach((n) => this.node(e, n, children))],
      ['connection', () => v.connections.forEach((c) => this.connection(e, c))],
    ]);
  }

  rootAttributes(root: Element): void {
    for (const [prefix, uri] of Object.entries(this.namespaces)) {
      if (prefix === '') continue;
      root.setAttributeNS(XMLNS_NS, `xmlns:${prefix}`, uri);
    }
    const attrs = { ...this.model.sourceInfo?.rootAttributes };
    if (!this.model.sourceInfo) attrs['xsi:schemaLocation'] = DEFAULT_SCHEMA_LOCATION;
    for (const [name, value] of Object.entries(attrs)) {
      const i = name.indexOf(':');
      const ns = i >= 0 ? this.namespaces[name.slice(0, i)] : undefined;
      if (ns) root.setAttributeNS(ns, name, value);
      else root.setAttribute(name, value);
    }
    root.setAttribute('identifier', this.model.id);
  }

  write(): string {
    const m = this.model;
    const root = this.doc.documentElement;
    this.rootAttributes(root);
    this.extraAttrs(root, m.extra);
    const sections = m.organizationSections;
    this.slots(root, m.extra, [
      ['name', () => this.lang(root, 'name', m.name, true)],
      ['documentation', () => this.lang(root, 'documentation', m.documentation)],
      ['properties', () => this.properties(root, m.properties)],
      ['metadata', () => m.metadata !== undefined && this.preserved(root, m.metadata)],
      [
        'elements',
        () =>
          this.container(root, 'elements', Object.keys(m.elements).length > 0, 'element', (c) => {
            for (const el of Object.values(m.elements)) {
              const e = this.el(c, 'element');
              e.setAttribute('identifier', el.id);
              this.xsiType(e, xsiFromType(el.type), el.extra);
              this.extraAttrs(e, el.extra);
              const junction = el.type === 'AndJunction' || el.type === 'OrJunction';
              this.slots(e, el.extra, [
                ['name', () => this.lang(e, 'name', el.name, !junction)],
                ['documentation', () => this.lang(e, 'documentation', el.documentation)],
                ['properties', () => this.properties(e, el.properties)],
              ]);
            }
          }),
      ],
      [
        'relationships',
        () =>
          this.container(
            root,
            'relationships',
            Object.keys(m.relations).length > 0,
            'relationship',
            (c) => {
              for (const r of Object.values(m.relations)) {
                const e = this.el(c, 'relationship');
                e.setAttribute('identifier', r.id);
                e.setAttribute('source', r.source);
                e.setAttribute('target', r.target);
                this.xsiType(e, xsiFromType(r.type), r.extra);
                if (r.accessType !== undefined) e.setAttribute('accessType', r.accessType);
                if (r.modifier !== undefined) e.setAttribute('modifier', r.modifier);
                if (r.isDirected !== undefined) e.setAttribute('isDirected', String(r.isDirected));
                this.extraAttrs(e, r.extra);
                this.slots(e, r.extra, [
                  ['name', () => this.lang(e, 'name', r.name)],
                  ['documentation', () => this.lang(e, 'documentation', r.documentation)],
                  ['properties', () => this.properties(e, r.properties)],
                ]);
              }
            },
          ),
      ],
      [
        'organizations',
        () => {
          const counts = sections ?? [m.organizations.length];
          let at = 0;
          counts.forEach((n, i) => {
            const items = m.organizations.slice(at, i === counts.length - 1 ? undefined : at + n);
            at += n;
            this.container(root, 'organizations', items.length > 0, 'item', (c) =>
              items.forEach((it) => this.orgItem(c, it)),
            );
          });
        },
      ],
      [
        'propertyDefinitions',
        () =>
          this.container(
            root,
            'propertyDefinitions',
            m.propertyDefinitions.length > 0,
            'propertyDefinition',
            (c) => {
              for (const d of m.propertyDefinitions) {
                const e = this.el(c, 'propertyDefinition');
                e.setAttribute('identifier', d.id);
                e.setAttribute('type', d.type);
                this.extraAttrs(e, d.extra);
                this.slots(e, d.extra, [
                  ['name', () => this.lang(e, 'name', d.name, true)],
                  ['documentation', () => this.lang(e, 'documentation', d.documentation)],
                ]);
              }
            },
          ),
      ],
      [
        'views',
        () =>
          this.container(root, 'views', m.viewOrder.length > 0, 'diagrams', (vs) =>
            this.container(vs, 'diagrams', m.viewOrder.length > 0, 'view', (d) => {
              for (const id of m.viewOrder) {
                const v = m.views[id];
                if (v) this.view(d, v);
              }
            }),
          ),
      ],
    ]);
    indent(root);
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      new XMLSerializer().serializeToString(this.doc) +
      '\n'
    );
  }
}

export function exportModel(model: Model): string {
  return new Writer(model).write();
}
