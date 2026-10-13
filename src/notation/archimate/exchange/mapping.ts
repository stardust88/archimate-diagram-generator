// xsi:type <-> internal type names. Internal names are the Exchange Format xsi:type values
// (spec §6.1), so known types map to themselves; anything else becomes "Unknown:<original>"
// and is written back unchanged (spec §7.3.3).
import { elementDef } from '../catalog';
import { relationshipDef } from '../relationships';

export const UNKNOWN_PREFIX = 'Unknown:';

export function elementTypeFromXsi(xsiType: string): string {
  return elementDef(xsiType) ? xsiType : UNKNOWN_PREFIX + xsiType;
}

export function relationshipTypeFromXsi(xsiType: string): string {
  return relationshipDef(xsiType) ? xsiType : UNKNOWN_PREFIX + xsiType;
}

/** The xsi:type to write for an internal type; "" means write no xsi:type. */
export function xsiFromType(type: string): string {
  return type.startsWith(UNKNOWN_PREFIX) ? type.slice(UNKNOWN_PREFIX.length) : type;
}

export function isUnknownType(type: string): boolean {
  return type.startsWith(UNKNOWN_PREFIX);
}
