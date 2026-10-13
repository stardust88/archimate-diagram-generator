// Internal data model (spec §6). Notation-agnostic: element and relationship `type` are plain
// strings owned by the notation pack. Deviations from the spec sketch are listed in DECISIONS.md.

/** A valid xs:ID: starts with a letter or "_" (new ids are "id-" + uuid). */
export type Id = string;

/** Language variants keyed by xml:lang; the "" key means no xml:lang attribute. */
export interface LangString {
  [lang: string]: string;
}

export interface Property {
  definitionRef: Id;
  values: LangString;
}

export type PropertyType = 'string' | 'boolean' | 'currency' | 'date' | 'time' | 'number';

export interface PropertyDefinition {
  id: Id;
  name: LangString;
  documentation?: LangString;
  type: PropertyType;
  extra?: PreservedXml;
}

/** An attribute this editor does not model, re-emitted verbatim. */
export interface PreservedAttr {
  ns: string | null;
  /** Qualified name as it appeared, e.g. "vendor:flag". */
  name: string;
  value: string;
}

/** An unrecognized child element, serialized, with the name of the known sibling it followed. */
export interface PreservedChild {
  after: string | null;
  xml: string;
}

/**
 * Anything unrecognized on an owning object (spec §7.4). Opaque to the editor.
 * `xsiType`: undefined = write the default xsi:type; null = the source omitted it; string = write
 * this non-default value (e.g. "NestingRelationship", or an unknown node type).
 */
export interface PreservedXml {
  attrs?: PreservedAttr[];
  children?: PreservedChild[];
  xsiType?: string | null;
}

export interface Element {
  id: Id;
  /** Exchange Format xsi:type, e.g. "BusinessActor"; "Unknown:<original>" for unrecognized types. */
  type: string;
  name: LangString;
  documentation?: LangString;
  properties: Property[];
  extra?: PreservedXml;
}

export type AccessType = 'Access' | 'Read' | 'Write' | 'ReadWrite';

export interface Relation {
  id: Id;
  type: string;
  /** Element id or relation id (relations can connect to relations). */
  source: Id;
  target: Id;
  name?: LangString;
  documentation?: LangString;
  properties: Property[];
  /** Access only. Absent = XSD default "Access". */
  accessType?: AccessType;
  /** Influence only. XSD attribute name verified: `modifier` (InfluenceModifierType). */
  modifier?: string;
  /** Association only. */
  isDirected?: boolean;
  extra?: PreservedXml;
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  /** 0-100 per the XSD (percent, not 0-255). */
  a?: number;
}

export interface FontStyle {
  name?: string;
  size?: number;
  /** Space-separated list of plain|bold|italic|underline. */
  style?: string;
  color?: RGBA;
}

export interface Style {
  fill?: RGBA;
  line?: RGBA;
  font?: FontStyle;
  lineWidth?: number;
  /** Source order of the style children when it was not fill, line, font (xs:all allows any). */
  order?: StylePart[];
  extra?: PreservedXml;
}

export type StylePart = 'fillColor' | 'lineColor' | 'font';

export interface Point {
  x: number;
  y: number;
}

interface ViewNodeBase {
  id: Id;
  /** Absolute coordinates, as in the Exchange Format (verified against fixtures, §6.2). */
  x: number;
  y: number;
  w: number;
  h: number;
  parent?: Id;
  /** `<label>`: the text of a Label node, the title of a Container, or a label override. */
  label?: LangString;
  documentation?: LangString;
  style?: Style;
  extra?: PreservedXml;
}

export interface ElementNode extends ViewNodeBase {
  kind: 'element';
  elementRef: Id;
}

export interface LabelNode extends ViewNodeBase {
  kind: 'label';
}

export interface ContainerNode extends ViewNodeBase {
  kind: 'container';
}

export type ViewNode = ElementNode | LabelNode | ContainerNode;

export interface ViewConnection {
  id: Id;
  /** "line" = plain visual connector with no model relationship. */
  kind: 'relationship' | 'line';
  relationshipRef?: Id;
  /** View node ids or connection ids. Empty string = absent (allowed for Line). */
  source: Id;
  target: Id;
  label?: LangString;
  documentation?: LangString;
  sourceAttachment?: Point;
  bendpoints: Point[];
  targetAttachment?: Point;
  style?: Style;
  extra?: PreservedXml;
}

export interface View {
  id: Id;
  name: LangString;
  documentation?: LangString;
  viewpoint?: string;
  properties: Property[];
  /** Flat list in document (pre-)order; nesting via `parent`. */
  nodes: ViewNode[];
  connections: ViewConnection[];
  extra?: PreservedXml;
}

/** One `<item>` of `<organizations>`: a folder (label + items) or a reference (`ref`). */
export interface OrgItem {
  identifier?: Id;
  ref?: Id;
  label?: LangString;
  documentation?: LangString;
  items: OrgItem[];
  extra?: PreservedXml;
}

export type ContainerName =
  'elements' | 'relationships' | 'organizations' | 'propertyDefinitions' | 'views' | 'diagrams';

export interface SourceInfo {
  fileName?: string;
  /** Root attributes other than identifier and namespace declarations, by qualified name. */
  rootAttributes: Record<string, string>;
  /** Namespace declarations on the root, prefix ("" = default) to URI. */
  namespaces: Record<string, string>;
}

export interface Model {
  id: Id;
  name: LangString;
  documentation?: LangString;
  /** The `<metadata>` element, serialized. Opaque. */
  metadata?: string;
  properties: Property[];
  propertyDefinitions: PropertyDefinition[];
  elements: Record<Id, Element>;
  relations: Record<Id, Relation>;
  /** Top-level `<item>`s of `<organizations>`. */
  organizations: OrgItem[];
  /** Only set when the source had several `<organizations>` blocks: item count per block. */
  organizationSections?: number[];
  views: Record<Id, View>;
  viewOrder: Id[];
  /** Language edited in the UI: most common xml:lang on names, or "". */
  primaryLang: string;
  extra?: PreservedXml;
  /** Unknown content inside the plural containers (`<elements>`, `<views>`, ...). */
  containerExtra?: Partial<Record<ContainerName, PreservedXml>>;
  sourceInfo?: SourceInfo;
}
