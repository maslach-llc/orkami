// Is the crane's petal fold rigid? Run: node docs/study/scripts/petal.ts
//
// The petal fold acts on the folded preliminary base (study 04, section 6, step 6). Unit square,
// sheet coordinates y down: corner A (0, 0), B (1, 0), centre O (0.5, 0.5), edge midpoint
// m1 (0.5, 0). The kite crease from A at 22.5 degrees meets the midline O-m1 at
// p = (0.5, tan(22.5) / 2); q = (tan(22.5) / 2, 0.5) is its mirror on O-m4 and q' its mirror on
// O-m2's side. Around p, counterclockwise: p-q' (the petal line in quadrant B), p-O (the
// midline, folded 180 in the base), p-q (the petal line in quadrant A), p-A (the kite crease in
// quadrant A), p-m1 (the midline's outer part, folded 180 in the base), p-B (the kite crease
// in quadrant B). Every face around p but the moving ones runs to the sheet's border or to
// O's vertex, which the step does not touch, so the step's closure is this one loop and its
// mirror at q (p-q is shared and the two vertices are mirror images across the diagonal O-A,
// so one solution serves both).
//
// Before: the preliminary base, p-O and p-m1 at 180, the rest flat. After: the half bird base,
// p-O, p-q, p-A and p-B at 180 and p-m1, p-q' flat (Kawasaki holds at p on exactly those four:
// sectors 45, 67.5, 135, 112.5). With p-O held at 180 (the top triangle and quadrant B's body
// stay put) and p-q' held flat, four creases are free and the loop gives three equations: one
// degree of freedom. The script traces that one-dimensional set from the start along every
// direction the Jacobian leaves free and reports whether it reaches the half bird base.
import { DEG, deg, dirsTo, fmt, svd, sysJac, sysNewton, trace, type Loop, type System } from './vertex-lib.ts'

const t = Math.tan(22.5 * DEG) / 2
const p: [number, number] = [0.5, t]
const pts: [number, number][] = [[1 - t, 0.5], [0.5, 0.5], [t, 0.5], [0, 0], [0.5, 0], [1, 0]]
const dirs = dirsTo(p, pts)
console.log('creases at p, counterclockwise: p-q\', p-O, p-q, p-A, p-m1, p-B')
console.log('directions:', dirs.map(d => ((deg(d) + 360) % 360).toFixed(2)).join(', '))
console.log('sectors:   ', dirs.map((d, k) => ((deg(dirs[(k + 1) % 6]! - d) + 360) % 360).toFixed(2)).join(', '))

const PI = Math.PI
const one: Loop = { dirs, held: { 0: 0, 1: PI } }
const sys: System = { n: 6, vertices: [{ name: 'p', dirs, creases: [0, 1, 2, 3, 4, 5] }], held: one.held }
const start = [0, 0, PI, 0]
const j0 = svd(sysJac(sys, start))
console.log('\np-O held at 180, p-q\' held flat; free: p-q, p-A, p-m1, p-B')
console.log('singular values of the closure Jacobian at the start:', j0.s.map(s => s.toExponential(2)).join(', '), '(two null directions: two branches leave the start)')

const wrap = (a: number) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a)))
// distance to the half bird base, taking +180 and -180 as the same rotation
const gap = (x: number[]) => Math.hypot(PI - wrap(x[0]!), PI - wrap(x[1]!), wrap(x[2]!), PI - wrap(x[3]!))

// The folds before the petal, at the same vertex: the kite fold (step 3, p-A and p-B through
// the flap's two layers) and the top fold (step 4, p-q and p-q' through them), each with the
// midline held at 180 and the other pair held flat. One degree of freedom each.
for (const [label, held, x0, drive] of [
  ['kite fold (p-q, p-q\' flat): free p-A, p-m1, p-B', { 0: 0, 1: PI, 2: 0 }, [0, PI, 0], 0],
  ['top fold (p-A, p-B flat): free p-q\', p-q, p-m1', { 1: PI, 3: 0, 5: 0 }, [0, 0, PI], 1],
] as const) {
  const l: Loop = { dirs, held: { ...held } }
  const s: System = { n: 6, vertices: [{ name: 'p', dirs, creases: [0, 1, 2, 3, 4, 5] }], held: l.held }
  const sv = svd(sysJac(s, [...x0]))
  const dir = sv.v.find(v => Math.abs(v[drive]!) > 0.1)!
  const path = trace(l, [...x0], dir, 0.25 * DEG, 2000, y => Math.abs(y[drive]!) > 179.5 * DEG)
  const worst = Math.max(...path.map(q => q.err))
  console.log(`\n${label}: ${path.length} points, worst residual ${worst.toExponential(1)}`)
  for (const q of path.filter((_, k) => k % Math.ceil(path.length / 4) === 0 || k === path.length - 1)) console.log('  ' + fmt(q.x, 1))
}

let branch = 0
for (const v of j0.v.slice(0, 2)) for (const sgn of [1, -1]) {
  const dir = v.map(c => c * sgn)
  const { x, err } = sysNewton(sys, start.map((c, i) => c + 1e-3 * dir[i]!))
  if (err > 1e-10) continue
  const path = trace(one, x, dir, 0.25 * DEG, 4000, y => gap(y) < 0.2 * DEG || Math.abs(y[0]!) > 1.01 * PI || Math.abs(y[1]!) > 1.01 * PI)
  const worst = Math.max(...path.map(q => q.err))
  const near = Math.min(...path.map(q => gap(q.x)))
  branch++
  console.log(`\nbranch ${branch}: ${path.length} points, worst residual ${worst.toExponential(1)}, closest approach to the half bird base ${deg(near).toFixed(2)} degrees`)
  console.log('   p-q      p-A      p-m1     p-B')
  for (const q of path.filter((_, k) => k % Math.ceil(path.length / 8) === 0 || k === path.length - 1)) console.log('  ' + fmt(q.x, 1))
}
