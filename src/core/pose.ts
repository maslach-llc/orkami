// The pose at time t: every crease's angle from the schedule, every face's rigid transform
// from the hinge tree (the parent's transform composed with the rotation about the crease in
// the parent's flat frame, D3), and, for a fold with an interior vertex, the closure solved so
// the loop of faces closes (one scalar, bisection; D3). `t = 1` is the flat sheet: every angle 0,
// every face the identity. `flatBack` is the 2D map the CSS driver paints a back with.
import { compose, direction, reflect, type Affine, type Pt } from './affine.ts'
import { crease as creaseOf, cross, face as faceOf, sign, treeCreases, type Closure, type Crease, type CreaseId, type FaceId, type Fold } from './fold.ts'
import { faceNormal } from './light.ts'
import { together, angleAt, type Schedule } from './schedule.ts'
import { cross3, dot, IDENTITY4, multiply, normalize, rotation, sub, transform, type Mat4, type Vec3 } from './space.ts'
import { hingeTree, type HingeTree } from './tree.ts'

/** One hinge of a face's chain, in the parent's flat frame (sheet coordinates): a driver nests a rotation about `axisDir` through `axisPoint` by `angle` inside the parent's transform. */
export interface Hinge3 {
  axisPoint: Vec3
  axisDir: Vec3
  angle: number
}

export interface FacePose {
  id: FaceId
  /** The rigid transform of the face, 4x4 column major, from the flat sheet to the pose. */
  matrix: Mat4
  /** The hinges from the root down to this face; the matrix is their product. */
  chain: Hinge3[]
  /** The face's vertices in the pose. */
  pts: Vec3[]
  /** The face's unit normal in the pose, (0, 0, 1) when flat. */
  normal: Vec3
}

export interface Pose {
  t: number
  faces: Record<FaceId, FacePose>
  /** Every crease's signed angle, radians, valley positive; closing creases' from the solved loop. */
  angles: Record<CreaseId, number>
}

/** The crease's axis through `a`, oriented so a positive angle lifts the child toward the visitor (+z): valley positive, as FOLD has it. */
export function hingeAxis(fold: Fold, c: Crease): { point: Vec3, dir: Vec3 } {
  const child = faceOf(fold, c.child)
  const u = direction(c.a, c.b)
  // The child's farthest vertex from the crease line says which side the child lies on
  let side = 0
  for (const p of child.pts) {
    const d = cross(u, [p[0] - c.a[0], p[1] - c.a[1]])
    if (Math.abs(d) > Math.abs(side)) side = d
  }
  const flip = side < 0 ? -1 : 1
  return { point: [c.a[0], c.a[1], 0], dir: [u[0] * flip, u[1] * flip, 0] }
}

/** The pose for explicit crease angles (signed radians by crease id; a crease not listed is at 0). Closing creases' angles are measured, not taken. */
export function poseAngles(fold: Fold, angles: Record<CreaseId, number>, tree: HingeTree = hingeTree(fold), t = NaN): Pose {
  const faces: Pose['faces'] = {}
  const byId = new Map(treeCreases(fold).map(c => [c.id, c]))
  for (const id of tree.order) {
    const f = faceOf(fold, id)
    const hinge = tree.hinge[id]
    const parent = tree.parent[id]
    let matrix: Mat4 = IDENTITY4
    let chain: Hinge3[] = []
    if (hinge && parent) {
      const c = byId.get(hinge)!
      const axis = hingeAxis(fold, c)
      const angle = angles[hinge] ?? 0
      const p = faces[parent]!
      matrix = multiply(p.matrix, rotation(axis.point, axis.dir, angle))
      chain = [...p.chain, { axisPoint: axis.point, axisDir: axis.dir, angle }]
    }
    const pts = f.pts.map(([x, y]) => transform(matrix, [x, y, 0]))
    faces[id] = { id, matrix, chain, pts, normal: faceNormal(f.pts, matrix) }
  }
  const out: Pose['angles'] = {}
  for (const c of fold.creases) out[c.id] = c.closing ? dihedral(fold, c, faces) : (angles[c.id] ?? 0)
  return { t, faces, angles: out }
}

/** The signed dihedral angle at a crease between its two faces in a pose: the angle the child has turned about the hinge axis. */
export function dihedral(fold: Fold, c: Crease, faces: Pose['faces']): number {
  const p = faces[c.parent], ch = faces[c.child]
  if (!p || !ch) return 0
  const axis = hingeAxis(fold, c)
  const u = normalize(sub(transform(p.matrix, [c.b[0], c.b[1], 0]), transform(p.matrix, [c.a[0], c.a[1], 0])))
  const flip = dot(u, axis.dir) < 0 ? -1 : 1
  const ax: Vec3 = [u[0] * flip, u[1] * flip, u[2] * flip]
  return Math.atan2(dot(cross3(p.normal, ch.normal), ax), dot(p.normal, ch.normal))
}

/** The gap a closure leaves at its closing crease, measured along `across`: zero when the loop closes. */
function gap(fold: Fold, cl: Closure, angles: Record<CreaseId, number>, tree: HingeTree): number {
  const c = creaseOf(fold, cl.closing)
  const far: Pt = Math.hypot(c.a[0] - cl.vertex[0], c.a[1] - cl.vertex[1]) > Math.hypot(c.b[0] - cl.vertex[0], c.b[1] - cl.vertex[1]) ? c.a : c.b
  const p = poseAngles(fold, angles, tree)
  const viaChild = transform(p.faces[c.child]!.matrix, [far[0], far[1], 0])
  const viaParent = transform(p.faces[c.parent]!.matrix, [far[0], far[1], 0])
  return (viaChild[0] - viaParent[0]) * cl.across[0] + (viaChild[1] - viaParent[1]) * cl.across[1]
}

/** Solve a closure's shared magnitude by bisection on [0, pi] and write the solved creases' signed angles. */
function solve(fold: Fold, cl: Closure, angles: Record<CreaseId, number>, tree: HingeTree): void {
  const set = (s: number) => { for (const id of cl.solved) angles[id] = sign(creaseOf(fold, id).assignment) * s }
  const at = (s: number) => { set(s); return gap(fold, cl, angles, tree) }
  const eps = 1e-12 * Math.max(fold.sheet.width, fold.sheet.height, 1)
  let lo = 0, hi = Math.PI
  const glo = at(lo), ghi = at(hi)
  if (Math.abs(glo) <= eps) { set(lo); return }
  if (Math.abs(ghi) <= eps) { set(hi); return }
  if (Math.sign(glo) === Math.sign(ghi)) {
    // No closing angle: the pattern does not close (a base on a rectangle). Take the nearer end.
    set(Math.abs(glo) < Math.abs(ghi) ? lo : hi)
    return
  }
  for (let i = 0; i < 100 && hi - lo > 1e-13; i++) {
    const mid = (lo + hi) / 2
    const g = at(mid)
    if (Math.abs(g) <= eps) { lo = hi = mid; break }
    if (Math.sign(g) === Math.sign(glo)) lo = mid
    else hi = mid
  }
  set((lo + hi) / 2)
}

/** The pose at t in [0, 1] under a schedule (the fold's own, else every crease together). */
export function pose(fold: Fold, t: number, schedule: Schedule = fold.schedule ?? together(fold)): Pose {
  const tree = hingeTree(fold)
  const angles: Record<CreaseId, number> = {}
  for (const c of treeCreases(fold)) angles[c.id] = angleAt(fold, c.id, schedule, t)
  for (const cl of fold.closures ?? []) solve(fold, cl, angles, tree)
  return poseAngles(fold, angles, tree, t)
}

/** The closed state: the pose at t = 0. */
export const closedPose = (fold: Fold) => pose(fold, 0)

/**
 * Where a face's content lands when it lies folded flat over `creaseId`: the reflection across
 * that crease, composed with the parent's own flat back down to the root. The CSS driver paints
 * the back of the crease's child with the sheet under this map (02, cue 2).
 */
export function flatBack(fold: Fold, creaseId: CreaseId, tree: HingeTree = hingeTree(fold)): Affine {
  const c = creaseOf(fold, creaseId)
  const own = reflect(c.a, direction(c.a, c.b))
  const parentHinge = tree.hinge[c.parent]
  return parentHinge ? compose(flatBack(fold, parentHinge, tree), own) : own
}
