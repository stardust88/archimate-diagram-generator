// Exchange Format XML -> Model (spec §7.3). Never touches React. Unrecognized content is kept in
// `extra` (§7.4); semantic problems become warnings, never data loss.
import type {
  ContainerName,
  Element as ModelElement,
  FontStyle,
  Id,
  LangString,
  Model,
  OrgItem,
  Point,
  PreservedXml,
  Property,
  PropertyDefinition,
  PropertyType,
  Relation,
  RGBA,
  Style,
  StylePart,
  View,
  ViewConnection,
  ViewNode,
} from '../../../core/model/types';
import { checkReferences, type ModelWarning } from '../../../core/model/references';
import { elementTypeFromXsi, relationshipTypeFromXsi } from './mapping';
import {
  ExtraBuilder,
  NS,
  XMLNS_NS,
  childElements,
  langOf,
  readChildren,
  serializePreserved,
  xsiTypeOf,
} from './xml';

export type ImportWarning = ModelWarning;

export interface ImportResult {
  model: Model;
  warnings: ImportWarning[];
}

export class ImportError extends Error {
  readonly line?: number;
  readonly column?: number;
  constructor(message: string, line?: number, column?: number) {
    super(message);
    this.name = 'ImportError';
    this.line = line;
    this.column = column;
  }
}

const PROPERTY_TYPES = new Set<PropertyType>([
  'string',
  'boolean',
  'currency',
  'date',
  'time',
  'number',
]);
const ACCESS_TYPES = new Set(['Access', 'Read', 'Write', 'ReadWrite']);

function parse(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) {
    const msg = (err.textContent ?? 'XML parse error').trim();
    const line = /line[^\d]{0,12}(\d+)/i.exec(msg)?.[1];
    const col = /column[^\d]{0,12}(\d+)/i.exec(msg)?.[1];
    throw new ImportError(
      `The file is not well-formed XML: ${msg.split('\n')[0]}`,
      line ? Number(line) : undefined,
      col ? Number(col) : undefined,
    );
  }
  return doc;
}

class Reader {
  readonly warnings: ImportWarning[] = [];
  readonly nameLangs = new Map<string, number>();
  readonly containerExtra: Partial<Record<ContainerName, PreservedXml>> = {};

  warn(code: string, message: string, id?: string): void {
    this.warnings.push({ code, message, id });
  }

  /** Adds an `<name>`-like element to a LangString; returns false on a duplicate language. */
  lang(target: LangString, el: Element, countForPrimary = false): boolean {
    const lang = langOf(el);
    if (Object.hasOwn(target, lang)) return false;
    target[lang] = el.textContent ?? '';
    if (countForPrimary) this.nameLangs.set(lang, (this.nameLangs.get(lang) ?? 0) + 1);
    return true;
  }

  langHandler(
    get: () => LangString | undefined,
    set: (ls: LangString) => void,
    countForPrimary = false,
  ): (c: Element) => boolean {
    return (c) => {
      let ls = get();
      if (!ls) {
        ls = {};
        set(ls);
      }
      return this.lang(ls, c, countForPrimary);
    };
  }

  properties(el: Element, out: Property[]): void {
    for (const p of childElements(el)) {
      if (p.namespaceURI !== NS || p.localName !== 'property') continue;
      const values: LangString = {};
      for (const v of childElements(p)) if (v.localName === 'value') this.lang(values, v);
      out.push({ definitionRef: p.getAttribute('propertyDefinitionRef') ?? '', values });
    }
  }

  propsHandler(out: Property[]): (c: Element) => void {
    return (c) => this.properties(c, out);
  }

  container(
    name: ContainerName,
    el: Element,
    itemName: string,
    read: (c: Element) => boolean,
  ): void {
    const extra = new ExtraBuilder();
    extra.attributes(el, new Set());
    readChildren(el, { [itemName]: read }, extra);
    const built = extra.build();
    if (built) this.containerExtra[name] = built;
  }

  element(el: Element, model: Model): boolean {
    const id = el.getAttribute('identifier');
    if (!id || Object.hasOwn(model.elements, id)) {
      this.warn(
        id ? 'duplicate-id' : 'missing-id',
        `Element ${id ?? '(no identifier)'} kept as-is but not editable: ${id ? 'duplicate identifier' : 'missing identifier'}.`,
        id ?? undefined,
      );
      return false;
    }
    const xsi = xsiTypeOf(el);
    const extra = new ExtraBuilder();
    if (xsi === null) extra.setXsiType(null);
    const type = elementTypeFromXsi(xsi ?? '');
    if (type.startsWith('Unknown:'))
      this.warn(
        'unknown-type',
        `Unknown element type "${xsi ?? ''}" on ${id}; shown as a grey box and exported unchanged.`,
        id,
      );
    const e: ModelElement = { id, type, name: {}, properties: [] };
    extra.attributes(el, new Set(['identifier']));
    readChildren(
      el,
      {
        name: (c) => this.lang(e.name, c, true),
        documentation: this.langHandler(
          () => e.documentation,
          (v) => (e.documentation = v),
        ),
        properties: this.propsHandler(e.properties),
      },
      extra,
    );
    const x = extra.build();
    if (x) e.extra = x;
    model.elements[id] = e;
    return true;
  }

  relationship(el: Element, model: Model): boolean {
    const id = el.getAttribute('identifier');
    if (!id || Object.hasOwn(model.relations, id) || Object.hasOwn(model.elements, id)) {
      this.warn(
        id ? 'duplicate-id' : 'missing-id',
        `Relationship ${id ?? '(no identifier)'} kept as-is but not editable.`,
        id ?? undefined,
      );
      return false;
    }
    const xsi = xsiTypeOf(el);
    const extra = new ExtraBuilder();
    if (xsi === null) extra.setXsiType(null);
    const type = relationshipTypeFromXsi(xsi ?? '');
    if (type.startsWith('Unknown:'))
      this.warn(
        'unknown-type',
        `Unknown relationship type "${xsi ?? ''}" on ${id}; exported unchanged.`,
        id,
      );
    const r: Relation = {
      id,
      type,
      source: el.getAttribute('source') ?? '',
      target: el.getAttribute('target') ?? '',
      properties: [],
    };
    const known = new Set(['identifier', 'source', 'target']);
    if (type === 'Access' && el.hasAttribute('accessType')) {
      const v = el.getAttribute('accessType') ?? '';
      if (ACCESS_TYPES.has(v)) {
        r.accessType = v as Relation['accessType'];
        known.add('accessType');
      }
    }
    if (type === 'Influence' && el.hasAttribute('modifier')) {
      r.modifier = el.getAttribute('modifier') ?? '';
      known.add('modifier');
    }
    if (type === 'Association' && el.hasAttribute('isDirected')) {
      const v = el.getAttribute('isDirected');
      if (v === 'true' || v === 'false') {
        r.isDirected = v === 'true';
        known.add('isDirected');
      }
    }
    extra.attributes(el, known);
    readChildren(
      el,
      {
        name: this.langHandler(
          () => r.name,
          (v) => (r.name = v),
          true,
        ),
        documentation: this.langHandler(
          () => r.documentation,
          (v) => (r.documentation = v),
        ),
        properties: this.propsHandler(r.properties),
      },
      extra,
    );
    const x = extra.build();
    if (x) r.extra = x;
    model.relations[id] = r;
    return true;
  }

  orgItem(el: Element): OrgItem {
    const item: OrgItem = { items: [] };
    const id = el.getAttribute('identifier');
    if (id !== null) item.identifier = id;
    const ref = el.getAttribute('identifierRef');
    if (ref !== null) item.ref = ref;
    const extra = new ExtraBuilder();
    extra.attributes(el, new Set(['identifier', 'identifierRef']));
    readChildren(
      el,
      {
        label: this.langHandler(
          () => item.label,
          (v) => (item.label = v),
        ),
        documentation: this.langHandler(
          () => item.documentation,
          (v) => (item.documentation = v),
        ),
        item: (c) => void item.items.push(this.orgItem(c)),
      },
      extra,
    );
    const x = extra.build();
    if (x) item.extra = x;
    return item;
  }

  propertyDefinition(el: Element, model: Model): boolean {
    const id = el.getAttribute('identifier');
    if (!id) return false;
    const t = el.getAttribute('type') ?? 'string';
    const extra = new ExtraBuilder();
    const known = new Set(['identifier']);
    if (PROPERTY_TYPES.has(t as PropertyType)) known.add('type');
    else
      this.warn(
        'bad-property-type',
        `Property definition ${id} has unknown type "${t}"; kept as-is.`,
        id,
      );
    const def: PropertyDefinition = {
      id,
      name: {},
      type: PROPERTY_TYPES.has(t as PropertyType) ? (t as PropertyType) : 'string',
    };
    extra.attributes(el, known);
    readChildren(
      el,
      {
        name: (c) => this.lang(def.name, c),
        documentation: this.langHandler(
          () => def.documentation,
          (v) => (def.documentation = v),
        ),
      },
      extra,
    );
    const x = extra.build();
    if (x) def.extra = x;
    model.propertyDefinitions.push(def);
    return true;
  }

  color(el: Element): RGBA {
    const c: RGBA = {
      r: Number(el.getAttribute('r') ?? 0),
      g: Number(el.getAttribute('g') ?? 0),
      b: Number(el.getAttribute('b') ?? 0),
    };
    if (el.hasAttribute('a')) c.a = Number(el.getAttribute('a'));
    return c;
  }

  style(el: Element): Style {
    const s: Style = {};
    if (el.hasAttribute('lineWidth')) s.lineWidth = Number(el.getAttribute('lineWidth'));
    const extra = new ExtraBuilder();
    extra.attributes(el, new Set(['lineWidth']));
    readChildren(
      el,
      {
        fillColor: (c) => void (s.fill = this.color(c)),
        lineColor: (c) => void (s.line = this.color(c)),
        font: (c) => {
          const f: FontStyle = {};
          if (c.hasAttribute('name')) f.name = c.getAttribute('name') ?? '';
          if (c.hasAttribute('size')) f.size = Number(c.getAttribute('size'));
          if (c.hasAttribute('style')) f.style = c.getAttribute('style') ?? '';
          for (const cc of childElements(c)) if (cc.localName === 'color') f.color = this.color(cc);
          s.font = f;
        },
      },
      extra,
    );
    const order = childElements(el)
      .map((c) => c.localName)
      .filter((n): n is StylePart => n === 'fillColor' || n === 'lineColor' || n === 'font');
    const canonical = (['fillColor', 'lineColor', 'font'] as const).filter((p) =>
      order.includes(p),
    );
    if (order.join() !== canonical.join()) s.order = order;
    const x = extra.build();
    if (x) s.extra = x;
    return s;
  }

  node(el: Element, out: ViewNode[], parent: Id | undefined): boolean {
    const id = el.getAttribute('identifier');
    if (!id) return false;
    const xsi = xsiTypeOf(el);
    const extra = new ExtraBuilder();
    const known = new Set(['identifier', 'x', 'y', 'w', 'h']);
    const elementRef = el.getAttribute('elementRef');
    let kind: ViewNode['kind'];
    if (xsi === 'Element' || (xsi === null && elementRef !== null)) kind = 'element';
    else if (xsi === 'Label') kind = 'label';
    else kind = 'container';
    if (xsi === null) extra.setXsiType(null);
    else if (!['Element', 'Label', 'Container'].includes(xsi)) {
      extra.setXsiType(xsi);
      this.warn(
        'unknown-node-type',
        `View node ${id} has unknown type "${xsi}"; shown as a plain box.`,
        id,
      );
    }
    const base = {
      id,
      x: Number(el.getAttribute('x') ?? 0),
      y: Number(el.getAttribute('y') ?? 0),
      w: Number(el.getAttribute('w') ?? 120),
      h: Number(el.getAttribute('h') ?? 55),
      ...(parent ? { parent } : {}),
    };
    let node: ViewNode;
    if (kind === 'element') {
      known.add('elementRef');
      node = { kind, elementRef: elementRef ?? '', ...base };
    } else node = { kind, ...base };
    out.push(node);
    extra.attributes(el, known);
    readChildren(
      el,
      {
        label: this.langHandler(
          () => node.label,
          (v) => (node.label = v),
        ),
        documentation: this.langHandler(
          () => node.documentation,
          (v) => (node.documentation = v),
        ),
        style: (c) => void (node.style = this.style(c)),
        node: (c) => this.node(c, out, id),
      },
      extra,
    );
    const x = extra.build();
    if (x) node.extra = x;
    return true;
  }

  point(el: Element): Point {
    return { x: Number(el.getAttribute('x') ?? 0), y: Number(el.getAttribute('y') ?? 0) };
  }

  connection(el: Element, out: ViewConnection[]): boolean {
    const id = el.getAttribute('identifier');
    if (!id) return false;
    const xsi = xsiTypeOf(el);
    const extra = new ExtraBuilder();
    const relRef = el.getAttribute('relationshipRef');
    let kind: ViewConnection['kind'];
    if (xsi === 'Relationship' || xsi === 'NestingRelationship') kind = 'relationship';
    else if (xsi === 'Line') kind = 'line';
    else kind = relRef !== null ? 'relationship' : 'line';
    if (xsi === null) extra.setXsiType(null);
    else if (xsi !== 'Relationship' && xsi !== 'Line') extra.setXsiType(xsi);
    if (xsi !== null && !['Relationship', 'NestingRelationship', 'Line'].includes(xsi)) {
      this.warn('unknown-connection-type', `Connection ${id} has unknown type "${xsi}".`, id);
    }
    const c: ViewConnection = {
      id,
      kind,
      source: el.getAttribute('source') ?? '',
      target: el.getAttribute('target') ?? '',
      bendpoints: [],
    };
    const known = new Set(['identifier', 'source', 'target']);
    if (kind === 'relationship' && relRef !== null) {
      c.relationshipRef = relRef;
      known.add('relationshipRef');
    }
    extra.attributes(el, known);
    readChildren(
      el,
      {
        label: this.langHandler(
          () => c.label,
          (v) => (c.label = v),
        ),
        documentation: this.langHandler(
          () => c.documentation,
          (v) => (c.documentation = v),
        ),
        style: (s) => void (c.style = this.style(s)),
        sourceAttachment: (p) => void (c.sourceAttachment = this.point(p)),
        bendpoint: (p) => void c.bendpoints.push(this.point(p)),
        targetAttachment: (p) => void (c.targetAttachment = this.point(p)),
      },
      extra,
    );
    const x = extra.build();
    if (x) c.extra = x;
    out.push(c);
    return true;
  }

  view(el: Element, model: Model): boolean {
    const id = el.getAttribute('identifier');
    if (!id || Object.hasOwn(model.views, id)) return false;
    const xsi = xsiTypeOf(el);
    const extra = new ExtraBuilder();
    if (xsi === null) extra.setXsiType(null);
    else if (xsi !== 'Diagram') extra.setXsiType(xsi);
    const v: View = { id, name: {}, properties: [], nodes: [], connections: [] };
    const known = new Set(['identifier']);
    if (el.hasAttribute('viewpoint')) {
      v.viewpoint = el.getAttribute('viewpoint') ?? '';
      known.add('viewpoint');
    }
    extra.attributes(el, known);
    readChildren(
      el,
      {
        name: (c) => this.lang(v.name, c, true),
        documentation: this.langHandler(
          () => v.documentation,
          (d) => (v.documentation = d),
        ),
        properties: this.propsHandler(v.properties),
        node: (c) => this.node(c, v.nodes, undefined),
        connection: (c) => this.connection(c, v.connections),
      },
      extra,
    );
    const x = extra.build();
    if (x) v.extra = x;
    model.views[id] = v;
    model.viewOrder.push(id);
    return true;
  }
}

export function importModel(xml: string, fileName?: string): ImportResult {
  const doc = parse(xml);
  const root = doc.documentElement;
  if (root.namespaceURI !== NS || root.localName !== 'model') {
    throw new ImportError(
      `Not an ArchiMate Exchange Format file: expected <model> in namespace ${NS}, found <${root.localName}>` +
        (root.namespaceURI ? ` in ${root.namespaceURI}` : ' with no namespace') +
        '.',
    );
  }
  const rd = new Reader();
  const model: Model = {
    id: root.getAttribute('identifier') ?? '',
    name: {},
    properties: [],
    propertyDefinitions: [],
    elements: {},
    relations: {},
    organizations: [],
    views: {},
    viewOrder: [],
    primaryLang: '',
  };

  const namespaces: Record<string, string> = {};
  const rootAttributes: Record<string, string> = {};
  for (const a of Array.from(root.attributes)) {
    if (a.namespaceURI === XMLNS_NS) namespaces[a.prefix ? a.localName : ''] = a.value;
    else if (a.name !== 'identifier') rootAttributes[a.name] = a.value;
  }
  model.sourceInfo = { rootAttributes, namespaces, ...(fileName ? { fileName } : {}) };

  const orgSections: number[] = [];
  const extra = new ExtraBuilder();
  readChildren(
    root,
    {
      name: (c) => rd.lang(model.name, c, true),
      documentation: rd.langHandler(
        () => model.documentation,
        (v) => (model.documentation = v),
      ),
      properties: rd.propsHandler(model.properties),
      metadata: (c) => {
        if (model.metadata !== undefined) return false;
        model.metadata = serializePreserved(c);
      },
      elements: (c) => rd.container('elements', c, 'element', (e) => rd.element(e, model)),
      relationships: (c) =>
        rd.container('relationships', c, 'relationship', (e) => rd.relationship(e, model)),
      organizations: (c) => {
        const before = model.organizations.length;
        rd.container('organizations', c, 'item', (e) => {
          model.organizations.push(rd.orgItem(e));
          return true;
        });
        orgSections.push(model.organizations.length - before);
      },
      propertyDefinitions: (c) =>
        rd.container('propertyDefinitions', c, 'propertyDefinition', (e) =>
          rd.propertyDefinition(e, model),
        ),
      views: (c) =>
        rd.container('views', c, 'diagrams', (d) => {
          rd.container('diagrams', d, 'view', (v) => rd.view(v, model));
          return true;
        }),
    },
    extra,
  );
  if (orgSections.length > 1) model.organizationSections = orgSections;
  const x = extra.build();
  if (x) model.extra = x;
  if (Object.keys(rd.containerExtra).length) model.containerExtra = rd.containerExtra;

  let best = '';
  let bestCount = -1;
  for (const [lang, n] of rd.nameLangs) {
    if (n > bestCount) {
      best = lang;
      bestCount = n;
    }
  }
  model.primaryLang = best;

  return { model, warnings: [...rd.warnings, ...checkReferences(model)] };
}
