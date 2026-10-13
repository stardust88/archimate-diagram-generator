// ArchiMate 3.2 element catalog (spec §8.1). Every xsi:type below is checked against the
// ElementTypeEnum in schemas/archimate3_Model.xsd (see catalog.test.ts).

export type Layer =
  | 'strategy'
  | 'business'
  | 'application'
  | 'technology'
  | 'physical'
  | 'motivation'
  | 'implementation'
  | 'other';
export type Aspect = 'active' | 'behavior' | 'passive' | 'motivation' | 'composite' | 'connector';
export type BoxShape = 'rect' | 'rounded' | 'cut';

export interface ElementTypeDef {
  type: string;
  label: string;
  layer: Layer;
  aspect: Aspect;
  box: BoxShape;
  icon: string;
  /** Two-letter placeholder shown until the icon exists (§8.4). */
  code: string;
  defaultSize: [number, number];
}

const BOX: Record<Aspect, BoxShape> = {
  active: 'rect',
  passive: 'rect',
  composite: 'rect',
  behavior: 'rounded',
  motivation: 'cut',
  connector: 'rect',
};

type Row = [type: string, label: string, icon: string, code: string];

function group(layer: Layer, aspect: Aspect, rows: Row[]): ElementTypeDef[] {
  return rows.map(([type, label, icon, code]) => ({
    type,
    label,
    layer,
    aspect,
    box: BOX[aspect],
    icon,
    code,
    defaultSize: aspect === 'connector' ? [15, 15] : [120, 55],
  }));
}

export const ELEMENT_TYPES: readonly ElementTypeDef[] = [
  ...group('strategy', 'passive', [['Resource', 'Resource', 'resource', 'Rs']]),
  ...group('strategy', 'behavior', [
    ['Capability', 'Capability', 'capability', 'Ca'],
    ['ValueStream', 'Value Stream', 'valueStream', 'VS'],
    ['CourseOfAction', 'Course of Action', 'courseOfAction', 'CA'],
  ]),
  ...group('business', 'active', [
    ['BusinessActor', 'Business Actor', 'actor', 'BA'],
    ['BusinessRole', 'Business Role', 'role', 'BR'],
    ['BusinessCollaboration', 'Business Collaboration', 'collaboration', 'BC'],
    ['BusinessInterface', 'Business Interface', 'interface', 'BI'],
  ]),
  ...group('business', 'behavior', [
    ['BusinessProcess', 'Business Process', 'process', 'BP'],
    ['BusinessFunction', 'Business Function', 'function', 'BF'],
    ['BusinessInteraction', 'Business Interaction', 'interaction', 'Bx'],
    ['BusinessEvent', 'Business Event', 'event', 'BE'],
    ['BusinessService', 'Business Service', 'service', 'BS'],
  ]),
  ...group('business', 'passive', [
    ['BusinessObject', 'Business Object', 'object', 'BO'],
    ['Contract', 'Contract', 'contract', 'Ct'],
    ['Representation', 'Representation', 'representation', 'Rp'],
  ]),
  ...group('business', 'composite', [['Product', 'Product', 'product', 'Pr']]),
  ...group('application', 'active', [
    ['ApplicationComponent', 'Application Component', 'component', 'AC'],
    ['ApplicationCollaboration', 'Application Collaboration', 'collaboration', 'Ac'],
    ['ApplicationInterface', 'Application Interface', 'interface', 'AI'],
  ]),
  ...group('application', 'behavior', [
    ['ApplicationFunction', 'Application Function', 'function', 'AF'],
    ['ApplicationInteraction', 'Application Interaction', 'interaction', 'Ax'],
    ['ApplicationProcess', 'Application Process', 'process', 'AP'],
    ['ApplicationEvent', 'Application Event', 'event', 'AE'],
    ['ApplicationService', 'Application Service', 'service', 'AS'],
  ]),
  ...group('application', 'passive', [['DataObject', 'Data Object', 'object', 'DO']]),
  ...group('technology', 'active', [
    ['Node', 'Node', 'node', 'No'],
    ['Device', 'Device', 'device', 'De'],
    ['SystemSoftware', 'System Software', 'systemSoftware', 'SS'],
    ['TechnologyCollaboration', 'Technology Collaboration', 'collaboration', 'TC'],
    ['TechnologyInterface', 'Technology Interface', 'interface', 'TI'],
    ['Path', 'Path', 'path', 'Pa'],
    ['CommunicationNetwork', 'Communication Network', 'network', 'CN'],
  ]),
  ...group('technology', 'behavior', [
    ['TechnologyFunction', 'Technology Function', 'function', 'TF'],
    ['TechnologyProcess', 'Technology Process', 'process', 'TP'],
    ['TechnologyInteraction', 'Technology Interaction', 'interaction', 'Tx'],
    ['TechnologyEvent', 'Technology Event', 'event', 'TE'],
    ['TechnologyService', 'Technology Service', 'service', 'TS'],
  ]),
  ...group('technology', 'passive', [['Artifact', 'Artifact', 'artifact', 'Ar']]),
  ...group('physical', 'active', [
    ['Equipment', 'Equipment', 'equipment', 'Eq'],
    ['Facility', 'Facility', 'facility', 'Fa'],
    ['DistributionNetwork', 'Distribution Network', 'distribution', 'DN'],
  ]),
  ...group('physical', 'passive', [['Material', 'Material', 'material', 'Ma']]),
  ...group('motivation', 'motivation', [
    ['Stakeholder', 'Stakeholder', 'stakeholder', 'St'],
    ['Driver', 'Driver', 'driver', 'Dr'],
    ['Assessment', 'Assessment', 'assessment', 'As'],
    ['Goal', 'Goal', 'goal', 'Go'],
    ['Outcome', 'Outcome', 'outcome', 'Ou'],
    ['Principle', 'Principle', 'principle', 'Pl'],
    ['Requirement', 'Requirement', 'requirement', 'Rq'],
    ['Constraint', 'Constraint', 'constraint', 'Cs'],
    ['Meaning', 'Meaning', 'meaning', 'Me'],
    ['Value', 'Value', 'value', 'Va'],
  ]),
  ...group('implementation', 'behavior', [
    ['WorkPackage', 'Work Package', 'workPackage', 'WP'],
    ['ImplementationEvent', 'Implementation Event', 'event', 'IE'],
  ]),
  ...group('implementation', 'passive', [
    ['Deliverable', 'Deliverable', 'deliverable', 'Dl'],
    ['Gap', 'Gap', 'gap', 'Ga'],
  ]),
  ...group('implementation', 'composite', [['Plateau', 'Plateau', 'plateau', 'Pt']]),
  ...group('other', 'composite', [
    ['Location', 'Location', 'location', 'Lo'],
    ['Grouping', 'Grouping', 'grouping', 'Gr'],
  ]),
  ...group('other', 'connector', [
    ['AndJunction', 'And Junction', 'junction', 'J&'],
    ['OrJunction', 'Or Junction', 'junction', 'J|'],
  ]),
];

const BY_TYPE = new Map(ELEMENT_TYPES.map((d) => [d.type, d]));

export function elementDef(type: string): ElementTypeDef | undefined {
  return BY_TYPE.get(type);
}

export function isJunction(type: string): boolean {
  return type === 'AndJunction' || type === 'OrJunction';
}

export const LAYERS: readonly { layer: Layer; label: string }[] = [
  { layer: 'strategy', label: 'Strategy' },
  { layer: 'business', label: 'Business' },
  { layer: 'application', label: 'Application' },
  { layer: 'technology', label: 'Technology' },
  { layer: 'physical', label: 'Physical' },
  { layer: 'motivation', label: 'Motivation' },
  { layer: 'implementation', label: 'Implementation & Migration' },
  { layer: 'other', label: 'Other' },
];
