// Relationship validation against the ArchiMate relationship table (spec §10).
import type { Id, Model, Relation } from '../../core/model/types';
import { checkReferences, type ModelWarning } from '../../core/model/references';
import { isJunction } from './catalog';
import { isUnknownType } from './exchange/mapping';
import tableJson from './relationship-table.json';
import { RELATIONSHIP_TYPES, relationshipDef, type RelationshipTypeDef } from './relationships';

const TABLE = (tableJson as { table: Record<string, Record<string, string>> }).table;

/** Table key for a relationship end: its element type, or "Relationship" for a relation. */
export function conceptKey(model: Model, id: Id): string | undefined {
  const e = model.elements[id];
  if (e) return e.type;
  if (model.relations[id]) return 'Relationship';
  return undefined;
}

/** Relationship types allowed from `sourceType` to `targetType` (table keys, see conceptKey). */
export function allowedRelationships(
  sourceType: string,
  targetType: string,
): RelationshipTypeDef[] {
  if (isUnknownType(sourceType) || isUnknownType(targetType)) return [...RELATIONSHIP_TYPES];
  const letters = TABLE[sourceType]?.[targetType] ?? '';
  return RELATIONSHIP_TYPES.filter((d) => {
    if (!letters.includes(d.letter)) return false;
    // Specialization only between elements of the same type (§10).
    if (d.type === 'Specialization' && sourceType !== targetType) return false;
    return true;
  });
}

export function isAllowed(relType: string, sourceType: string, targetType: string): boolean {
  if (!relationshipDef(relType)) return true; // unknown relationship types are not judged
  return allowedRelationships(sourceType, targetType).some((d) => d.type === relType);
}

export function isRelationValid(model: Model, r: Relation): boolean {
  const s = conceptKey(model, r.source);
  const t = conceptKey(model, r.target);
  if (s === undefined || t === undefined) return true; // reported as dangling instead
  // Edges into or out of a junction are checked end-to-end in checkJunctions.
  if (isJunction(s) || isJunction(t)) return true;
  return isAllowed(r.type, s, t);
}

/**
 * Junction checks: every relationship touching a junction has the same type, and each
 * non-junction source -> target pair it connects is valid for that type.
 */
function checkJunctions(model: Model, out: ModelWarning[]): void {
  const touching = new Map<Id, Relation[]>();
  for (const r of Object.values(model.relations)) {
    for (const end of [r.source, r.target]) {
      if (model.elements[end] && isJunction(model.elements[end].type)) {
        const list = touching.get(end) ?? [];
        list.push(r);
        touching.set(end, list);
      }
    }
  }
  for (const [jid, rels] of touching) {
    const types = new Set(rels.map((r) => r.type));
    if (types.size > 1) {
      out.push({
        code: 'junction-mixed-types',
        message: `Junction ${jid} connects different relationship types (${[...types].join(', ')}).`,
        id: jid,
      });
      continue;
    }
    const type = rels[0]!.type;
    // Resolve chains of junctions to their real ends.
    const ends = (start: Id, dir: 'in' | 'out', seen = new Set<Id>()): Id[] => {
      if (seen.has(start)) return [];
      seen.add(start);
      const res: Id[] = [];
      for (const r of Object.values(model.relations)) {
        if (r.type !== type) continue;
        const next =
          dir === 'in'
            ? r.target === start
              ? r.source
              : null
            : r.source === start
              ? r.target
              : null;
        if (next === null) continue;
        const ne = model.elements[next];
        if (ne && isJunction(ne.type)) res.push(...ends(next, dir, seen));
        else res.push(next);
      }
      return res;
    };
    for (const s of ends(jid, 'in')) {
      for (const t of ends(jid, 'out')) {
        const sk = conceptKey(model, s);
        const tk = conceptKey(model, t);
        if (sk && tk && !isAllowed(type, sk, tk)) {
          out.push({
            code: 'junction-invalid-path',
            message: `${type} from ${s} to ${t} through junction ${jid} is not allowed by ArchiMate.`,
            id: jid,
          });
        }
      }
    }
  }
}

/** Full model check for the "Validate" button: references, relationship table, junctions. */
export function validateModel(model: Model): ModelWarning[] {
  const out = checkReferences(model);
  for (const r of Object.values(model.relations)) {
    if (!isRelationValid(model, r)) {
      const s = conceptKey(model, r.source);
      const t = conceptKey(model, r.target);
      out.push({
        code: 'invalid-relationship',
        message: `${r.type} from ${s} to ${t} is not allowed by ArchiMate (${r.id}).`,
        id: r.id,
      });
    }
  }
  checkJunctions(model, out);
  return out;
}
