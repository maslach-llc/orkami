// The traditional crane, step by step, as flat folds through layers (study 04, sections 5 and 6).
// Run: node docs/study/scripts/crane.ts
// Prints every step's new creases in sheet coordinates (unit square, y down, A (0, 0) top left,
// B (1, 0), C (1, 1), D (0, 1)), the layers each one crosses and its assignment, checks that the
// two base states written by hand (the preliminary and the bird base) are isometries of every
// face and agree across every crease, and writes one K-sketch SVG per step to docs/study/img/.
//
// A state is a list of faces, each a convex polygon of the sheet with the isometry that places
// it in the folded image (x right, y up, the model seen from the front, the pq line of the bird
// base on y = 0). A through-fold (section 5) takes a line in the image, the faces it acts on and
// the side that moves: each face whose image the line crosses splits in two, the crease segment
// is the chord mapped back to the sheet through that face's own isometry, and the moving part's
// isometry is composed with the reflection in the line. That is Rabbit Ear's flatFold restricted
// to named layers (reference only, D8); the layer order is not modelled here, only geometry.
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

type Pt = [number, number]
/** x' = a x + b y + e, y' = c x + d y + f */
interface Iso { a: number, b: number, c: number, d: number, e: number, f: number }
interface Face { name: string, poly: Pt[], iso: Iso, half: 'front' | 'back', moved?: string[] }
interface NewCrease { step: number, face: string, a: Pt, b: Pt, assign: 'M' | 'V' }

const t = Math.tan(Math.PI / 8) / 2 // 0.2071: p = (0.5, t)
const s = Math.SQRT1_2 / 2 // 0.3536
const A: Pt = [0, 0], B: Pt = [1, 0], C: Pt = [1, 1], D: Pt = [0, 1], O: Pt = [0.5, 0.5]
const m1: Pt = [0.5, 0], m2: Pt = [1, 0.5], m3: Pt = [0.5, 1], m4: Pt = [0, 0.5]
const p: Pt = [0.5, t], q: Pt = [t, 0.5], pC: Pt = [0.5, 1 - t], qC: Pt = [1 - t, 0.5]

const apply = (m: Iso, [x, y]: Pt): Pt => [m.a * x + m.b * y + m.e, m.c * x + m.d * y + m.f]
const det = (m: Iso) => m.a * m.d - m.b * m.c
function inv(m: Iso): Iso {
  const k = det(m)
  const a = m.d / k, b = -m.b / k, c = -m.c / k, d = m.a / k
  return { a, b, c, d, e: -(a * m.e + b * m.f), f: -(c * m.e + d * m.f) }
}
const comp = (m: Iso, n: Iso): Iso => ({ // m after n
  a: m.a * n.a + m.b * n.c, b: m.a * n.b + m.b * n.d,
  c: m.c * n.a + m.d * n.c, d: m.c * n.b + m.d * n.d,
  e: m.a * n.e + m.b * n.f + m.e, f: m.c * n.e + m.d * n.f + m.f,
})
function reflection(p0: Pt, dir: Pt): Iso {
  const l = Math.hypot(dir[0], dir[1]), ux = dir[0] / l, uy = dir[1] / l
  const a = 2 * ux * ux - 1, b = 2 * ux * uy, d = 2 * uy * uy - 1
  return { a, b, c: b, d, e: p0[0] - a * p0[0] - b * p0[1], f: p0[1] - b * p0[0] - d * p0[1] }
}
/** The affine map taking three sheet points to three image points. */
function fromPoints(src: Pt[], dst: Pt[]): Iso {
  const [p0, p1, p2] = src as [Pt, Pt, Pt], [q0, q1, q2] = dst as [Pt, Pt, Pt]
  const M = [[p1[0] - p0[0], p2[0] - p0[0]], [p1[1] - p0[1], p2[1] - p0[1]]] as const
  const k = M[0][0] * M[1][1] - M[0][1] * M[1][0]
  const Mi = [[M[1][1] / k, -M[0][1] / k], [-M[1][0] / k, M[0][0] / k]] as const
  const X = [[q1[0] - q0[0], q2[0] - q0[0]], [q1[1] - q0[1], q2[1] - q0[1]]] as const
  const a = X[0][0] * Mi[0][0] + X[0][1] * Mi[1][0], b = X[0][0] * Mi[0][1] + X[0][1] * Mi[1][1]
  const c = X[1][0] * Mi[0][0] + X[1][1] * Mi[1][0], d = X[1][0] * Mi[0][1] + X[1][1] * Mi[1][1]
  return { a, b, c, d, e: q0[0] - a * p0[0] - b * p0[1], f: q0[1] - c * p0[0] - d * p0[1] }
}
const face = (name: string, poly: Pt[], img: Pt[], half: Face['half']): Face => ({ name, poly, iso: fromPoints(poly.slice(0, 3), img.slice(0, 3)), half })
// image points: the model seen from outside the preliminary base, centre O up, m1's side on the
// right. The sheet's front is the side the sheet drawings show (y down); it ends up inside.
const I = (x: number, y: number): Pt => [x, y]

// The preliminary base (study 01, 3.8): open end down, centre O on top, the eight eighths in four
// layers; quadrant A in front (O-A flat), quadrant C at the back (O-C flat).
const prelim = (): Face[] => [
  face('QA', [A, m1, O, m4], [I(0, -0.5), I(s, t - s), I(0, t), I(-s, t - s)], 'front'),
  face('T2', [O, m1, B], [I(0, t), I(s, t - s), I(0, -0.5)], 'front'),
  face('Tl\'', [O, D, m4], [I(0, t), I(0, -0.5), I(-s, t - s)], 'front'),
  face('Tr', [O, B, m2], [I(0, t), I(0, -0.5), I(s, t - s)], 'back'),
  face('T7', [O, m3, D], [I(0, t), I(-s, t - s), I(0, -0.5)], 'back'),
  face('QC', [C, m3, O, m2], [I(0, -0.5), I(-s, t - s), I(0, t), I(s, t - s)], 'back'),
]

// The bird base (sections 1 and 6): the twelve faces of the folded creases, petals up, legs down.
const bird = (): Face[] => [
  face('PA', [A, p, q], [I(0, 0.5), I(t, 0), I(-t, 0)], 'front'),
  face('TA', [O, p, q], [I(0, t), I(t, 0), I(-t, 0)], 'front'),
  face('WAB', [A, p, B], [I(0, 0.5), I(t, 0), I(0, -0.5)], 'front'),
  face('WDA', [D, q, A], [I(0, -0.5), I(-t, 0), I(0, 0.5)], 'front'),
  face('LB1', [B, p, O], [I(0, -0.5), I(t, 0), I(0, t)], 'front'),
  face('LD1', [D, q, O], [I(0, -0.5), I(-t, 0), I(0, t)], 'front'),
  face('LB2', [B, O, qC], [I(0, -0.5), I(0, t), I(t, 0)], 'back'),
  face('LD2', [D, O, pC], [I(0, -0.5), I(0, t), I(-t, 0)], 'back'),
  face('PC', [C, pC, qC], [I(0, 0.5), I(-t, 0), I(t, 0)], 'back'),
  face('TC', [O, pC, qC], [I(0, t), I(-t, 0), I(t, 0)], 'back'),
  face('WBC', [B, qC, C], [I(0, -0.5), I(t, 0), I(0, 0.5)], 'back'),
  face('WCD', [C, pC, D], [I(0, 0.5), I(-t, 0), I(0, -0.5)], 'back'),
]

const close = (u: Pt, v: Pt, e = 1e-9) => Math.abs(u[0] - v[0]) < e && Math.abs(u[1] - v[1]) < e
const isoClose = (m: Iso, n: Iso) => ['a', 'b', 'c', 'd', 'e', 'f'].every(k => Math.abs((m as any)[k] - (n as any)[k]) < 1e-9)
const area = (poly: Pt[]) => Math.abs(poly.reduce((acc, u, i) => { const v = poly[(i + 1) % poly.length]!; return acc + u[0] * v[1] - v[0] * u[1] }, 0)) / 2

/** Check a hand-written state: every face's map is an isometry, the faces tile the square, and across every shared edge the two maps agree (flat) or differ by the reflection in the edge (folded). */
function check(label: string, faces: Face[]): void {
  let worst = 0
  for (const f of faces) {
    const m = f.iso
    worst = Math.max(worst, Math.abs(m.a * m.a + m.c * m.c - 1), Math.abs(m.b * m.b + m.d * m.d - 1), Math.abs(m.a * m.b + m.c * m.d))
    f.poly.forEach(u => { const fx = apply(m, u); worst = Math.max(worst, 0 * fx[0]) })
  }
  const total = faces.reduce((acc, f) => acc + area(f.poly), 0)
  const edges: string[] = []
  let bad = 0
  for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
    const F = faces[i]!, G = faces[j]!
    for (let k = 0; k < F.poly.length; k++) {
      const u = F.poly[k]!, v = F.poly[(k + 1) % F.poly.length]!
      const shared = G.poly.some((w, l) => { const x = G.poly[(l + 1) % G.poly.length]!; return (close(w, u) && close(x, v)) || (close(w, v) && close(x, u)) })
      if (!shared) continue
      const folded = isoClose(F.iso, comp(G.iso, reflection(u, [v[0] - u[0], v[1] - u[1]])))
      const flat = isoClose(F.iso, G.iso)
      if (!folded && !flat) bad++
      edges.push(`${F.name}|${G.name} ${folded ? 'folded' : flat ? 'flat' : 'TORN'}`)
    }
  }
  console.log(`${label}: ${faces.length} faces, area ${total.toFixed(12)}, worst isometry error ${worst.toExponential(1)}, ${edges.length} shared edges, ${bad} torn`)
  console.log('  ' + edges.join(', '))
}

function clip(poly: Pt[], p0: Pt, n: Pt, keep: 1 | -1): Pt[] {
  const side = (u: Pt) => keep * ((u[0] - p0[0]) * n[0] + (u[1] - p0[1]) * n[1])
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const u = poly[i]!, v = poly[(i + 1) % poly.length]!
    const su = side(u), sv = side(v)
    if (su >= -1e-12) out.push(u)
    if ((su > 1e-12 && sv < -1e-12) || (su < -1e-12 && sv > 1e-12)) {
      const k = su / (su - sv)
      out.push([u[0] + k * (v[0] - u[0]), u[1] + k * (v[1] - u[1])])
    }
  }
  return out.filter((u, i) => !close(u, out[(i + 1) % out.length]!))
}

let stepNo = 0
const creases: NewCrease[] = []

/**
 * Fold the faces `which` selects along the image line through `at` with direction `dir`
 * (both given as seen from the front), moving the side `toward` points to. `how(face)` says
 * whether that layer's moving part turns toward the viewer ('toward', a valley seen from the
 * front) or away ('away'). Returns the new state and records the crease segments.
 */
function through(faces: Face[], which: (f: Face) => boolean, at: Pt, dir: Pt, toward: Pt, how: (f: Face) => 'toward' | 'away', label: string): Face[] {
  const P0: Pt = at, Dv: Pt = dir, Tw: Pt = toward
  const n: Pt = [-Dv[1], Dv[0]]
  const sgn = ((Tw[0] - P0[0]) * n[0] + (Tw[1] - P0[1]) * n[1]) > 0 ? 1 : -1
  const R = reflection(P0, Dv)
  const out: Face[] = []
  for (const f of faces) {
    if (!which(f)) { out.push(f); continue }
    const img = f.poly.map(u => apply(f.iso, u))
    const mov = clip(img, P0, n, sgn as 1 | -1)
    const stay = clip(img, P0, n, -sgn as 1 | -1)
    if (mov.length < 3 || area(mov) < 1e-12) { out.push(f); continue }
    const back = inv(f.iso)
    if (stay.length < 3 || area(stay) < 1e-12) { out.push({ ...f, iso: comp(R, f.iso), moved: [...(f.moved ?? []), label] }); continue }
    const chord = mov.filter(u => Math.abs((u[0] - P0[0]) * n[0] + (u[1] - P0[1]) * n[1]) < 1e-9)
    // laid flat in the image (y up) the sheet's front has det -1, so a face showing its front has det < 0
    const front = det(f.iso) < 0
    const valley = (how(f) === 'toward') === front
    if (chord.length >= 2) creases.push({ step: stepNo, face: f.name, a: apply(back, chord[0]!), b: apply(back, chord[chord.length - 1]!), assign: valley ? 'V' : 'M' })
    out.push({ ...f, name: f.name, poly: stay.map(u => apply(back, u)) })
    out.push({ ...f, name: f.name + '\'', poly: mov.map(u => apply(back, u)), iso: comp(R, f.iso), moved: [...(f.moved ?? []), label] })
  }
  return out
}

const fmtP = (u: Pt) => `(${u[0].toFixed(4)}, ${u[1].toFixed(4)})`
const steps: { n: number, title: string, faces: Face[] | null, crease: string[] }[] = []
function report(title: string, faces: Face[] | null, extra: string[] = []): void {
  const mine = creases.filter(c => c.step === stepNo)
  const lines = [...extra, ...mine.map(c => `${c.assign} ${fmtP(c.a)} - ${fmtP(c.b)}  in ${c.face}`)]
  console.log(`\nstep ${stepNo}: ${title}`)
  for (const l of lines) console.log('  ' + l)
  if (mine.length) console.log(`  ${mine.length} crease segments, one per face crossed; sheet faces crossed: ${[...new Set(mine.map(c => c.face.replace(/'+$/, '')))].join(', ')}`)
  steps.push({ n: stepNo, title, faces, crease: lines })
}

// ---------------------------------------------------------------------------------------------

check('preliminary base', prelim())
check('bird base', bird())

stepNo = 1
const pre1 = ['V (0.0000, 0.5000) - (1.0000, 0.5000)  midline m4-m2, fold and unfold', 'V (0.5000, 0.0000) - (0.5000, 1.0000)  midline m1-m3, fold and unfold', 'M (0.0000, 0.0000) - (1.0000, 1.0000)  diagonal A-C, fold and unfold (turn over, valley)', 'M (1.0000, 0.0000) - (0.0000, 1.0000)  diagonal B-D, fold and unfold']
report('pre-crease: both midlines valley, both diagonals mountain (book folds, one layer each, unfolded)', null, pre1)

stepNo = 2
report('collapse into the preliminary base (one coupled motion at O; study 01 3.8, D10)', prelim(), ['V O-m1, O-m2, O-m3, O-m4 (180; seen from the front, which ends up inside: the engine\'s convention, D10 amended)', 'M O-B, O-D (180)', 'F O-A, O-C (0)'])

stepNo = 3
let st = prelim()
const kiteR = [Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)] as Pt
st = through(st, f => f.name === 'QA' || f.name === 'T2', [0, -0.5], kiteR, [1, 0], () => 'toward', 'kite')
st = through(st, f => f.name === 'QA' || f.name === 'Tl\'', [0, -0.5], [-kiteR[0], kiteR[1]], [-1, 0], () => 'toward', 'kite')
report('kite folds: the front flaps\' lower edges to the centre line (through the flap\'s two layers)', st)

stepNo = 4
st = through(st, f => !f.moved && f.half === 'front', [0, 0], [1, 0], [0, 1], () => 'toward', 'top')
report('top fold: the top triangle down over the kite flaps, on the line joining the kite creases\' ends', st)

stepNo = 5
report('unfold steps 4 and 3 (the creases stay: R7)', prelim())

stepNo = 6
const half = [...bird().filter(f => f.half === 'front'), ...prelim().filter(f => f.half === 'back')]
check('half bird base (front petalled, back still preliminary)', half)
report('petal fold, front: the front layer\'s bottom point up on p-q, the sides in on the kite creases', half, [
  'M p-q (0.5000, 0.2071) - (0.2071, 0.5000)  in QA, 0 -> 180 (the opposite sign to O-p: petal.ts)',
  'V A-p, A-q  in QA: mountain when made in step 3, now valley (reversed: the sides go in under the petal)',
  'V B-p in T2, D-q in Tl\'  (as made in step 3, the same sign as O-p: petal.ts)',
  'F p-m1, q-m4  (the midlines\' outer parts open, 180 -> 0)',
  'V O-p, O-q  (unchanged, 180)',
])

stepNo = 7
report('turn over (not a fold: the view turns, D19 records it as a view step)', half)

stepNo = 8
let back = [...bird().filter(f => f.half === 'front'), ...prelim().filter(f => f.half === 'back')]
back = through(back, f => f.name === 'QC' || f.name === 'Tr', [0, -0.5], kiteR, [1, 0], () => 'away', 'kite')
back = through(back, f => f.name === 'QC' || f.name === 'T7', [0, -0.5], [-kiteR[0], kiteR[1]], [-1, 0], () => 'away', 'kite')
back = through(back, f => !f.moved && f.half === 'back', [0, 0], [1, 0], [0, 1], () => 'away', 'top')
report('kite folds and top fold on the back, unfolded (steps 3 to 5 repeated; seen from the front they turn away)', back)

stepNo = 9
check('bird base', bird())
report('petal fold, back: the bird base', bird(), [
  'M pC-qC (0.5000, 0.7929) - (0.7929, 0.5000)  in QC',
  'V C-pC, C-qC in QC; B-qC in Tr, D-pC in T7',
  'F pC-m3, qC-m2',
  'bird base totals: 16 folded creases (4 inner midlines, diagonal B-D, 2 petal lines, 8 kite creases), interior vertices O (degree 6) and p, q, pC, qC (degree 4)',
])

stepNo = 10
st = bird()
const Xr: Pt = [0.5 * Math.tan(Math.PI / 16), 0]
const narrowR: Pt = [Math.sin(Math.PI / 16), Math.cos(Math.PI / 16)]
const narrowL: Pt = [-narrowR[0], narrowR[1]]
const frontR = new Set(['WAB', 'PA', 'TA', 'LB1']), frontL = new Set(['WDA', 'PA', 'TA', 'LD1'])
const backR = new Set(['WBC', 'PC', 'TC', 'LB2']), backL = new Set(['WCD', 'PC', 'TC', 'LD2'])
const base = (f: Face) => f.name.replace(/'+$/, '')
st = through(st, f => frontR.has(base(f)) && !f.moved, [0, -0.5], narrowR, [1, 0], () => 'toward', 'narrowR')
st = through(st, f => frontL.has(base(f)) && !f.moved, [0, -0.5], narrowL, [-1, 0], () => 'toward', 'narrowL')
st = through(st, f => backR.has(base(f)) && !f.moved, [0, -0.5], narrowR, [1, 0], () => 'away', 'narrowR')
st = through(st, f => backL.has(base(f)) && !f.moved, [0, -0.5], narrowL, [-1, 0], () => 'away', 'narrowL')
report(`narrowing folds: each leg's outer edge to the centre line, on the line from the leg's tip at 11.25 degrees (through the four layers around p; front, then back). The line meets y = 0 at x = ${Xr[0].toFixed(4)}`, st)

stepNo = 11
const neck = { at: [0, -0.05] as Pt, dir: [Math.cos(-Math.PI / 12), Math.sin(-Math.PI / 12)] as Pt }
const tail = { at: [0, -0.05] as Pt, dir: [-Math.cos(-Math.PI / 12), Math.sin(-Math.PI / 12)] as Pt }
const rightLeg = new Set(['WAB', 'LB1', 'LB2', 'WBC']), leftLeg = new Set(['WDA', 'LD1', 'LD2', 'WCD'])
st = through(st, f => rightLeg.has(base(f)), neck.at, neck.dir, [0, -1], f => (f.half === 'front' ? 'away' : 'toward'), 'neck')
st = through(st, f => leftLeg.has(base(f)), tail.at, tail.dir, [0, -1], f => (f.half === 'front' ? 'away' : 'toward'), 'tail')
report('inside reverse folds: the right leg up as the neck, the left as the tail, on lines through (0, -0.05) at 15 degrees below the horizontal (the leg turns from straight down to 60 degrees above the horizontal)', st)

stepNo = 12
// the neck's tip after step 11: the image of B reflected in the neck line
const tip = apply(reflection(neck.at, neck.dir), [0, -0.5])
const nd: Pt = [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)]
const headAt: Pt = [tip[0] - 0.1 * nd[0], tip[1] - 0.1 * nd[1]]
const headDir: Pt = [Math.cos(Math.PI / 12), Math.sin(Math.PI / 12)]
st = through(st, f => (f.moved ?? []).includes('neck'), headAt, headDir, [tip[0], tip[1]], f => (f.half === 'front' ? 'away' : 'toward'), 'head')
report(`inside reverse fold: the head, on the neck 0.1 from its tip at ${fmtP(tip)}, on a line at 15 degrees so the head points 30 degrees below the horizontal`, st)

stepNo = 13
const wingY = 0.1
const frontWing = new Set(['PA', 'WAB', 'WDA']), backWing = new Set(['PC', 'WBC', 'WCD'])
st = through(st, f => frontWing.has(base(f)) && !(f.moved ?? []).some(m => m === 'neck' || m === 'tail'), [0, wingY], [1, 0], [0, 1], () => 'toward', 'wing')
st = through(st, f => backWing.has(base(f)) && !(f.moved ?? []).some(m => m === 'neck' || m === 'tail' || m === 'wing'), [0, wingY], [1, 0], [0, 1], () => 'away', 'wing')
console.log(`\nthe finished crane: ${st.length} faces of folded creases, ${creases.length} crease segments made by through-folds`)
report(`wings: each wing down on the line y = ${wingY} through all its layers (front toward the viewer, back away); the finished crane holds them near 90 degrees`, st)

// ---------------------------------------------------------------------------------------------
// K-sketches: the sheet with every crease so far (this step's thick), and the folded image.

const here = dirname(fileURLToPath(import.meta.url))
const imgDir = join(here, '..', 'img')
mkdirSync(imgDir, { recursive: true })
const baseLines: [Pt, Pt, string][] = [
  [m4, m2, 'F'], [m1, m3, 'F'], [A, C, 'F'], [B, D, 'F'],
]
function svg(step: typeof steps[number]): string {
  const S = 220, pad = 14
  const X = (u: Pt) => pad + u[0] * S, Y = (u: Pt) => pad + u[1] * S
  const style = (a: string, thick: boolean) => {
    const w = thick ? 2.4 : 1
    if (a === 'V') return `stroke="#2a62c9" stroke-width="${w}" stroke-dasharray="6 4"`
    if (a === 'M') return `stroke="#c9302a" stroke-width="${w}" stroke-dasharray="7 3 1.5 3"`
    return `stroke="#8a8a8a" stroke-width="${thick ? 1.6 : 0.6}"`
  }
  const parts: string[] = []
  parts.push(`<rect x="${pad}" y="${pad}" width="${S}" height="${S}" fill="#fbf8f1" stroke="#222" stroke-width="1.6"/>`)
  for (const [u, v, a] of baseLines) parts.push(`<line x1="${X(u)}" y1="${Y(u)}" x2="${X(v)}" y2="${Y(v)}" ${style(a, false)}/>`)
  for (const c of creases.filter(c => c.step <= step.n)) parts.push(`<line x1="${X(c.a).toFixed(2)}" y1="${Y(c.a).toFixed(2)}" x2="${X(c.b).toFixed(2)}" y2="${Y(c.b).toFixed(2)}" ${style(c.assign, c.step === step.n)}/>`)
  // the hand-written steps' creases, drawn from their text
  for (const l of step.crease) {
    const m = l.match(/^([MVF]) \(([-\d.]+), ([-\d.]+)\) - \(([-\d.]+), ([-\d.]+)\)/)
    if (m && !creases.some(c => c.step === step.n)) parts.push(`<line x1="${X([+m[2]!, +m[3]!])}" y1="${Y([+m[2]!, +m[3]!])}" x2="${X([+m[4]!, +m[5]!])}" y2="${Y([+m[4]!, +m[5]!])}" ${style(m[1]!, true)}/>`)
  }
  for (const [name, u] of [['A', A], ['B', B], ['C', C], ['D', D], ['O', O], ['p', p], ['q', q]] as const) {
    parts.push(`<text x="${X(u) + (u[0] > 0.6 ? 4 : -10)}" y="${Y(u) + (u[1] > 0.6 ? 12 : -3)}" font-size="9" fill="#555">${name}</text>`)
  }
  // folded image, right panel
  const ox = pad * 3 + S, IS = S * 0.8
  const IX = (u: Pt) => ox + S / 2 + u[0] * IS, IY = (u: Pt) => pad + S / 2 - u[1] * IS
  if (step.faces) {
    for (const f of step.faces) {
      const pts = f.poly.map(u => apply(f.iso, u)).map(u => `${IX(u).toFixed(2)},${IY(u).toFixed(2)}`).join(' ')
      const fill = det(f.iso) < 0 ? '#fbf8f1' : '#e6dcc6'
      parts.push(`<polygon points="${pts}" fill="${fill}" fill-opacity="0.55" stroke="#333" stroke-width="0.7"/>`)
    }
  } else {
    parts.push(`<text x="${ox + 20}" y="${pad + S / 2}" font-size="11" fill="#555">flat sheet</text>`)
  }
  parts.push(`<text x="${pad}" y="${pad + S + 22}" font-size="11" fill="#222">K${step.n}: ${step.title.split(':')[0]!.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`)
  const Wd = ox + S + pad, Ht = pad + S + 32
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Ht}" width="${Wd}" height="${Ht}" font-family="sans-serif">\n<rect width="100%" height="100%" fill="#ffffff"/>\n${parts.join('\n')}\n</svg>\n`
}
for (const st2 of steps) writeFileSync(join(imgDir, `crane-k${String(st2.n).padStart(2, '0')}.svg`), svg(st2))
console.log(`\nwrote ${steps.length} K-sketches to docs/study/img/crane-k01.svg .. crane-k${String(steps.length).padStart(2, '0')}.svg`)
