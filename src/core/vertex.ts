// The flat-foldability checks (docs/study/01-how-paper-folds.md section 1): at an interior
// vertex of a flat-folded sheet, mountains and valleys differ by two (Maekawa) and the
// alternating sector angles each sum to 180 degrees (Kawasaki). Necessary conditions for flat
// folding, run over every named fold's pattern as a test of the hand-written assignments.
import type { Pt } from './affine.ts'
import { onSegment, tolerance, type Crease, type Fold } from './fold.ts'

const same = (p: Pt, q: Pt, tol: number) => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol

/** The sheet's outline: every face edge no other face shares (so a cut sheet's outline is its own shape). */
function outline(fold: Fold): [Pt, Pt][] {
  const tol = tolerance(fold)
  const edges: [Pt, Pt][] = []
  for (const f of fold.faces) {
    if (f.page) continue
    for (let i = 0; i < f.pts.length; i++) edges.push([f.pts[i]!, f.pts[(i + 1) % f.pts.length]!])
  }
  const shared = (e: [Pt, Pt], o: [Pt, Pt]) =>
    (same(e[0], o[0], tol) && same(e[1], o[1], tol)) || (same(e[0], o[1], tol) && same(e[1], o[0], tol))
  return edges.filter((e, i) => !edges.some((o, j) => j !== i && shared(e, o)))
}

/** The distinct crease endpoints that do not lie on the sheet's outline. */
export function interiorVertices(fold: Fold): Pt[] {
  const tol = tolerance(fold)
  const border = outline(fold)
  const out: Pt[] = []
  for (const c of fold.creases) {
    for (const p of [c.a, c.b]) {
      if (out.some(q => same(p, q, tol))) continue
      if (border.some(([a, b]) => onSegment(p, a, b, tol))) continue
      out.push(p)
    }
  }
  return out
}

/** The folded (non-flat) creases with an endpoint at v, closing creases included. */
function rays(fold: Fold, v: Pt): Crease[] {
  const tol = tolerance(fold)
  return fold.creases.filter(c => c.assignment !== 'F' && (same(c.a, v, tol) || same(c.b, v, tol)))
}

/** Maekawa at v: the mountains and valleys differ by two. */
export function maekawa(fold: Fold, v: Pt): { mountains: number, valleys: number, ok: boolean } {
  const at = rays(fold, v)
  const mountains = at.filter(c => c.assignment === 'M').length
  const valleys = at.filter(c => c.assignment === 'V').length
  return { mountains, valleys, ok: Math.abs(mountains - valleys) === 2 }
}

/** Kawasaki at v: the sector angles (degrees) between consecutive folded creases around v, whose alternating sums are both 180. */
export function kawasaki(fold: Fold, v: Pt): { sectors: number[], odd: number, even: number, ok: boolean } {
  const tol = tolerance(fold)
  const angles = rays(fold, v)
    .map(c => { const o = same(c.a, v, tol) ? c.b : c.a; return Math.atan2(o[1] - v[1], o[0] - v[0]) })
    .sort((a, b) => a - b)
  const n = angles.length
  const sectors = angles.map((a, i) => ((i + 1 < n ? angles[i + 1]! : angles[0]! + 2 * Math.PI) - a) * 180 / Math.PI)
  const odd = sectors.filter((_, i) => i % 2 === 0).reduce((s, a) => s + a, 0)
  const even = sectors.filter((_, i) => i % 2 === 1).reduce((s, a) => s + a, 0)
  const ok = n > 0 && n % 2 === 0 && Math.abs(odd - 180) < 1e-6 && Math.abs(even - 180) < 1e-6
  return { sectors, odd, even, ok }
}

/** Every interior vertex's failures of Maekawa and Kawasaki, as a list of problems (empty when the pattern is flat-foldable at its vertices). */
export function flatFoldable(fold: Fold): string[] {
  const problems: string[] = []
  for (const v of interiorVertices(fold)) {
    const m = maekawa(fold, v)
    if (!m.ok) problems.push(`vertex (${v[0]}, ${v[1]}): Maekawa fails, ${m.mountains} mountains and ${m.valleys} valleys`)
    const k = kawasaki(fold, v)
    if (!k.ok) problems.push(`vertex (${v[0]}, ${v[1]}): Kawasaki fails, sectors ${k.sectors.map(a => +a.toFixed(3)).join(' ')} sum ${k.odd} and ${k.even}`)
  }
  return problems
}
