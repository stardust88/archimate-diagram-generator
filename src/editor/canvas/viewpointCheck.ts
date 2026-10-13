import { elementDef } from '../../notation/archimate/catalog';
import { isAllowedInViewpoint } from '../../notation/archimate/viewpoints';

/** Badge text for an element that the view's viewpoint does not allow (US-7), else undefined. */
export function offViewpointWarning(
  viewpoint: string | undefined,
  type: string,
): string | undefined {
  if (isAllowedInViewpoint(viewpoint, type)) return undefined;
  return `${elementDef(type)?.label ?? type} is not part of the "${viewpoint}" viewpoint`;
}
