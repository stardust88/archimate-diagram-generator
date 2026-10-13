// ArchiMate viewpoints (spec US-7). Allowed element types come from Archi's viewpoints.xml
// (viewpoints.json). The names are the Exchange Format ViewpointsEnum values in
// archimate3_View.xsd; the three enum values Archi does not define (Application Platform, Goal
// Contribution, Principles) and any custom string allow every element type.
import { ELEMENT_TYPES, type Layer } from './catalog';
import json from './viewpoints.json';

const RAW = (json as { viewpoints: Record<string, string[]> }).viewpoints;

const MACROS: Record<string, Layer> = {
  $StrategyElements$: 'strategy',
  $BusinessElements$: 'business',
  $ApplicationElements$: 'application',
  $TechnologyElements$: 'technology',
  $PhysicalElements$: 'physical',
  $MotivationElements$: 'motivation',
  $ImplementationMigrationElements$: 'implementation',
};

/** Allowed in every viewpoint (ArchiMate: grouping and junctions are viewpoint-neutral). */
const ALWAYS = new Set(['Grouping', 'AndJunction', 'OrJunction']);

/** All viewpoint names offered in the UI: the XSD enumeration, in its order. */
export const VIEWPOINT_NAMES: readonly string[] = [
  'Organization',
  'Application Platform',
  'Application Structure',
  'Information Structure',
  'Technology',
  'Layered',
  'Physical',
  'Product',
  'Application Usage',
  'Technology Usage',
  'Business Process Cooperation',
  'Application Cooperation',
  'Service Realization',
  'Implementation and Deployment',
  'Goal Realization',
  'Goal Contribution',
  'Principles',
  'Requirements Realization',
  'Motivation',
  'Strategy',
  'Capability Map',
  'Outcome Realization',
  'Resource Map',
  'Value Stream',
  'Project',
  'Migration',
  'Implementation and Migration',
  'Stakeholder',
];

const cache = new Map<string, Set<string> | null>();

/** Allowed element types for a viewpoint, or null when every type is allowed. */
export function allowedElementTypes(viewpoint: string | undefined): Set<string> | null {
  if (!viewpoint) return null;
  const hit = cache.get(viewpoint);
  if (hit !== undefined) return hit;
  const concepts = RAW[viewpoint];
  let result: Set<string> | null = null;
  if (concepts && concepts.length > 0) {
    result = new Set(ALWAYS);
    for (const c of concepts) {
      const layer = MACROS[c];
      if (layer) {
        for (const d of ELEMENT_TYPES) {
          if (d.layer === layer) result.add(d.type);
        }
      } else {
        result.add(c);
      }
    }
  }
  cache.set(viewpoint, result);
  return result;
}

export function isAllowedInViewpoint(viewpoint: string | undefined, type: string): boolean {
  const allowed = allowedElementTypes(viewpoint);
  return allowed === null || allowed.has(type) || type.startsWith('Unknown:');
}
