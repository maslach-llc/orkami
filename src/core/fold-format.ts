// FOLD-format import and export (docs/study/01-how-paper-folds.md section 2;
// docs/design/01-decisions.md D2). The export writes the subset Origami Simulator and Rabbit
// Ear read (vertices, edges, assignments, the closed state's fold angles and face orders, one
// `foldedForm` frame with the closed pose) and orkami's own data (the hinge tree, the schedule,
// the sheet, the closures) under `orkami:`-namespaced keys, so a file opened elsewhere still
// folds. The import takes any FOLD pattern frame, builds the hinge tree breadth-first from the
// root when the file does not carry one, and keeps every key it does not interpret in `extra`.
import type { Pt } from './affine.ts'
import {
  assertValid, onSegment, sign, tolerance,
  type Assignment, type Closure, type Crease, type CreaseId, type Face, type FaceId, type Fold, type Sheet, type Slot, type Suits,
} from './fold.ts'
import { pose } from './pose.ts'
import { BASE, type Schedule } from './schedule.ts'
import type { Vec3 } from './space.ts'
import { hingeTree } from './tree.ts'

export interface FOLD {
  file_spec?: number
  file_creator?: string
  file_title?: string
  file_classes?: string[]
  frame_classes?: string[]
  frame_attributes?: string[]
  frame_unit?: string
  vertices_coords?: number[][]
  edges_vertices?: [number, number][]
  edges_assignment?: string[]
  edges_foldAngle?: (number | null)[]
  faces_vertices?: number[][]
  faceOrders?: [number, number, number][]
  file_frames?: FOLD[]
  frame_parent?: number
  frame_inherit?: boolean
  [key: string]: unknown
}

/** The sheet's closure as it is written to the file: crease ids become edge indices. */
export interface FOLDClosure {
  vertex: Pt
  closing: number
  solved: number[]
  across: Pt
}

const edgeKey = (u: number, v: number) => u < v ? `${u},${v}` : `${v},${u}`
const same = (p: Pt, q: Pt, tol: number) => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol

// ---------------------------------------------------------------------------------------------
// Export

/** A fold as a FOLD file (spec 1.2): the crease pattern as the key frame, the closed pose as a `foldedForm` child frame. Assumes `validate(fold)` passed. */
export function toFOLD(fold: Fold): FOLD {
  const tol = tolerance(fold)

  // Vertices: the distinct points of the faces in order of first appearance, then the crease
  // endpoints that are not face corners (a glyph bar hinged inside the stem's edge)
  const coords: Pt[] = []
  const indexOf = (p: Pt): number => {
    const i = coords.findIndex(q => same(p, q, tol))
    if (i >= 0) return i
    coords.push([p[0], p[1]])
    return coords.length - 1
  }
  const corners = fold.faces.map(f => f.pts.map(indexOf))
  for (const c of fold.creases) { indexOf(c.a); indexOf(c.b) }

  // T-junctions: a vertex strictly inside a face's edge is inserted into that face, in order
  // along the edge; the vertex's posed position comes from the first face that has it as a
  // corner, else from the posed edge it was inserted into
  const closed = pose(fold, 0)
  const posed: (Vec3 | undefined)[] = coords.map(() => undefined)
  fold.faces.forEach((f, fi) => {
    const fp = closed.faces[f.id]!
    corners[fi]!.forEach((v, k) => { posed[v] ??= fp.pts[k] })
  })
  const faces_vertices: number[][] = fold.faces.map((f, fi) => {
    const fp = closed.faces[f.id]!
    const out: number[] = []
    const own = corners[fi]!
    for (let k = 0; k < own.length; k++) {
      const vi = own[k]!, vj = own[(k + 1) % own.length]!
      const p = coords[vi]!, q = coords[vj]!
      out.push(vi)
      const len = Math.hypot(q[0] - p[0], q[1] - p[1])
      const inside: { v: number, t: number }[] = []
      coords.forEach((c, v) => {
        if (v === vi || v === vj || own.includes(v)) return
        if (!onSegment(c, p, q, tol)) return
        const t = ((c[0] - p[0]) * (q[0] - p[0]) + (c[1] - p[1]) * (q[1] - p[1])) / (len * len)
        if (t > 0 && t < 1) inside.push({ v, t })
      })
      inside.sort((a, b) => a.t - b.t)
      const P = fp.pts[k]!, Q = fp.pts[(k + 1) % own.length]!
      for (const { v, t } of inside) {
        out.push(v)
        posed[v] ??= [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, P[2] + (Q[2] - P[2]) * t]
      }
    }
    return out
  })

  // Edges: every face's consecutive vertex pairs, once each, in order of first appearance
  const edges_vertices: [number, number][] = []
  const edgeIndex = new Map<string, number>()
  const edgeFaces: number[][] = []
  faces_vertices.forEach((fv, fi) => {
    for (let k = 0; k < fv.length; k++) {
      const u = fv[k]!, v = fv[(k + 1) % fv.length]!
      const key = edgeKey(u, v)
      let e = edgeIndex.get(key)
      if (e === undefined) {
        e = edges_vertices.length
        edgeIndex.set(key, e)
        edges_vertices.push([u, v])
        edgeFaces.push([])
      }
      edgeFaces[e]!.push(fi)
    }
  })

  // The crease on each edge: the one whose endpoints are the edge's two vertices. The pair is
  // written a to b, the crease's own direction, so it survives the round trip
  const creaseOnEdge: (Crease | undefined)[] = edges_vertices.map(() => undefined)
  const edgeOfCrease = new Map<CreaseId, number>()
  for (const c of fold.creases) {
    const a = indexOf(c.a), b = indexOf(c.b)
    const e = edgeIndex.get(edgeKey(a, b))
    if (e === undefined) throw new Error(`crease ${c.id} is not an edge of the pattern`)
    creaseOnEdge[e] = c
    edgeOfCrease.set(c.id, e)
    edges_vertices[e] = [a, b]
  }
  const edges_assignment = edges_vertices.map((_, e) => {
    const c = creaseOnEdge[e]
    if (c) return c.assignment
    return edgeFaces[e]!.length === 1 ? 'B' : 'U'
  })
  const edges_foldAngle = edges_vertices.map((_, e) => {
    const c = creaseOnEdge[e]
    return c ? sign(c.assignment) * c.closed * 180 / Math.PI : 0
  })

  const faceIndex = new Map(fold.faces.map((f, i) => [f.id, i]))
  const faceOrders: [number, number, number][] = []
  for (const c of fold.creases) {
    if (Math.abs(c.closed - Math.PI) < 1e-9 && c.assignment !== 'F') {
      faceOrders.push([faceIndex.get(c.child)!, faceIndex.get(c.parent)!, c.assignment === 'V' ? 1 : -1])
    }
  }

  const tree = hingeTree(fold)
  const out: FOLD = {
    ...fold.extra,
    file_spec: 1.2,
    file_creator: 'orkami',
    ...(fold.name !== undefined ? { file_title: fold.name } : {}),
    file_classes: ['singleModel'],
    frame_classes: ['creasePattern'],
    frame_attributes: ['2D'],
    frame_unit: 'unit',
    vertices_coords: coords.map(p => [p[0], p[1]]),
    edges_vertices,
    edges_assignment,
    edges_foldAngle,
    faces_vertices,
    faceOrders,
    'faces_orkami:id': fold.faces.map(f => f.id),
    'faces_orkami:parent': fold.faces.map(f => { const p = tree.parent[f.id]; return p == null ? null : faceIndex.get(p)! }),
    ...(fold.faces.some(f => f.slot !== undefined) ? { 'faces_orkami:slot': fold.faces.map(f => f.slot ?? null) } : {}),
    ...(fold.faces.some(f => f.page) ? { 'faces_orkami:page': fold.faces.map(f => !!f.page) } : {}),
    ...(fold.faces.some(f => f.seam) ? { 'faces_orkami:seam': fold.faces.map(f => f.seam ?? null) } : {}),
    'edges_orkami:id': creaseOnEdge.map(c => c?.id ?? null),
    ...(fold.creases.some(c => c.closing) ? { 'edges_orkami:closing': creaseOnEdge.map(c => c ? !!c.closing : null) } : {}),
    ...(fold.schedule ? {
      'edges_orkami:start': creaseOnEdge.map(c => c && fold.schedule!.creases[c.id] ? fold.schedule!.creases[c.id]!.start : null),
      'edges_orkami:duration': creaseOnEdge.map(c => c && fold.schedule!.creases[c.id] ? fold.schedule!.creases[c.id]!.duration : null),
      ...(Object.values(fold.schedule.creases).some(e => e.follow) ? {
        'edges_orkami:follow': creaseOnEdge.map(c => { const f = c && fold.schedule!.creases[c.id]?.follow; return f ? [f.crease, f.ratio] : null }),
      } : {}),
      'frame_orkami:total': fold.schedule.total,
    } : {}),
    'frame_orkami:sheet': { width: fold.sheet.width, height: fold.sheet.height, ...(fold.sheet.cut ? { cut: true } : {}) },
    ...(fold.suits ? { 'frame_orkami:suits': [...fold.suits] } : {}),
    ...(fold.closures ? {
      'frame_orkami:closures': fold.closures.map((cl): FOLDClosure => ({
        vertex: [cl.vertex[0], cl.vertex[1]],
        closing: edgeOfCrease.get(cl.closing)!,
        solved: cl.solved.map(id => edgeOfCrease.get(id)!),
        across: [cl.across[0], cl.across[1]],
      })),
    } : {}),
    file_frames: [{
      frame_classes: ['foldedForm'],
      frame_attributes: ['3D'],
      frame_parent: 0,
      frame_inherit: true,
      vertices_coords: posed.map((p, v) => p ? [p[0], p[1], p[2]] : [coords[v]![0], coords[v]![1], 0]),
    }],
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Import

export interface FromFOLDOptions {
  /** The face that stays put, as an index into `faces_vertices` or a face id; default the file's root, else face 0. */
  root?: number | string
}

/** The keys the importer reads into the model; everything else goes to `extra`. */
const CONSUMED = new Set([
  'file_spec', 'file_creator', 'file_classes', 'file_title', 'frame_classes', 'frame_attributes', 'frame_unit',
  'file_frames', 'frame_parent', 'frame_inherit',
  'vertices_coords', 'edges_vertices', 'edges_assignment', 'edges_foldAngle', 'faces_vertices', 'faceOrders',
])
const consumed = (key: string) => CONSUMED.has(key) || key.startsWith('faces_orkami:') || key.startsWith('edges_orkami:') || key.startsWith('frame_orkami:')

/** Frame 0 is the top level minus `file_frames`; a frame with `frame_inherit` takes its parent's keys under its own. */
function resolveFrames(json: FOLD): FOLD[] {
  const { file_frames, ...top } = json
  const frames: FOLD[] = [top, ...(file_frames ?? [])]
  const resolved = new Map<number, FOLD>()
  const resolve = (i: number, seen: number[]): FOLD => {
    const hit = resolved.get(i)
    if (hit) return hit
    const frame = frames[i]
    if (!frame) throw new Error(`FOLD frame ${i} does not exist`)
    if (seen.includes(i)) throw new Error(`FOLD frame ${i} inherits from itself`)
    let out: FOLD = frame
    if (frame.frame_inherit && frame.frame_parent !== undefined) out = { ...resolve(frame.frame_parent, [...seen, i]), ...frame }
    resolved.set(i, out)
    return out
  }
  return frames.map((_, i) => resolve(i, []))
}

const isArray = (v: unknown): v is unknown[] => Array.isArray(v)
const arrayKey = <T>(frame: FOLD, key: string, n: number): T[] | undefined => {
  const v = frame[key]
  if (v === undefined || v === null) return undefined
  if (!isArray(v) || v.length !== n) throw new Error(`FOLD ${key} must be an array of ${n}`)
  return v as T[]
}

/** A fold from a FOLD file: the first `creasePattern` frame (else frame 0), the hinge tree from the file's own data or breadth-first from the root. The result passes `validate`. */
export function fromFOLD(json: FOLD, options: FromFOLDOptions = {}): Fold {
  const frames = resolveFrames(json)
  const frame = frames.find(f => isArray(f.frame_classes) && f.frame_classes.includes('creasePattern')) ?? frames[0]!
  const isPattern = isArray(frame.frame_classes) && frame.frame_classes.includes('creasePattern')

  // Vertices, 2D; a 3D pattern frame is projected by dropping z
  const rawCoords = frame.vertices_coords
  if (!isArray(rawCoords)) throw new Error('FOLD pattern has no vertices_coords')
  const is3D = (isArray(frame.frame_attributes) && frame.frame_attributes.includes('3D'))
    || rawCoords.some(c => isArray(c) && c.length > 2 && Math.abs(Number(c[2])) > 1e-9)
  if (is3D && !isPattern) throw new Error('FOLD frame is 3D and not a creasePattern: it cannot be imported as a pattern')
  const coords: Pt[] = rawCoords.map((c, i) => {
    if (!isArray(c) || c.length < 2 || typeof c[0] !== 'number' || typeof c[1] !== 'number') throw new Error(`FOLD vertex ${i} has no x, y`)
    return [c[0], c[1]]
  })

  // Faces
  const faces_vertices = frame.faces_vertices
  if (!isArray(faces_vertices)) throw new Error('FOLD pattern has no faces_vertices')
  const nf = faces_vertices.length
  const faceIds = arrayKey<unknown>(frame, 'faces_orkami:id', nf)
  const slots = arrayKey<unknown>(frame, 'faces_orkami:slot', nf)
  const pages = arrayKey<unknown>(frame, 'faces_orkami:page', nf)
  const seams = arrayKey<unknown>(frame, 'faces_orkami:seam', nf)
  const faces: Face[] = faces_vertices.map((fv, i) => {
    if (!isArray(fv)) throw new Error(`FOLD face ${i} has no vertices`)
    const pts = fv.map(v => {
      const p = typeof v === 'number' ? coords[v] : undefined
      if (!p) throw new Error(`FOLD face ${i} uses a vertex that does not exist: ${String(v)}`)
      return [p[0], p[1]] as Pt
    })
    const face: Face = { id: typeof faceIds?.[i] === 'string' ? faceIds[i] as string : `f${i}`, pts }
    const slot = slots?.[i]
    if (typeof slot === 'string') face.slot = slot as Slot
    if (pages?.[i]) face.page = true
    if (typeof seams?.[i] === 'string') face.seam = seams[i] as string
    return face
  })
  const faceOf = (id: string) => faces.findIndex(f => f.id === id)

  // Edges: the faces on each (by its consecutive vertex pairs), assignment, closed angle
  const edges_vertices = frame.edges_vertices
  if (!isArray(edges_vertices)) throw new Error('FOLD pattern has no edges_vertices')
  const ne = edges_vertices.length
  const edgeFaces = new Map<string, number[]>()
  faces_vertices.forEach((fv, fi) => {
    const vs = fv as number[]
    for (let k = 0; k < vs.length; k++) {
      const key = edgeKey(vs[k]!, vs[(k + 1) % vs.length]!)
      const list = edgeFaces.get(key) ?? []
      list.push(fi)
      edgeFaces.set(key, list)
    }
  })
  const assignments = arrayKey<unknown>(frame, 'edges_assignment', ne)
  const angles = arrayKey<unknown>(frame, 'edges_foldAngle', ne)
  const creaseIds = arrayKey<unknown>(frame, 'edges_orkami:id', ne)
  const closingFlags = arrayKey<unknown>(frame, 'edges_orkami:closing', ne)
  const starts = arrayKey<unknown>(frame, 'edges_orkami:start', ne)
  const durations = arrayKey<unknown>(frame, 'edges_orkami:duration', ne)
  const follows = arrayKey<unknown>(frame, 'edges_orkami:follow', ne)
  const parents = arrayKey<unknown>(frame, 'faces_orkami:parent', nf)

  interface EdgeInfo { faces: number[], assignment: Assignment, closed: number, id: CreaseId, a: Pt, b: Pt }
  const creaseEdges = new Map<number, EdgeInfo>()
  edges_vertices.forEach((ev, e) => {
    if (!isArray(ev) || ev.length !== 2 || typeof ev[0] !== 'number' || typeof ev[1] !== 'number') throw new Error(`FOLD edge ${e} has no two vertices`)
    const [u, v] = ev as [number, number]
    const a = coords[u], b = coords[v]
    if (!a || !b) throw new Error(`FOLD edge ${e} uses a vertex that does not exist`)
    const onFaces = edgeFaces.get(edgeKey(u, v)) ?? []
    if (onFaces.length > 2) throw new Error(`FOLD edge ${e} belongs to ${onFaces.length} faces`)
    const angleRaw = angles?.[e]
    const angle = typeof angleRaw === 'number' ? angleRaw : undefined
    let assignment: string | undefined = typeof assignments?.[e] === 'string' ? assignments[e] as string : undefined
    if (assignment === 'C' || assignment === 'J') throw new Error(`FOLD edge ${e} is a ${assignment === 'C' ? 'cut' : 'join'}: not one sheet (D2)`)
    if (assignment === undefined) {
      if (angle !== undefined) assignment = angle > 0 ? 'V' : angle < 0 ? 'M' : onFaces.length === 2 ? 'F' : 'B'
      else assignment = onFaces.length === 2 ? 'U' : 'B'
    }
    if (assignment === 'U' && onFaces.length === 2) throw new Error(`FOLD pattern cannot be posed: edge ${e} is unassigned`)
    if (assignment !== 'M' && assignment !== 'V' && assignment !== 'F') return
    if (onFaces.length !== 2) return
    const closed = assignment === 'F' ? 0 : angle !== undefined ? Math.abs(angle) * Math.PI / 180 : Math.PI
    const id = typeof creaseIds?.[e] === 'string' ? creaseIds[e] as string : `e${e}`
    creaseEdges.set(e, { faces: onFaces, assignment, closed, id, a: [a[0], a[1]], b: [b[0], b[1]] })
  })

  // The hinge tree: from the file's parents, else breadth-first from the root over the creases
  let root: number
  if (options.root !== undefined) {
    root = typeof options.root === 'number' ? options.root : faceOf(options.root)
    if (root < 0 || root >= nf) throw new Error(`FOLD root face ${String(options.root)} does not exist`)
  } else {
    root = parents ? parents.findIndex(p => p === null || p === undefined) : 0
    if (root < 0) throw new Error('FOLD faces_orkami:parent has no root (a null entry)')
  }
  const parentOf: (number | null)[] = faces.map(() => null)
  const order: number[] = [root]
  const treeEdge = new Set<number>()
  const edgesOfFace = (fi: number) => [...creaseEdges].filter(([, info]) => info.faces.includes(fi)).map(([e]) => e)
  if (parents && options.root === undefined) {
    parents.forEach((p, i) => {
      if (i === root) return
      if (typeof p !== 'number' || p < 0 || p >= nf) throw new Error(`FOLD faces_orkami:parent[${i}] is not a face index`)
      parentOf[i] = p
      const joining = edgesOfFace(i).filter(e => creaseEdges.get(e)!.faces.includes(p))
      const e = joining.find(e => closingFlags?.[e] !== true) ?? joining[0]
      if (e !== undefined) treeEdge.add(e)
    })
    // Breadth-first order over the given tree, for the closing creases' direction
    for (let i = 0; i < order.length; i++) {
      parentOf.forEach((p, child) => { if (p === order[i] && !order.includes(child)) order.push(child) })
    }
  } else {
    const seen = new Set([root])
    for (let i = 0; i < order.length; i++) {
      const fi = order[i]!
      for (const e of edgesOfFace(fi)) {
        const other = creaseEdges.get(e)!.faces.find(f => f !== fi)!
        if (seen.has(other)) continue
        seen.add(other)
        parentOf[other] = fi
        treeEdge.add(e)
        order.push(other)
      }
    }
  }
  const rank = new Map(order.map((fi, i) => [fi, i]))

  const creases: Crease[] = []
  for (const [e, info] of creaseEdges) {
    const [p, q] = info.faces as [number, number]
    let parent: number, child: number
    if (treeEdge.has(e)) {
      [parent, child] = parentOf[p] === q ? [q, p] : [p, q]
    } else {
      [parent, child] = (rank.get(p) ?? Infinity) <= (rank.get(q) ?? Infinity) ? [p, q] : [q, p]
    }
    const c: Crease = { id: info.id, a: info.a, b: info.b, assignment: info.assignment, parent: faces[parent]!.id, child: faces[child]!.id, closed: info.closed }
    if (!treeEdge.has(e) || closingFlags?.[e] === true) c.closing = true
    creases.push(c)
  }
  const creaseIdOfEdge = (e: unknown): CreaseId => {
    const info = typeof e === 'number' ? creaseEdges.get(e) : undefined
    if (!info) throw new Error(`FOLD frame_orkami:closures names edge ${String(e)}, which is not a crease`)
    return info.id
  }

  // Sheet, from the file's or the vertices' extent (page faces lie outside the box)
  const extent = Math.max(...coords.map(c => Math.max(Math.abs(c[0]), Math.abs(c[1]))), 1)
  const tol = 1e-6 * extent
  const onSheet = faces.filter(f => !f.page).flatMap(f => f.pts)
  for (const [x, y] of onSheet) {
    if (x < -tol || y < -tol) throw new Error(`FOLD pattern has a vertex at (${x}, ${y}): the engine's sheets have their origin at the top left, with x and y at least 0`)
  }
  const sheetRaw = frame['frame_orkami:sheet'] as Partial<Sheet> | undefined
  let sheet: Sheet
  if (sheetRaw && typeof sheetRaw.width === 'number' && typeof sheetRaw.height === 'number') {
    sheet = { width: sheetRaw.width, height: sheetRaw.height, ...(sheetRaw.cut ? { cut: true } : {}) }
  } else {
    sheet = { width: Math.max(0, ...onSheet.map(p => p[0])), height: Math.max(0, ...onSheet.map(p => p[1])) }
  }

  const fold: Fold = { sheet, faces, creases, root: faces[root]!.id }
  if (typeof frame.file_title === 'string') fold.name = frame.file_title

  // Closures: the file's, else one per closing crease with nothing solved
  const closuresRaw = frame['frame_orkami:closures']
  if (isArray(closuresRaw)) {
    fold.closures = closuresRaw.map((raw, i) => {
      const cl = raw as Partial<FOLDClosure>
      if (!isArray(cl.vertex) || !isArray(cl.across) || !isArray(cl.solved)) throw new Error(`FOLD frame_orkami:closures[${i}] is malformed`)
      return {
        vertex: [Number(cl.vertex[0]), Number(cl.vertex[1])],
        closing: creaseIdOfEdge(cl.closing),
        solved: cl.solved.map(creaseIdOfEdge),
        across: [Number(cl.across[0]), Number(cl.across[1])],
      }
    })
  } else if (creases.some(c => c.closing)) {
    const touching = (p: Pt) => creases.filter(c => same(c.a, p, tol) || same(c.b, p, tol)).length
    fold.closures = creases.filter(c => c.closing).map(c => {
      const vertex = touching(c.a) >= touching(c.b) ? c.a : c.b
      const dx = c.b[0] - c.a[0], dy = c.b[1] - c.a[1], len = Math.hypot(dx, dy) || 1
      return { vertex: [vertex[0], vertex[1]], closing: c.id, solved: [], across: [-dy / len, dx / len] }
    })
  }

  // Schedule
  if (starts && durations) {
    const entries: Schedule['creases'] = {}
    for (const [e, info] of creaseEdges) {
      const start = starts[e], duration = durations[e]
      if (typeof start !== 'number' || typeof duration !== 'number') continue
      const f = follows?.[e]
      entries[info.id] = isArray(f) && typeof f[0] === 'string' && typeof f[1] === 'number'
        ? { start, duration, follow: { crease: f[0], ratio: f[1] } }
        : { start, duration }
    }
    const total = frame['frame_orkami:total']
    fold.schedule = { creases: entries, total: typeof total === 'number' ? total : BASE }
  }

  const suits = frame['frame_orkami:suits']
  if (isArray(suits)) fold.suits = suits.map(s => String(s) as Suits)

  const extra: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(frame)) if (!consumed(key)) extra[key] = value
  if (Object.keys(extra).length) fold.extra = extra

  return assertValid(fold)
}
