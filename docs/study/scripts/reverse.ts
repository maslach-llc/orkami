// Is an inside reverse fold rigid on a flap that is already folded? Run:
//   node docs/study/scripts/reverse.ts
//
// A flap of two layers folded on its spine (a straight crease at 180). The reverse fold adds a
// vertex v on the spine and one new crease in each layer, mirror images, at 40 degrees to the
// spine on the body's side (sectors 140, 40, 40, 140, the "reverse fold" case of degree4.ts).
// Creases at v, counterclockwise: 0 spine-out (to the tip), 1 n1, 2 spine-in (to the body),
// 3 n2. Before: spine-out and spine-in at 180, n1 and n2 flat (the flap folded, the stack
// branch). After: spine-out reversed to -180, n1 and n2 folded, spine-in still 180 (the reverse
// branch). degree4.ts shows the two branches meet only at the flat vertex and that on both
// |spine-out| = |spine-in| exactly, so the spine at v must open to flat for the move to happen.
//
// 1. Spine-in held at 180 (the flap's body held folded by the rest of the model): is v locked?
// 2. Spine-in free but its far end (vertex v2 on the spine, toward the body) held by the body:
//    auxiliary creases at v2, flat before and after, let the spine between v2 and v open.
//    a) a degree-4 auxiliary vertex (one auxiliary crease per layer, mirrored),
//    b) a degree-6 auxiliary fan (two per layer, mirrored).
//    For each: the degrees of freedom (Tachi's count, free creases - 3 x vertices) and a walk
//    from the folded flap through the flat vertex v to the reversed flap.
import { DEG, deg, fmt, svd, sysJac, walk, type System } from './vertex-lib.ts'

const PI = Math.PI
const vDirs = [0, 140, 180, 220].map(d => d * DEG)

console.log('1. spine-in held at 180')
{
  const s: System = { n: 4, vertices: [{ name: 'v', dirs: vDirs, creases: [0, 1, 2, 3] }], held: { 2: PI } }
  for (const [name, x] of [['folded flap', [PI, 0, 0]], ['reversed flap', [-PI * 0.999, -PI * 0.999, -PI * 0.999]]] as const) {
    const { s: sv } = svd(sysJac(s, [...x]))
    console.log(`   at ${name}: singular values ${sv.map(v => v.toExponential(2)).join(', ')}`)
  }
  const w = walk(s, [PI, 0, 0], [-PI, -PI, -PI], 0.5 * DEG, 2000)
  console.log(`   walk from the folded flap toward the reversed flap: ${w.why} after ${w.path.length - 1} steps, at ${fmt(w.path[w.path.length - 1]!.x)}`)
}

// v at (1, 0), v2 at (0, 0) on the spine; crease 2 (spine-in) is v-v2, shared.
function withFan(aux: number[]): System {
  // aux: directions (degrees) of the auxiliary creases in layer 1 (y > 0 side), mirrored into layer 2
  const up = aux.slice().sort((a, b) => a - b)
  const down = up.map(a => 360 - a).sort((a, b) => a - b)
  const v2dirs = [0, ...up, 180, ...down].map(d => d * DEG)
  const n = 4 + 1 + up.length * 2
  const body = 4
  const creases = [2, ...up.map((_, i) => 5 + i), body, ...down.map((_, i) => 5 + up.length + i)]
  return { n, vertices: [{ name: 'v', dirs: vDirs, creases: [0, 1, 2, 3] }, { name: 'v2', dirs: v2dirs, creases }], held: { [body]: PI } }
}

console.log('\n2. spine-in free, its far end v2 held by the body (spine beyond v2 at 180)')
const fans: [string, number[]][] = [
  ['a) one auxiliary crease per layer, at 150', [150]],
  ['b) two per layer, at 140 and 160', [140, 160]],
  ['b\') two per layer, at 120 and 160', [120, 160]],
  ['c) three per layer, at 120, 140, 160', [120, 140, 160]],
  ['d) four per layer, at 100, 120, 140, 160', [100, 120, 140, 160]],
  ['e) two per layer, at 60 and 120', [60, 120]],
]
for (const [label, aux] of fans) {
  const s = withFan([...aux])
  const nFree = s.n - Object.keys(s.held).length
  console.log(`   ${label}: ${nFree} free creases, ${3 * s.vertices.length} equations, ${nFree - 3 * s.vertices.length} degrees of freedom (generic count)`)
  const start = new Array(nFree).fill(0)
  start[0] = PI; start[2] = PI // spine-out, spine-in folded; n1, n2, auxiliaries flat
  // waypoint: v flat (spine-out, n1, spine-in, n2 at 0), auxiliaries wherever the closure puts them
  // only the spine-in's angle is aimed at: on the stack branch the rest of v follows it
  const mask = start.map((_, i) => i === 2)
  const w1 = walk(s, start, new Array(nFree).fill(0), 0.5 * DEG, 3000, 1e-6, mask)
  const mid = w1.path[w1.path.length - 1]!.x
  const auxMax = Math.max(...w1.path.map(q => Math.max(...q.x.slice(4).map(Math.abs))))
  const worst = Math.max(...w1.path.map(q => q.err))
  console.log(`     opening spine-in toward flat: ${w1.why} after ${w1.path.length - 1} steps; spine-in ${deg(mid[2]!).toFixed(1)}, largest auxiliary angle ${deg(auxMax).toFixed(1)}, worst residual ${worst.toExponential(1)}`)
  console.log(`       last state (spine-out, n1, spine-in, n2, auxiliaries): ${fmt(mid, 1)}`)
}
console.log('\nA walk that stops proves only that this greedy walk found no way on; one that reaches flat is a rigid path.')
