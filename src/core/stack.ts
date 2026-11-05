// The flat-state stacking of the faces: which face lies over which when the fold is closed
// (docs/design/01-decisions.md D12). The same rule `toFOLD` writes as `faceOrders`: a child
// closing at pi lies over its parent for a valley and under it for a mountain, "over" meaning
// on the side of the parent's normal. Composed down the hinge tree that gives every face an
// integer layer in the sheet's own frame, root 0, a pleat's panels 0, 1, 2, ..., and the CSS
// driver separates coplanar faces by that layer so they never fight for the same pixels.
// Siblings folded onto the same side of their parent where they overlap (a letter's two flaps
// both folded onto its middle) stack in the order the fold lists them: a later one lies over
// the whole of an earlier one, the way a hand folds the first flap down and the next over it.
import { apply, direction, reflect, type Pt } from './affine.ts'
import { face as faceOf, sign, treeCreases, type CreaseId, type FaceId, type Fold } from './fold.ts'
import { hingeTree, type HingeTree } from './tree.ts'

export interface StackOrder {
  /** Each face's layer in the closed state, the root 0, positive toward the visitor. */
  layer: Record<FaceId, number>
  /** Which way each face's front faces when closed: +1 toward the visitor (like the root), -1 away. */
  up: Record<FaceId, 1 | -1>
  /** Each tree crease's step in its parent's frame, in layers: positive the child lies over the parent, negative under, 0 not stacked (a crease that does not close flat). 1 or -1 unless the child lies over an overlapping earlier sibling, then past that sibling's whole flap. */
  step: Record<CreaseId, number>
}

/** Whether a crease closes flat, the child lying on its parent. */
const flatClosed = (closed: number) => Math.abs(closed - Math.PI) < 1e-9

/** Whether two convex polygons share some area (touching along an edge or at a point does not count). */
function overlap(a: Pt[], b: Pt[], eps = 1e-6): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!, q = poly[(i + 1) % poly.length]!
      const n: Pt = [p[1] - q[1], q[0] - p[0]]
      const l = Math.hypot(n[0], n[1]) || 1
      const proj = (pts: Pt[]) => pts.map(v => (v[0] * n[0] + v[1] * n[1]) / l)
      const pa = proj(a), pb = proj(b)
      if (Math.max(...pa) - eps <= Math.min(...pb) || Math.max(...pb) - eps <= Math.min(...pa)) return false
    }
  }
  return true
}

/** The stacking of the faces in the closed state, from the tree creases that close at pi. */
export function stackOrder(fold: Fold, tree: HingeTree = hingeTree(fold)): StackOrder {
  const layer: StackOrder['layer'] = { [fold.root]: 0 }
  const up: StackOrder['up'] = { [fold.root]: 1 }
  const step: StackOrder['step'] = {}
  const byId = new Map(treeCreases(fold).map(c => [c.id, c]))
  const flapOf = (id: FaceId): FaceId[] => [id, ...(tree.children[id] ?? []).flatMap(cid => flapOf(byId.get(cid)!.child))]
  const visit = (id: FaceId) => {
    const parentUp = up[id] ?? 1
    // The siblings already stacked on each side: where each lies once folded (in the parent's frame) and how many layers its flap takes
    const placed: { side: number; pts: Pt[]; depth: number }[] = []
    for (const cid of tree.children[id] ?? []) {
      const c = byId.get(cid)!
      const s = flatClosed(c.closed) ? sign(c.assignment) : 0
      let k = 1
      let pts: Pt[] = []
      if (s) {
        const m = reflect(c.a, direction(c.a, c.b))
        pts = faceOf(fold, c.child).pts.map(p => apply(m, p))
        for (const o of placed) if (o.side === s && overlap(o.pts, pts)) k = Math.max(k, o.depth + 1)
      }
      step[cid] = s * k
      layer[c.child] = (layer[id] ?? 0) + s * k * parentUp
      up[c.child] = s ? (-parentUp as 1 | -1) : parentUp
      visit(c.child)
      if (s) placed.push({ side: s, pts, depth: Math.max(...flapOf(c.child).map(f => (layer[f]! - layer[id]!) * s * parentUp)) })
    }
  }
  visit(fold.root)
  return { layer, up, step }
}
