// The fold model: a sheet as rigid faces joined by creases, with a hinge tree rooted on the
// face that stays put (docs/design/01-decisions.md D1, D3; docs/study/01-how-paper-folds.md
// section 1). Every face is a flat polygon in sheet coordinates (page coordinates: x right,
// y down, origin top left); every crease is a straight segment on an edge its two faces share.
// `validate` is the one place the invariants are checked; the named folds are tested against it.
import type { Pt } from './affine.ts'
import type { Schedule } from './schedule.ts'

export type FaceId = string
export type CreaseId = string

/** FOLD's assignment, in the subset the engine poses: mountain, valley, or flat (a pre-crease that stays at 0). */
export type Assignment = 'M' | 'V' | 'F'

/** A face's print tone class: two lit and two shade slots alternate along a strip (docs/design/02-look.md). */
export type Slot = 'lit' | 'lit2' | 'shade' | 'shade2'

/** The rectangles a named fold suits (D7). */
export type Suits = 'wide' | 'square' | 'tall' | 'list'

export interface Sheet {
  width: number
  height: number
  /** The sheet is a shape cut from the box (a glyph's strip): the faces need not tile it. */
  cut?: boolean
}

export interface Face {
  id: FaceId
  /** The polygon in sheet coordinates, flat. */
  pts: Pt[]
  /** The print tone class, for faces that are painted paper (glyphs) rather than content. */
  slot?: Slot
  /** The face is the page the block is folded out of (a lift's root): the host's sheet, not drawn, outside the box. */
  page?: boolean
  /** The crease a shade face's crease gradient falls from, when not the one it hangs on (a glyph's middle facet is the root and hangs on none, yet reads as creased from a neighbour). Must lie on an edge of the face. */
  seam?: CreaseId
}

export interface Crease {
  id: CreaseId
  /** The shared edge, a to b, in sheet coordinates. */
  a: Pt
  b: Pt
  assignment: Assignment
  /** The face that stays (or moves with its own parent). */
  parent: FaceId
  /** The face that turns about this crease. */
  child: FaceId
  /** The angle magnitude, in radians, the child sits at when the fold is fully folded: Math.PI for a flap lying flat over, 0 for F. The sign comes from the assignment (valley positive, FOLD's convention). */
  closed: number
  /** A closing crease: not in the hinge tree, its angle solved per frame so the loop of faces around an interior vertex closes (D3). */
  closing?: boolean
}

/** An interior vertex's closure: the one crease left out of the tree, and the creases whose angle is solved so it closes. */
export interface Closure {
  /** The interior vertex, in sheet coordinates. */
  vertex: Pt
  closing: CreaseId
  /** The creases that share one solved magnitude (the symmetric bases' two valleys). */
  solved: CreaseId[]
  /** The unit direction, in the sheet, along which the closing crease's gap is measured for the bisection: the normal of the fold's mirror plane. */
  across: Pt
}

export interface Fold {
  /** The named fold this is an instance of, when it is one. */
  name?: string
  sheet: Sheet
  faces: Face[]
  creases: Crease[]
  root: FaceId
  schedule?: Schedule
  closures?: Closure[]
  suits?: Suits[]
  /** Keys read from a FOLD file that the engine does not interpret, kept so they round-trip. */
  extra?: Record<string, unknown>
}

/** The sign a crease's angle takes: valley positive, mountain negative, flat none. */
export const sign = (assignment: Assignment) => assignment === 'V' ? 1 : assignment === 'M' ? -1 : 0

export const face = (fold: Fold, id: FaceId): Face => {
  const f = fold.faces.find(f => f.id === id)
  if (!f) throw new Error(`no face ${id}`)
  return f
}

export const crease = (fold: Fold, id: CreaseId): Crease => {
  const c = fold.creases.find(c => c.id === id)
  if (!c) throw new Error(`no crease ${id}`)
  return c
}

/** The creases that hinge a child on its parent: every crease but the closing ones. */
export const treeCreases = (fold: Fold) => fold.creases.filter(c => !c.closing)

/** Geometric tolerance for a fold, relative to its sheet. */
export const tolerance = (fold: Fold) => 1e-6 * Math.max(fold.sheet.width, fold.sheet.height, 1)

/** Signed area of a polygon (shoelace); the sign says the winding. */
export function area(pts: Pt[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!
    s += p[0] * q[1] - q[0] * p[1]
  }
  return s / 2
}

export function centroid(pts: Pt[]): Pt {
  const n = pts.length || 1
  return pts.reduce<Pt>((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n], [0, 0])
}

/** 2D cross product (u x v).z. */
export const cross = (u: Pt, v: Pt) => u[0] * v[1] - u[1] * v[0]

/** Whether p lies on the segment a-b, within tol. */
export function onSegment(p: Pt, a: Pt, b: Pt, tol: number): boolean {
  const ab: Pt = [b[0] - a[0], b[1] - a[1]], ap: Pt = [p[0] - a[0], p[1] - a[1]]
  const len = Math.hypot(ab[0], ab[1])
  if (len < tol) return Math.hypot(ap[0], ap[1]) < tol
  const off = Math.abs(cross(ab, ap)) / len
  const along = (ab[0] * ap[0] + ab[1] * ap[1]) / len
  return off < tol && along > -tol && along < len + tol
}

/** Whether the segment a-b lies on one edge of the polygon. */
export function onEdge(pts: Pt[], a: Pt, b: Pt, tol: number): boolean {
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!
    if (onSegment(a, p, q, tol) && onSegment(b, p, q, tol)) return true
  }
  return false
}

/** Whether the segment a-b lies inside the polygon or on its outline (a hinge on a page face, D13). Checks the ends and the midpoint, which is exact for a convex page. */
export function onOrInside(pts: Pt[], a: Pt, b: Pt, tol: number): boolean {
  const ok = (p: Pt) => inside(p, pts) || pts.some((q, i) => onSegment(p, q, pts[(i + 1) % pts.length]!, tol))
  return ok(a) && ok(b) && ok([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
}

export function convex(pts: Pt[]): boolean {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!, r = pts[(i + 2) % pts.length]!
    const c = cross([q[0] - p[0], q[1] - p[1]], [r[0] - q[0], r[1] - q[1]])
    if (Math.abs(c) < 1e-12) continue
    if (s === 0) s = Math.sign(c)
    else if (Math.sign(c) !== s) return false
  }
  return true
}

export function inside(p: Pt, pts: Pt[]): boolean {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!, b = pts[j]!
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit
  }
  return hit
}

/** Whether two polygons share interior area (not merely an edge or a point). Exact for convex polygons (separating axis), a centroid test otherwise. */
export function overlaps(p: Pt[], q: Pt[], tol: number): boolean {
  if (!convex(p) || !convex(q)) return inside(centroid(p), q) || inside(centroid(q), p)
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!, b = poly[(i + 1) % poly.length]!
      const n: Pt = [-(b[1] - a[1]), b[0] - a[0]]
      const len = Math.hypot(n[0], n[1])
      if (len < tol) continue
      const proj = (pts: Pt[]) => {
        let lo = Infinity, hi = -Infinity
        for (const v of pts) { const d = (v[0] * n[0] + v[1] * n[1]) / len; lo = Math.min(lo, d); hi = Math.max(hi, d) }
        return [lo, hi] as const
      }
      const [pl, ph] = proj(p), [ql, qh] = proj(q)
      if (ph <= ql + tol || qh <= pl + tol) return false
    }
  }
  return true
}

/**
 * The model's invariants, as a list of problems (empty when the fold is sound): ids unique, the
 * creases a tree rooted at `root` reaching every face, every crease on an edge both its faces
 * share, faces inside the sheet and never overlapping, and, unless the sheet is cut, tiling it.
 */
export function validate(fold: Fold): string[] {
  const problems: string[] = []
  const tol = tolerance(fold)
  const faces = new Map<FaceId, Face>()
  for (const f of fold.faces) {
    if (faces.has(f.id)) problems.push(`duplicate face id ${f.id}`)
    faces.set(f.id, f)
    if (f.pts.length < 3) problems.push(`face ${f.id} has fewer than 3 points`)
    if (Math.abs(area(f.pts)) < tol * tol) problems.push(`face ${f.id} has no area`)
  }
  const creases = new Map<CreaseId, Crease>()
  for (const c of fold.creases) {
    if (creases.has(c.id)) problems.push(`duplicate crease id ${c.id}`)
    creases.set(c.id, c)
  }
  if (!faces.has(fold.root)) problems.push(`root face ${fold.root} does not exist`)

  // Every crease joins two existing, different faces on an edge they share
  for (const c of fold.creases) {
    const p = faces.get(c.parent), ch = faces.get(c.child)
    if (!p) problems.push(`crease ${c.id}: parent face ${c.parent} does not exist`)
    if (!ch) problems.push(`crease ${c.id}: child face ${c.child} does not exist`)
    if (c.parent === c.child) problems.push(`crease ${c.id} joins face ${c.parent} to itself`)
    if (Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]) < tol) problems.push(`crease ${c.id} has no length`)
    // The page is the ground, not a piece of the sheet: a face may be hinged on it anywhere inside it (D13)
    if (p && !(p.page ? onOrInside(p.pts, c.a, c.b, tol) : onEdge(p.pts, c.a, c.b, tol))) problems.push(`crease ${c.id} is not on ${p.page ? 'the page' : 'an edge of its parent'} ${c.parent}`)
    if (ch && !onEdge(ch.pts, c.a, c.b, tol)) problems.push(`crease ${c.id} is not on an edge of its child ${c.child}`)
    if (c.assignment === 'F' && c.closed !== 0) problems.push(`crease ${c.id} is flat but closes at ${c.closed}`)
    if (c.closed < 0 || c.closed > Math.PI + 1e-9) problems.push(`crease ${c.id} closes outside [0, pi]`)
  }

  for (const f of fold.faces) {
    if (f.seam === undefined) continue
    const c = creases.get(f.seam)
    if (!c) problems.push(`face ${f.id}: seam ${f.seam} does not exist`)
    else if (!onEdge(f.pts, c.a, c.b, tol)) problems.push(`face ${f.id}: seam ${f.seam} is not on its edge`)
  }

  // The tree creases: one hinge per face but the root, every face reached from the root, no cycle
  const hinge = new Map<FaceId, Crease>()
  for (const c of treeCreases(fold)) {
    if (c.child === fold.root) problems.push(`crease ${c.id} hinges the root ${fold.root}`)
    if (hinge.has(c.child)) problems.push(`face ${c.child} hangs on two creases (${hinge.get(c.child)!.id}, ${c.id})`)
    hinge.set(c.child, c)
  }
  const seen = new Set<FaceId>()
  const queue: FaceId[] = faces.has(fold.root) ? [fold.root] : []
  seen.add(fold.root)
  while (queue.length) {
    const id = queue.shift()!
    for (const c of treeCreases(fold)) {
      if (c.parent !== id) continue
      if (seen.has(c.child)) { problems.push(`crease ${c.id} closes a cycle at face ${c.child}`); continue }
      seen.add(c.child)
      queue.push(c.child)
    }
  }
  for (const f of fold.faces) if (!seen.has(f.id)) problems.push(`face ${f.id} is not reachable from the root`)

  // Closing creases belong to a closure, and a closure's creases exist
  for (const cl of fold.closures ?? []) {
    const c = creases.get(cl.closing)
    if (!c) problems.push(`closure: closing crease ${cl.closing} does not exist`)
    else if (!c.closing) problems.push(`closure: crease ${cl.closing} is not marked closing`)
    for (const id of cl.solved) {
      const s = creases.get(id)
      if (!s) problems.push(`closure: solved crease ${id} does not exist`)
      else if (s.closing) problems.push(`closure: solved crease ${id} is a closing crease`)
    }
  }
  for (const c of fold.creases) {
    if (c.closing && !(fold.closures ?? []).some(cl => cl.closing === c.id)) problems.push(`closing crease ${c.id} has no closure`)
  }

  // The flat sheet: faces inside the box, none overlapping, tiling it unless the sheet is cut
  const { width, height } = fold.sheet
  const sheetFaces = fold.faces.filter(f => !f.page)
  for (const f of sheetFaces) {
    for (const [x, y] of f.pts) {
      if (x < -tol || y < -tol || x > width + tol || y > height + tol) { problems.push(`face ${f.id} leaves the sheet`); break }
    }
  }
  for (let i = 0; i < sheetFaces.length; i++) {
    for (let j = i + 1; j < sheetFaces.length; j++) {
      const p = sheetFaces[i]!, q = sheetFaces[j]!
      if (overlaps(p.pts, q.pts, tol)) problems.push(`faces ${p.id} and ${q.id} overlap`)
    }
  }
  if (!fold.sheet.cut) {
    const sum = sheetFaces.reduce((s, f) => s + Math.abs(area(f.pts)), 0)
    if (Math.abs(sum - width * height) > tol * Math.max(width, height) * 4) problems.push(`faces cover ${sum} of the sheet's ${width * height}`)
  }
  return problems
}

/** `validate`, throwing on the first problem. */
export function assertValid(fold: Fold): Fold {
  const problems = validate(fold)
  if (problems.length) throw new Error(`invalid fold${fold.name ? ` ${fold.name}` : ''}: ${problems.join('; ')}`)
  return fold
}

/** The crease a face's shade gradient falls from: its `seam`, else the tree crease it hangs on, else none (a root). */
export function seamOf(fold: Fold, faceId: FaceId): Crease | null {
  const f = face(fold, faceId)
  if (f.seam) return crease(fold, f.seam)
  return treeCreases(fold).find(c => c.child === faceId) ?? null
}

/** The creases drawn as on shade (`crease.onShade`): each the seam of a shade face. */
export function shadeSeams(fold: Fold): Set<CreaseId> {
  const out = new Set<CreaseId>()
  for (const f of fold.faces) {
    if (f.slot !== 'shade' && f.slot !== 'shade2') continue
    const c = seamOf(fold, f.id)
    if (c) out.add(c.id)
  }
  return out
}
