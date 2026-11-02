// The hinge tree: which face carries which, and the chain of creases from the root to each
// face, so a driver can nest transforms (nested groups in WebGL, nested elements in CSS) or
// compose them (the painted back's matrix). Generalizes the seed's facet tree (parent index,
// hinge) to any fold (docs/design/01-decisions.md D3).
import { cross, treeCreases, type CreaseId, type FaceId, type Fold } from './fold.ts'

export interface HingeTree {
  /** Every face, parent first, starting at the root (breadth first). */
  order: FaceId[]
  /** Each face's parent, null for the root. */
  parent: Record<FaceId, FaceId | null>
  /** The crease each face hangs off, null for the root. */
  hinge: Record<FaceId, CreaseId | null>
  /** The creases hinged on each face (its children's hinges), in the order the fold lists them. */
  children: Record<FaceId, CreaseId[]>
  /** The creases from the root down to each face, root's first; empty for the root. */
  chain: Record<FaceId, CreaseId[]>
}

/** The tree over the fold's non-closing creases. Assumes `validate(fold)` passed. */
export function hingeTree(fold: Fold): HingeTree {
  const creases = treeCreases(fold)
  const parent: HingeTree['parent'] = {}
  const hinge: HingeTree['hinge'] = {}
  const children: HingeTree['children'] = {}
  const chain: HingeTree['chain'] = {}
  for (const f of fold.faces) children[f.id] = []
  for (const c of creases) children[c.parent]?.push(c.id)
  const byId = new Map(creases.map(c => [c.id, c]))
  const order: FaceId[] = [fold.root]
  parent[fold.root] = null
  hinge[fold.root] = null
  chain[fold.root] = []
  for (let i = 0; i < order.length; i++) {
    const id = order[i]!
    for (const cid of children[id] ?? []) {
      const c = byId.get(cid)!
      parent[c.child] = id
      hinge[c.child] = cid
      chain[c.child] = [...chain[id]!, cid]
      order.push(c.child)
    }
  }
  return { order, parent, hinge, children, chain }
}

/** The flap of a crease: its child face and every face hinged beyond it. */
export function flap(fold: Fold, creaseId: CreaseId, tree = hingeTree(fold)): FaceId[] {
  const c = treeCreases(fold).find(c => c.id === creaseId)
  if (!c) throw new Error(`no tree crease ${creaseId}`)
  const out: FaceId[] = [c.child]
  const byId = new Map(treeCreases(fold).map(c => [c.id, c]))
  for (let i = 0; i < out.length; i++) {
    for (const cid of tree.children[out[i]!] ?? []) out.push(byId.get(cid)!.child)
  }
  return out
}

/** How far the flap of a crease reaches from the crease line: the farthest point of the child face and everything hinged beyond it, in sheet units. Sets the crease's duration and the shadow's height (D4, D5). */
export function reach(fold: Fold, creaseId: CreaseId, tree = hingeTree(fold)): number {
  const c = treeCreases(fold).find(c => c.id === creaseId)
  if (!c) throw new Error(`no tree crease ${creaseId}`)
  const u = [c.b[0] - c.a[0], c.b[1] - c.a[1]] as const
  const len = Math.hypot(u[0], u[1]) || 1
  let far = 0
  for (const id of flap(fold, creaseId, tree)) {
    const f = fold.faces.find(f => f.id === id)!
    for (const p of f.pts) far = Math.max(far, Math.abs(cross([u[0] / len, u[1] / len], [p[0] - c.a[0], p[1] - c.a[1]])))
  }
  return far
}
