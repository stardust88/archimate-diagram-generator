import { createContext, useContext } from 'react';
import type { Id } from '../../core/model/types';

export interface CanvasContextValue {
  viewId: Id;
  /** Begin drawing a connection from a node (pointerdown on its border band). */
  startLink(sourceId: Id, e: React.PointerEvent): void;
  /** Child-extent minimum size for the resizer, in model units. */
  minSizeFor(nodeId: Id): { w: number; h: number };
  /** Commit a resize (React Flow parent-relative params). */
  commitResize(nodeId: Id, rel: { x: number; y: number; width: number; height: number }): void;
}

export const CanvasContext = createContext<CanvasContextValue | null>(null);

export function useCanvas(): CanvasContextValue {
  const v = useContext(CanvasContext);
  if (!v) throw new Error('useCanvas outside <Canvas>');
  return v;
}
