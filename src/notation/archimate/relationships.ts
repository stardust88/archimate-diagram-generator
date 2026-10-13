// ArchiMate relationship types (spec §8.6). xsi:type spellings checked against
// RelationshipTypeEnum in schemas/archimate3_Model.xsd (see catalog.test.ts).

export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'longDash';
export type MarkerKind =
  | 'none'
  | 'diamondFilled'
  | 'diamondHollow'
  | 'dot'
  | 'arrowFilled'
  | 'arrowOpen'
  | 'triangleHollow'
  | 'halfArrow';

export interface RelationshipTypeDef {
  type: string;
  label: string;
  /** Letter used in relationship-table.json (§10). */
  letter: string;
  line: LineStyle;
  sourceMarker: MarkerKind;
  targetMarker: MarkerKind;
}

export const RELATIONSHIP_TYPES: readonly RelationshipTypeDef[] = [
  {
    type: 'Composition',
    label: 'Composition',
    letter: 'c',
    line: 'solid',
    sourceMarker: 'diamondFilled',
    targetMarker: 'none',
  },
  {
    type: 'Aggregation',
    label: 'Aggregation',
    letter: 'g',
    line: 'solid',
    sourceMarker: 'diamondHollow',
    targetMarker: 'none',
  },
  {
    type: 'Assignment',
    label: 'Assignment',
    letter: 'i',
    line: 'solid',
    sourceMarker: 'dot',
    targetMarker: 'arrowFilled',
  },
  {
    type: 'Realization',
    label: 'Realization',
    letter: 'r',
    line: 'dashed',
    sourceMarker: 'none',
    targetMarker: 'triangleHollow',
  },
  {
    type: 'Serving',
    label: 'Serving',
    letter: 'v',
    line: 'solid',
    sourceMarker: 'none',
    targetMarker: 'arrowOpen',
  },
  {
    type: 'Access',
    label: 'Access',
    letter: 'a',
    line: 'dotted',
    sourceMarker: 'none',
    targetMarker: 'arrowOpen',
  },
  {
    type: 'Influence',
    label: 'Influence',
    letter: 'n',
    line: 'dashed',
    sourceMarker: 'none',
    targetMarker: 'arrowOpen',
  },
  {
    type: 'Triggering',
    label: 'Triggering',
    letter: 't',
    line: 'solid',
    sourceMarker: 'none',
    targetMarker: 'arrowFilled',
  },
  {
    type: 'Flow',
    label: 'Flow',
    letter: 'f',
    line: 'longDash',
    sourceMarker: 'none',
    targetMarker: 'arrowFilled',
  },
  {
    type: 'Specialization',
    label: 'Specialization',
    letter: 's',
    line: 'solid',
    sourceMarker: 'none',
    targetMarker: 'triangleHollow',
  },
  {
    type: 'Association',
    label: 'Association',
    letter: 'o',
    line: 'solid',
    sourceMarker: 'none',
    targetMarker: 'none',
  },
];

const BY_TYPE = new Map(RELATIONSHIP_TYPES.map((d) => [d.type, d]));
const BY_LETTER = new Map(RELATIONSHIP_TYPES.map((d) => [d.letter, d]));

export function relationshipDef(type: string): RelationshipTypeDef | undefined {
  return BY_TYPE.get(type);
}

export function relationshipByLetter(letter: string): RelationshipTypeDef | undefined {
  return BY_LETTER.get(letter);
}
