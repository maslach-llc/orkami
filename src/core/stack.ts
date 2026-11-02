// The flat-state stacking of the faces: which face lies over which when the fold is closed
// (docs/design/01-decisions.md D12). The same rule `toFOLD` writes as `faceOrders`: a child
// closing at pi lies over its parent for a valley and under it for a mountain, "over" meaning
// on the side of the parent's normal. Composed down the hinge tree that gives every face an
// integer layer in the sheet's own frame, root 0, a pleat's panels 0, 1, 2, ..., and the CSS
// driver separates coplanar faces by that layer so they never fight for the same pixels.
import { sign, treeCreases, type CreaseId, type FaceId, type Fold } from './fold.ts'
import { hingeTree, type HingeTree } from './tree.ts'

export interface StackOrder {
  /** Each face's layer in the closed state, the root 0, positive toward the visitor. */
  layer: Record<FaceId, number>
  /** Which way each face's front faces when closed: +1 toward the visitor (like the root), -1 away. */
  up: Record<FaceId, 1 | -1>
  /** Each tree crease's step in its parent's frame: +1 the child lies over the parent, -1 under, 0 not stacked (a crease that does not close flat). */
  step: Record<CreaseId, 1 | -1 | 0>
}

/** Whether a crease closes flat, the child lying on its parent. */
const flatClosed = (closed: number) => Math.abs(closed - Math.PI) < 1e-9

/** The stacking of the faces in the closed state, from the tree creases that close at pi. */
export function stackOrder(fold: Fold, tree: HingeTree = hingeTree(fold)): StackOrder {
  const layer: StackOrder['layer'] = { [fold.root]: 0 }
  const up: StackOrder['up'] = { [fold.root]: 1 }
  const step: StackOrder['step'] = {}
  const byId = new Map(treeCreases(fold).map(c => [c.id, c]))
  for (const id of tree.order) {
    const hinge = tree.hinge[id]
    const parent = tree.parent[id]
    if (!hinge || !parent) continue
    const c = byId.get(hinge)!
    const s = (flatClosed(c.closed) ? sign(c.assignment) : 0) as 1 | -1 | 0
    step[hinge] = s
    const parentUp = up[parent] ?? 1
    layer[id] = (layer[parent] ?? 0) + s * parentUp
    up[id] = s ? (-parentUp as 1 | -1) : parentUp
  }
  return { layer, up, step }
}
