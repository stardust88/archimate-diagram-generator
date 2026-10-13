// Reference integrity checks (spec §7.3.7). Pure; used after import and before export.
import type { Model, OrgItem, Property } from './types';

export interface ModelWarning {
  code: string;
  message: string;
  /** Id of the object the warning is about, when it has one. */
  id?: string;
  /** View the problem is in, for view-level warnings. */
  viewId?: string;
}

export function checkReferences(model: Model): ModelWarning[] {
  const out: ModelWarning[] = [];
  const defs = new Set(model.propertyDefinitions.map((d) => d.id));
  const concepts = (id: string) =>
    Object.hasOwn(model.elements, id) || Object.hasOwn(model.relations, id);

  const props = (owner: string, list: Property[]) => {
    for (const p of list) {
      if (!defs.has(p.definitionRef)) {
        out.push({
          code: 'dangling-property-definition',
          message: `${owner} has a property referring to missing definition "${p.definitionRef}".`,
          id: owner,
        });
      }
    }
  };

  props(model.id || 'Model', model.properties);
  for (const e of Object.values(model.elements)) props(e.id, e.properties);
  for (const r of Object.values(model.relations)) {
    props(r.id, r.properties);
    for (const end of ['source', 'target'] as const) {
      if (!concepts(r[end])) {
        out.push({
          code: 'dangling-relationship-end',
          message: `Relationship ${r.id} has a missing ${end} "${r[end]}".`,
          id: r.id,
        });
      }
    }
  }

  const walk = (items: OrgItem[]) => {
    for (const it of items) {
      if (it.ref !== undefined && !concepts(it.ref) && !Object.hasOwn(model.views, it.ref)) {
        out.push({
          code: 'dangling-organization-ref',
          message: `Folder item refers to missing object "${it.ref}".`,
          id: it.ref,
        });
      }
      walk(it.items);
    }
  };
  walk(model.organizations);

  for (const v of Object.values(model.views)) {
    props(v.id, v.properties);
    const viewConcepts = new Set<string>();
    for (const n of v.nodes) viewConcepts.add(n.id);
    for (const c of v.connections) viewConcepts.add(c.id);
    for (const n of v.nodes) {
      if (n.kind === 'element' && !Object.hasOwn(model.elements, n.elementRef)) {
        out.push({
          code: 'dangling-element-ref',
          message: `Node ${n.id} in a view refers to missing element "${n.elementRef}"; it is hidden but kept.`,
          id: n.id,
          viewId: v.id,
        });
      }
    }
    for (const c of v.connections) {
      if (c.relationshipRef !== undefined && !Object.hasOwn(model.relations, c.relationshipRef)) {
        out.push({
          code: 'dangling-relationship-ref',
          message: `Connection ${c.id} refers to missing relationship "${c.relationshipRef}"; it is hidden but kept.`,
          id: c.id,
          viewId: v.id,
        });
      }
      for (const end of ['source', 'target'] as const) {
        if (c[end] !== '' && !viewConcepts.has(c[end])) {
          out.push({
            code: 'dangling-connection-end',
            message: `Connection ${c.id} has a missing ${end} "${c[end]}" in its view.`,
            id: c.id,
            viewId: v.id,
          });
        }
      }
    }
  }
  return out;
}
