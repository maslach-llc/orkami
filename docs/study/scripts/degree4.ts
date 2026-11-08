// Is a flat-foldable degree-4 vertex rigidly foldable from flat to flat-folded along one path?
// (Study 01, 3.10, marked "unverified, from memory"; the rabbit ear, the fish base, the reverse
// fold and the petal fold all rest on it.) Run: node docs/study/scripts/degree4.ts
//
// For a few Kawasaki vertices (sectors a, b, 180 - a, 180 - b), hold crease 0 at 1 degree, find
// every closing configuration of the other three by Newton from many starts, then trace each one
// with pseudo-arclength continuation until a crease reaches 179.9 degrees. Print the branch, the
// worst closure residual on it, and whether tan(rho_i / 2) / tan(rho_0 / 2) stays constant (the
// classical closed form of a degree-4 vertex's folding path).
import { DEG, fmt, newton, trace, type Loop } from './vertex-lib.ts'

const cases: [string, number, number][] = [
  ['generic 60/80', 60, 80],
  ['fish rabbit ear (incenter, see below)', 0, 0],
  ['reverse fold, spine straight, 40', 140, 40],
]

// The fish base's rabbit ear: square on its corner, side 1, A top (0, 0), C bottom (0, -sqrt2),
// D left, B right. Kite crease from A at 22.5 degrees off A-C meets edge D-C at p. The ear is
// the triangle (D, p, A): its incenter i, creases i-D, i-A, i-p and the perpendicular from i
// to side A-p (doc 01, 3.10; the perpendicular is what makes Kawasaki hold at i).
function fishEar(): number[] {
  const s2 = Math.SQRT2
  const A: [number, number] = [0, 0], D: [number, number] = [-s2 / 2, -s2 / 2], C: [number, number] = [0, -s2]
  // p on D-C with angle(p A C) = 22.5: direction from A at -90 - 22.5 degrees
  const ang = (-90 - 22.5) * DEG
  const u = [Math.cos(ang), Math.sin(ang)]
  // intersect A + t u with D + s (C - D)
  const dx = C[0] - D[0], dy = C[1] - D[1]
  const det = u[0]! * -dy - u[1]! * -dx
  const t = ((D[0] - A[0]) * -dy - (D[1] - A[1]) * -dx) / det
  const p: [number, number] = [A[0] + t * u[0]!, A[1] + t * u[1]!]
  const len = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!)
  const la = len(D, p), lp = len(D, A), ld = len(A, p) // side lengths opposite A, p, D
  const per = la + lp + ld
  const i = [(la * A[0] + lp * p[0] + ld * D[0]) / per, (la * A[1] + lp * p[1] + ld * D[1]) / per]
  // foot of the perpendicular from i on line A-p
  const w = [p[0] - A[0], p[1] - A[1]], wl = Math.hypot(w[0]!, w[1]!)
  const k = ((i[0]! - A[0]) * w[0]! + (i[1]! - A[1]) * w[1]!) / (wl * wl)
  const F = [A[0] + k * w[0]!, A[1] + k * w[1]!]
  const dirs = [D, A, F, p].map(q => Math.atan2(q[1]! - i[1]!, q[0]! - i[0]!)).sort((a, b) => a - b)
  return dirs
}

function sectorsOf(dirs: number[]): number[] {
  return dirs.map((d, k) => ((dirs[(k + 1) % dirs.length]! - d) / DEG + 360) % 360)
}

let worstAll = 0
for (const [name, a, b] of cases) {
  const dirs = name.startsWith('fish') ? fishEar() : [0, a * DEG, (a + b) * DEG, (a + b + 180 - a) * DEG]
  const sec = sectorsOf(dirs)
  console.log(`\n${name}: sectors ${sec.map(s => s.toFixed(2)).join(', ')} (alternate sums ${(sec[0]! + sec[2]!).toFixed(6)}, ${(sec[1]! + sec[3]!).toFixed(6)})`)
  const loop: Loop = { dirs, held: { 0: 1 * DEG } }
  // every closing configuration near flat with crease 0 at 1 degree
  const found: number[][] = []
  for (let s = 0; s < 400; s++) {
    const x0 = [0, 0, 0].map(() => (Math.random() - 0.5) * 20 * DEG)
    const { x, err } = newton(loop, x0)
    if (err > 1e-12 || x.some(v => Math.abs(v) > 30 * DEG)) continue
    if (!found.some(f => f.every((v, i) => Math.abs(v - x[i]!) < 1e-6))) found.push(x)
  }
  console.log(`  configurations with crease 0 at 1 degree: ${found.length}`)
  for (const f0 of found) {
    // trace the branch in the full 4-crease space with nothing held
    const free: Loop = { dirs, held: {} }
    const x0 = [1 * DEG, ...f0]
    const path = trace(free, x0, x0, 0.5 * DEG, 4000, x => x.some(v => Math.abs(v) > 179.9 * DEG))
    const worst = Math.max(...path.map(p => p.err))
    worstAll = Math.max(worstAll, worst)
    const end = path[path.length - 1]!.x
    const ratios = path.filter((_, k) => k % 60 === 0 || k === path.length - 1).map(p =>
      p.x.slice(1).map(v => Math.tan(v / 2) / Math.tan(p.x[0]! / 2)))
    const spread = [0, 1, 2].map(j => Math.max(...ratios.map(r => r[j]!)) - Math.min(...ratios.map(r => r[j]!)))
    console.log(`  branch from ${fmt(x0, 2)}: ${path.length} steps to ${fmt(end)}; worst residual ${worst.toExponential(1)}`)
    console.log(`    tan(rho_i/2)/tan(rho_0/2) = ${ratios[0]!.map(r => r.toFixed(4)).join(', ')}, spread along the branch ${spread.map(s => s.toExponential(1)).join(', ')}`)
    const mid = path[Math.floor(path.length / 2)]!.x
    console.log(`    midway ${fmt(mid)}`)
  }
}
console.log(`\nworst closure residual on any branch: ${worstAll.toExponential(1)}`)
console.log('degrees per crease are printed in the vertex\'s counterclockwise crease order')
