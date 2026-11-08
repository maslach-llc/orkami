// A model folded in steps (docs/design/01-decisions.md D19; docs/study/04-models-in-steps.md
// section 3): one crease pattern holding every crease the model ever makes, and an ordered list
// of steps, each naming the creases it moves and the signed angle each one ends at. A crease a
// step does not name holds the angle the previous step left, so a step starts where the last one
// stopped and unfolding a model is its steps played backwards. The faces never change identity:
// a driver builds them once and a step only changes angles.
//
// Time is `s` in [0, steps.length]: 0 the flat sheet, k the end of step k (a keyframe), the
// fraction between the progress through the next step on that step's schedule. Each step reuses
// the fold's hinge composition (`poseAngles`); a closure (D10's bases) is solved in a step that
// drives it. Until the general solver (doc 10, D20) a step must be closable by the hinge tree as
// it stands: `model()` samples every step and refuses one that would tear the sheet at a crease
// left out of the tree.
//
// The layer order (D12 generalized): at each keyframe the faces that overlap in the folded image
// are ordered from the paper itself, a pair that moved together in the step keeping its order in
// its own frame, any other pair by which side it landed from, read from the pose just before the
// landing. A driver separates coplanar faces by those layers, and swaps from one keyframe's order
// to the next half way through the step, where the moving paper is in the air and the swap cannot
// show; at every keyframe the layers are exactly that rest state's.
import type { Pt } from './affine.ts'
import { assertValid, convex, tolerance, treeCreases, type Crease, type CreaseId, type FaceId, type Fold } from './fold.ts'
import { poseAngles, solveClosure, type Pose } from './pose.ts'
import { creaseDuration, progress, type Entry } from './schedule.ts'
import { invertRigid as invert4, multiply, transform, type Mat4 } from './space.ts'
import type { StackOrder } from './stack.ts'
import { hingeTree, reach, type HingeTree } from './tree.ts'

export interface Step {
  /** What the step is called in a diagram ("kite fold, right"). */
  name: string
  /** The creases the step moves, each to the signed angle it ends at (radians, valley positive, in [-pi, pi]). Every other crease holds. */
  moves: Record<CreaseId, number>
  /** Per moved crease, its start and duration as fractions of the step (every crease over the whole step by default), on the paper easing. */
  schedule?: Record<CreaseId, Entry>
  /** The step's length in ms at the default pace; from the longest flap it moves by default (D4). */
  duration?: number
}

/** A step as a model holds it: its duration resolved. */
export type ModelStep = Step & { duration: number }

/** A keyframe's layer order: the stack the drivers lift flaps by (D12), and the overlapping pairs it was read from, the first face over the second (what FOLD's `faceOrders` records). */
export interface ModelStack extends StackOrder {
  over: [FaceId, FaceId][]
}

/** A model: one crease pattern (a sound `Fold`) and its steps. Built by `model()`, which fills `keys` and `stacks`. */
export interface Model extends Fold {
  steps: ModelStep[]
  /** Every crease's signed angle at each keyframe: index 0 the flat sheet, index k the end of step k. */
  keys: Record<CreaseId, number>[]
  /** The layer order at each keyframe, index as `keys`. */
  stacks: ModelStack[]
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const ANGLE_TOL = 1e-6
/** Where in each step the joints are checked by `model()`. */
const SAMPLES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]

/** The closures a step drives: those with a solved crease and a driven crease (a tree crease at its vertex that is not solved) among the step's moves. */
function drivenClosures(fold: Fold, step: Step) {
  const tol = tolerance(fold)
  const at = (p: Pt, v: Pt) => Math.hypot(p[0] - v[0], p[1] - v[1]) < tol
  return (fold.closures ?? []).filter(cl => cl.solved.length > 0 && treeCreases(fold).some(c =>
    c.id in step.moves && !cl.solved.includes(c.id) && (at(c.a, cl.vertex) || at(c.b, cl.vertex))))
}

/** The tree creases' angles at a progress through a step that starts from `from`, closures solved. */
function stepAngles(fold: Fold, step: Step, from: Record<CreaseId, number>, x: number, tree: HingeTree): Record<CreaseId, number> {
  const angles: Record<CreaseId, number> = {}
  for (const c of treeCreases(fold)) {
    const a0 = from[c.id] ?? 0
    const a1 = step.moves[c.id]
    angles[c.id] = a1 === undefined ? a0 : a0 + (a1 - a0) * progress(step.schedule?.[c.id] ?? { start: 0, duration: 1 }, x)
  }
  for (const cl of drivenClosures(fold, step)) solveClosure(fold, cl, angles, tree)
  return angles
}

/** The worst distance, over the creases left out of the tree, between where the crease's two faces put its ends: 0 when the sheet is whole. */
export function jointGap(fold: Fold, pose: Pose): { crease: CreaseId | null; gap: number } {
  let worst: { crease: CreaseId | null; gap: number } = { crease: null, gap: 0 }
  for (const c of fold.creases) {
    const p = pose.faces[c.parent], ch = pose.faces[c.child]
    if (!p || !ch) continue
    for (const e of [c.a, c.b]) {
      const u = transform(p.matrix, [e[0], e[1], 0]), v = transform(ch.matrix, [e[0], e[1], 0])
      const g = Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2])
      if (g > worst.gap) worst = { crease: c.id, gap: g }
    }
  }
  return worst
}

/**
 * A model from its crease pattern and steps. Checks: the pattern is a sound fold; every step's
 * creases exist and its targets are in [-pi, pi]; every step keeps the sheet whole at every
 * sampled progress (its moving set is one the hinge tree and D10's closures can close); and a
 * crease outside the tree that a step names lands where the step says.
 */
export function model(pattern: Fold, steps: Step[]): Model {
  assertValid(pattern)
  const tree = hingeTree(pattern)
  const tol = tolerance(pattern) * 1e3
  const byId = new Map(pattern.creases.map(c => [c.id, c]))
  const resolved: Model['steps'] = steps.map((s, i) => {
    for (const [id, a] of Object.entries(s.moves)) {
      if (!byId.has(id)) throw new Error(`step ${i + 1} (${s.name}) moves crease ${id}, which the pattern does not have`)
      if (!Number.isFinite(a) || Math.abs(a) > Math.PI + 1e-9) throw new Error(`step ${i + 1} (${s.name}) moves crease ${id} to ${a}, outside [-pi, pi]`)
    }
    for (const id of Object.keys(s.schedule ?? {})) if (!(id in s.moves)) throw new Error(`step ${i + 1} (${s.name}) schedules crease ${id}, which it does not move`)
    const moved = treeCreases(pattern).filter(c => c.id in s.moves)
    const far = moved.reduce((m, c) => Math.max(m, reach(pattern, c.id, tree)), 0)
    return { ...s, duration: s.duration ?? creaseDuration(far) }
  })

  const keys: Record<CreaseId, number>[] = []
  const flat: Record<CreaseId, number> = {}
  for (const c of pattern.creases) flat[c.id] = 0
  keys.push(flat)
  resolved.forEach((s, i) => {
    const from = keys[i]!
    let end: Pose | undefined
    for (const x of SAMPLES) {
      const p = poseAngles(pattern, stepAngles(pattern, s, from, x, tree), tree)
      const g = jointGap(pattern, p)
      if (g.gap > tol) throw new Error(`step ${i + 1} (${s.name}) tears the sheet at crease ${g.crease} (${g.gap.toExponential(2)} apart at ${x} of the step): its moving set is not one the engine can close yet (a tree, or a D10 base, until the general solver)`)
      if (x === 1) end = p
    }
    const key: Record<CreaseId, number> = {}
    for (const c of pattern.creases) {
      const measured = end!.angles[c.id] ?? 0
      const target = s.moves[c.id]
      if (target !== undefined && Math.abs(wrap(measured - target)) > ANGLE_TOL) throw new Error(`step ${i + 1} (${s.name}) sends crease ${c.id} to ${target}, but the paper puts it at ${measured}`)
      // A crease folded flat reads as +-pi either way: keep the sign the steps gave it
      const named = target ?? (c.closing ? from[c.id] : undefined)
      key[c.id] = named !== undefined && Math.abs(wrap(measured - named)) <= ANGLE_TOL ? named : measured
    }
    keys.push(key)
  })

  const m: Model = { ...pattern, steps: resolved, keys, stacks: [] }
  for (let k = 0; k < keys.length; k++) m.stacks.push(keyStack(m, k, tree))
  return m
}

/** Which step `s` is in and how far through it: the step index (0-based) and the progress, 0..1. At a keyframe k > 0 it is the end of step k. */
export function stepAt(m: Model, s: number): { step: number; x: number } {
  const n = m.steps.length
  if (n === 0) return { step: -1, x: 0 }
  const v = Math.min(n, Math.max(0, s))
  if (v === 0) return { step: 0, x: 0 }
  const k = Math.ceil(v) - 1
  return { step: k, x: v - k }
}

/** Every crease's angle at s (tree creases set, closures solved; creases left out of the tree are measured by the pose). */
export function modelAngles(m: Model, s: number, tree: HingeTree = hingeTree(m)): Record<CreaseId, number> {
  const { step, x } = stepAt(m, s)
  if (step < 0) return { ...m.keys[0] }
  return stepAngles(m, m.steps[step]!, m.keys[step]!, x, tree)
}

/** The pose at s in [0, steps.length]: 0 flat, k the end of step k. */
export function modelPose(m: Model, s: number, tree: HingeTree = hingeTree(m)): Pose {
  const v = Math.min(m.steps.length, Math.max(0, s))
  return poseAngles(m, modelAngles(m, v, tree), tree, v)
}

/** The keyframe whose layer order holds at s: the nearer rest state, so the order swaps half way through a step, with the paper in the air. */
export const keyAt = (m: Model, s: number) => Math.min(m.steps.length, Math.max(0, Math.round(Math.min(m.steps.length, Math.max(0, s)))))

/** The layer order at s (the nearer keyframe's). */
export const modelStack = (m: Model, s: number): ModelStack => m.stacks[keyAt(m, s)]!

/** The creases made by keyframe k: folded at some keyframe up to k. A crease exists on the paper from the step that first folds it (R7) and stays. */
export function creasesMade(m: Model, k: number): Set<CreaseId> {
  const out = new Set<CreaseId>()
  for (let i = 1; i <= Math.min(k, m.keys.length - 1); i++) {
    for (const [id, a] of Object.entries(m.keys[i]!)) if (Math.abs(a) > ANGLE_TOL) out.add(id)
  }
  return out
}

/** Keyframe k as a fold of its own: each crease's assignment from its angle there (flat when at 0), closed at its magnitude. For the flat-foldability checks (`flatFoldable`). */
export function keyFold(m: Model, k: number): Fold {
  const key = m.keys[k]
  if (!key) throw new Error(`the model has no keyframe ${k}`)
  return {
    sheet: m.sheet,
    faces: m.faces,
    root: m.root,
    creases: m.creases.map((c): Crease => {
      const a = key[c.id] ?? 0
      const folded = Math.abs(a) > ANGLE_TOL
      return { ...c, assignment: folded ? (a > 0 ? 'V' : 'M') : 'F', closed: folded ? Math.abs(a) : 0 }
    }),
    closures: m.closures,
  }
}

/** The total length of steps `from`..`to` (s values) in ms at the default pace, each step counted by the part of it covered. */
export function modelDuration(m: Model, from = 0, to = m.steps.length): number {
  const lo = Math.max(0, Math.min(from, to)), hi = Math.min(m.steps.length, Math.max(from, to))
  let ms = 0
  for (let k = 0; k < m.steps.length; k++) ms += Math.max(0, Math.min(hi, k + 1) - Math.max(lo, k)) * m.steps[k]!.duration
  return ms
}

/** s after `ms` of play from `from` toward `to`, at the steps' own pace (each step takes its own duration). */
export function modelTime(m: Model, from: number, to: number, ms: number): number {
  const dir = to >= from ? 1 : -1
  let s = from, left = ms
  while (left > 0 && (dir > 0 ? s < to : s > to)) {
    const k = dir > 0 ? Math.floor(s + 1e-12) : Math.ceil(s - 1e-12) - 1
    const step = m.steps[Math.min(m.steps.length - 1, Math.max(0, k))]
    const d = step?.duration || 1
    const edge = dir > 0 ? Math.min(to, k + 1) : Math.max(to, k)
    const need = Math.abs(edge - s) * d
    if (left >= need) { s = edge; left -= need } else { s += dir * left / d; left = 0 }
  }
  return dir > 0 ? Math.min(s, to) : Math.max(s, to)
}

// --- the layer order at a keyframe

/** The 2D part of a face's matrix (column major), its image in the sheet plane. */
const image = (mat: Mat4, p: Pt): Pt => { const v = transform(mat, [p[0], p[1], 0]); return [v[0], v[1]] }

/** Clips convex polygon `p` by convex polygon `q` (Sutherland-Hodgman); empty when they do not overlap. */
function clip(p: Pt[], q: Pt[]): Pt[] {
  // Orient q counterclockwise for the inside test
  let area2 = 0
  for (let i = 0; i < q.length; i++) { const a = q[i]!, b = q[(i + 1) % q.length]!; area2 += a[0] * b[1] - b[0] * a[1] }
  const qq = area2 < 0 ? [...q].reverse() : q
  let out = p
  for (let i = 0; i < qq.length && out.length; i++) {
    const a = qq[i]!, b = qq[(i + 1) % qq.length]!
    const side = (v: Pt) => (b[0] - a[0]) * (v[1] - a[1]) - (b[1] - a[1]) * (v[0] - a[0])
    const input = out
    out = []
    for (let j = 0; j < input.length; j++) {
      const c = input[j]!, d = input[(j + 1) % input.length]!
      const sc = side(c), sd = side(d)
      if (sc >= 0) out.push(c)
      if ((sc >= 0) !== (sd >= 0)) {
        const k = sc / (sc - sd)
        out.push([c[0] + (d[0] - c[0]) * k, c[1] + (d[1] - c[1]) * k])
      }
    }
  }
  return out
}

function polyArea(p: Pt[]): number {
  let s = 0
  for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1] }
  return Math.abs(s) / 2
}

/** The relative placement of face b in face a's frame, to tell whether two faces moved together. */
const relative = (a: Mat4, b: Mat4) => multiply(invert4(a), b)
const sameMat = (a: Mat4, b: Mat4, tol: number) => a.every((v, i) => Math.abs(v - b[i]!) < tol)

/** How far before a keyframe the landing side is read: early enough that a face in the air is clear of the paper it lands on, late enough that nothing else has moved past. */
const BEFORE = 0.02

/**
 * The layer order at keyframe k. Each pair of faces that overlap in the folded image at k is
 * ordered: by height when the keyframe holds them apart (a finishing step's held angle); when
 * they rest on each other, by their order at the previous keyframe, inverted if the pair turned
 * over, if they moved together through the step; else by the side one landed on the other from
 * (the pose a little before k). Layers are then the longest chain from the lowest face, the root
 * counted as 0, and each tree crease's step the child's layer over its parent's along the
 * parent's normal, which is what the drivers lift a flap by (D12).
 */
function keyStack(m: Model, k: number, tree: HingeTree): ModelStack {
  const ids = m.faces.filter(f => !f.page).map(f => f.id)
  const layer: StackOrder['layer'] = {}, up: StackOrder['up'] = {}, step: StackOrder['step'] = {}
  if (k === 0) {
    for (const f of m.faces) { layer[f.id] = 0; up[f.id] = 1 }
    for (const c of treeCreases(m)) step[c.id] = 0
    return { layer, up, step, over: [] }
  }
  const tol = tolerance(m)
  const end = poseAngles(m, m.keys[k]!, tree)
  const start = poseAngles(m, m.keys[k - 1]!, tree)
  const near = modelPose(m, k - BEFORE, tree)
  const prev = m.stacks[k - 1]!
  for (const id of ids) up[id] = end.faces[id]!.normal[2] < 0 ? -1 : 1
  const faceById = new Map(m.faces.map(f => [f.id, f]))
  const img = (id: FaceId) => faceById.get(id)!.pts.map(p => image(end.faces[id]!.matrix, p))
  const images = new Map(ids.map(id => [id, img(id)]))
  // above.get(a) holds every face a lies over
  const above = new Map<FaceId, Set<FaceId>>(ids.map(id => [id, new Set()]))
  const over: [FaceId, FaceId][] = []
  const scale = Math.max(m.sheet.width, m.sheet.height, 1)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]!, b = ids[j]!
      const pa = images.get(a)!, pb = images.get(b)!
      if (!convex(pa) || !convex(pb)) throw new Error(`face ${!convex(pa) ? a : b} is not convex: a model's faces must be`)
      const common = clip(pa, pb)
      if (common.length < 3 || polyArea(common) < tol * scale * 10) continue
      // A point inside both, back in each face's own sheet frame
      const cx = common.reduce((s, p) => s + p[0], 0) / common.length, cy = common.reduce((s, p) => s + p[1], 0) / common.length
      const sheetPt = (id: FaceId): Pt => { const v = transform(invert4(end.faces[id]!.matrix), [cx, cy, 0]); return [v[0], v[1]] }
      const sa = sheetPt(a), sb = sheetPt(b)
      const z = (p: Pose, id: FaceId, s: Pt) => transform(p.faces[id]!.matrix, [s[0], s[1], 0])[2]
      let aOver: boolean
      const dz = z(end, a, sa) - z(end, b, sb)
      if (Math.abs(dz) > tol * 10) aOver = dz > 0
      else if (sameMat(relative(start.faces[a]!.matrix, start.faces[b]!.matrix), relative(end.faces[a]!.matrix, end.faces[b]!.matrix), 1e-7 * scale)) {
        const before = (prev.layer[a] ?? 0) - (prev.layer[b] ?? 0)
        if (before === 0) throw new Error(`faces ${a} and ${b} overlap at keyframe ${k} and lay level at keyframe ${k - 1}: the layer order is undefined`)
        const turned = (prev.up[a] ?? 1) !== up[a]
        aOver = (before > 0) !== turned
      } else {
        const dn = z(near, a, sa) - z(near, b, sb)
        if (Math.abs(dn) < tol) throw new Error(`faces ${a} and ${b} land on each other at keyframe ${k} from no side: the layer order is undefined`)
        aOver = dn > 0
      }
      if (aOver) above.get(a)!.add(b)
      else above.get(b)!.add(a)
      over.push(aOver ? [a, b] : [b, a])
    }
  }
  // Longest chain from the bottom: a face's layer is one over the highest face it lies on
  const memo = new Map<FaceId, number>()
  const visiting = new Set<FaceId>()
  const depth = (id: FaceId): number => {
    const known = memo.get(id)
    if (known !== undefined) return known
    if (visiting.has(id)) throw new Error(`the faces at keyframe ${k} lie over each other in a cycle through ${id}`)
    visiting.add(id)
    let d = 0
    for (const b of above.get(id)!) d = Math.max(d, depth(b) + 1)
    visiting.delete(id)
    memo.set(id, d)
    return d
  }
  const base = depth(m.root)
  for (const f of m.faces) { layer[f.id] = f.page ? 0 : depth(f.id) - base; up[f.id] ??= 1 }
  for (const c of treeCreases(m)) step[c.id] = (layer[c.child]! - layer[c.parent]!) * up[c.parent]!
  return { layer, up, step, over }
}
