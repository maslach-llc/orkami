// Single-vertex rigid origami, numerically: the loop closure of Belcastro and Hull as used by
// Tachi 2009 (the product of the rotations about every crease around an interior vertex, axes in
// the flat sheet's frame, taken in counterclockwise order, is the identity), a Gauss-Newton
// solver for it and a pseudo-arclength tracer that follows a one-parameter folding path.
// Plain TypeScript for `node` (types stripped), no dependency, not part of `npm run verify`.
// Angles are radians inside, degrees in what the scripts print.

export type M3 = number[] // row major 3x3

export const DEG = Math.PI / 180

/** Rotation by `rho` about the unit axis (cos a, sin a, 0), a being the crease's direction from the vertex. */
export function rot(a: number, rho: number): M3 {
  const x = Math.cos(a), y = Math.sin(a)
  const c = Math.cos(rho), s = Math.sin(rho), t = 1 - c
  return [
    t * x * x + c, t * x * y, y * s,
    t * x * y, t * y * y + c, -x * s,
    -y * s, x * s, c,
  ]
}

export function mul(p: M3, q: M3): M3 {
  const r: M3 = new Array(9).fill(0)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0
    for (let k = 0; k < 3; k++) s += p[i * 3 + k]! * q[k * 3 + j]!
    r[i * 3 + j] = s
  }
  return r
}

/** The closure residual: the nine entries of (product of rotations) - I. Zero means the faces around the vertex close. */
export function residual(dirs: number[], rhos: number[]): number[] {
  let m: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  for (let i = 0; i < dirs.length; i++) m = mul(m, rot(dirs[i]!, rhos[i]!))
  return m.map((v, i) => v - (i % 4 === 0 ? 1 : 0))
}

export const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0))

/** A loop with some creases held at given angles and the rest free; `x` is the free creases' angles. */
export interface Loop {
  dirs: number[]
  /** crease index -> held angle; every other crease is free, in index order. */
  held: Record<number, number>
}

export function freeIndex(loop: Loop): number[] {
  return loop.dirs.map((_, i) => i).filter(i => !(i in loop.held))
}

export function full(loop: Loop, x: number[]): number[] {
  const free = freeIndex(loop)
  const r = loop.dirs.map((_, i) => loop.held[i] ?? 0)
  free.forEach((i, k) => { r[i] = x[k]! })
  return r
}

export function res(loop: Loop, x: number[]): number[] {
  return residual(loop.dirs, full(loop, x))
}

/** Numeric Jacobian (9 x free) of the residual, central differences. */
export function jac(loop: Loop, x: number[], h = 1e-7): number[][] {
  const cols = x.map((_, k) => {
    const a = x.slice(), b = x.slice()
    a[k]! += h; b[k]! -= h
    const ra = res(loop, a), rb = res(loop, b)
    return ra.map((v, i) => (v - rb[i]!) / (2 * h))
  })
  return Array.from({ length: 9 }, (_, i) => cols.map(c => c[i]!))
}

/** Solve the square system A x = b by Gaussian elimination with partial pivoting. */
export function solveSq(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((r, i) => [...r, b[i]!])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r
    ;[M[c], M[p]] = [M[p]!, M[c]!]
    const d = M[c]![c]!
    if (Math.abs(d) < 1e-300) continue
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = M[r]![c]! / d
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!
    }
  }
  return M.map((r, i) => r[n]! / (r[i]! || 1e-300))
}

/** Least-squares step for J d = -r with Levenberg damping `lam`. */
export function lsq(J: number[][], r: number[], lam = 1e-12): number[] {
  const n = J[0]!.length
  const JtJ = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) =>
    J.reduce((s, row) => s + row[i]! * row[j]!, 0) + (i === j ? lam : 0)))
  const Jtr = Array.from({ length: n }, (_, i) => -J.reduce((s, row, k) => s + row[i]! * r[k]!, 0))
  return solveSq(JtJ, Jtr)
}

/** Gauss-Newton on the free creases, from `x0`. Returns the solution and its residual norm. */
export function newton(loop: Loop, x0: number[], iters = 60): { x: number[], err: number } {
  let x = x0.slice()
  for (let i = 0; i < iters; i++) {
    const r = res(loop, x)
    if (norm(r) < 1e-14) break
    const d = lsq(jac(loop, x), r, 1e-14)
    x = x.map((v, k) => v + d[k]!)
  }
  return { x, err: norm(res(loop, x)) }
}

/** Symmetric eigen decomposition (Jacobi), for the null space of J^T J. */
export function eig(S: number[][]): { values: number[], vectors: number[][] } {
  const n = S.length
  const A = S.map(r => r.slice())
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p]![q]! ** 2
    if (off < 1e-30) break
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p]![q]!) < 1e-300) continue
      const th = (A[q]![q]! - A[p]![p]!) / (2 * A[p]![q]!)
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1))
      const c = 1 / Math.sqrt(t * t + 1), s = t * c
      for (let k = 0; k < n; k++) {
        const akp = A[k]![p]!, akq = A[k]![q]!
        A[k]![p] = c * akp - s * akq; A[k]![q] = s * akp + c * akq
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p]![k]!, aqk = A[q]![k]!
        A[p]![k] = c * apk - s * aqk; A[q]![k] = s * apk + c * aqk
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k]![p]!, vkq = V[k]![q]!
        V[k]![p] = c * vkp - s * vkq; V[k]![q] = s * vkp + c * vkq
      }
    }
  }
  return { values: A.map((r, i) => r[i]!), vectors: V[0]!.map((_, j) => V.map(r => r[j]!)) }
}

/** The singular values of J (square roots of J^T J's eigenvalues), ascending, with their right vectors. */
export function svd(J: number[][]): { s: number[], v: number[][] } {
  const n = J[0]!.length
  const JtJ = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => J.reduce((s, row) => s + row[i]! * row[j]!, 0)))
  const { values, vectors } = eig(JtJ)
  const idx = values.map((_, i) => i).sort((a, b) => values[a]! - values[b]!)
  return { s: idx.map(i => Math.sqrt(Math.max(0, values[i]!))), v: idx.map(i => vectors[i]!) }
}

/**
 * Follow a one-parameter path of the loop from `x0` (which must close) by pseudo-arclength
 * continuation: the tangent is J's null vector, oriented like `dir0` at the start and like the
 * previous tangent after; each predictor step of length `h` is corrected by Newton on [J; t].
 * Stops after `steps` or when `stop(x)` says so. Returns every point with its residual.
 */
export function trace(loop: Loop, x0: number[], dir0: number[], h: number, steps: number, stop: (x: number[]) => boolean = () => false): { x: number[], err: number }[] {
  const out = [{ x: x0.slice(), err: norm(res(loop, x0)) }]
  let x = x0.slice()
  let prev = dir0.slice()
  for (let s = 0; s < steps; s++) {
    const { v } = svd(jac(loop, x))
    let t = v[0]!
    const dp = t.reduce((a, b, i) => a + b * prev[i]!, 0)
    if (dp < 0) t = t.map(c => -c)
    const pred = x.map((c, i) => c + h * t[i]!)
    let y = pred.slice()
    for (let it = 0; it < 30; it++) {
      const r = res(loop, y)
      const J = jac(loop, y)
      const along = y.reduce((a, c, i) => a + (c - pred[i]!) * t[i]!, 0)
      const d = lsq([...J, t], [...r, along], 1e-14)
      y = y.map((c, i) => c + d[i]!)
      if (norm(d) < 1e-13) break
    }
    prev = t
    x = y
    out.push({ x: x.slice(), err: norm(res(loop, x)) })
    if (stop(x)) break
  }
  return out
}

export const deg = (r: number) => r / DEG
export const fmt = (v: number[], d = 1) => '(' + v.map(r => deg(r).toFixed(d).padStart(7)).join(', ') + ')'

/** Several interior vertices sharing creases: crease angles are one vector, each vertex lists its creases (by index, counterclockwise) with their directions from it. */
export interface System {
  n: number
  vertices: { name: string, dirs: number[], creases: number[] }[]
  held: Record<number, number>
}

export function sysFree(s: System): number[] {
  return Array.from({ length: s.n }, (_, i) => i).filter(i => !(i in s.held))
}

export function sysFull(s: System, x: number[]): number[] {
  const r = Array.from({ length: s.n }, (_, i) => s.held[i] ?? 0)
  sysFree(s).forEach((i, k) => { r[i] = x[k]! })
  return r
}

export function sysRes(s: System, x: number[]): number[] {
  const a = sysFull(s, x)
  return s.vertices.flatMap(v => residual(v.dirs, v.creases.map(c => a[c]!)))
}

export function sysJac(s: System, x: number[], h = 1e-7): number[][] {
  const cols = x.map((_, k) => {
    const a = x.slice(), b = x.slice()
    a[k]! += h; b[k]! -= h
    const ra = sysRes(s, a), rb = sysRes(s, b)
    return ra.map((v, i) => (v - rb[i]!) / (2 * h))
  })
  return cols[0]!.map((_, i) => cols.map(c => c[i]!))
}

export function sysNewton(s: System, x0: number[], iters = 80): { x: number[], err: number } {
  let x = x0.slice()
  for (let i = 0; i < iters; i++) {
    const r = sysRes(s, x)
    if (norm(r) < 1e-14) break
    const d = lsq(sysJac(s, x), r, 1e-14)
    x = x.map((v, k) => v + d[k]!)
  }
  return { x, err: norm(sysRes(s, x)) }
}

/**
 * Walk from `x0` toward `goal` on the closure's solution set: each step moves `h` along the
 * goal direction projected onto J's null space (singular values under `tol` of the largest),
 * then Newton pulls the point back onto the set. Stops at the goal (within `h`), when the
 * projected direction vanishes (stuck), or after `steps`. Returns the path and why it stopped.
 * A walk that reaches the goal is a constructive proof that a rigid path exists; a walk that
 * sticks proves nothing on its own (the set may reach the goal another way), so the scripts
 * that use it say what else they checked.
 */
export function walk(s: System, x0: number[], goal: number[], h: number, steps: number, tol = 1e-6, mask?: boolean[]): { path: { x: number[], err: number }[], why: string } {
  let x = x0.slice()
  const path = [{ x: x.slice(), err: norm(sysRes(s, x)) }]
  const gap = (y: number[]) => goal.map((v, i) => (mask && !mask[i] ? 0 : v - y[i]!))
  for (let k = 0; k < steps; k++) {
    const g = gap(x)
    const dist = norm(g)
    if (dist < h) {
      if (mask) return { path, why: 'reached the goal' }
      const { x: y, err } = sysNewton(s, goal)
      path.push({ x: y, err })
      return { path, why: err < 1e-9 ? 'reached the goal' : 'the goal does not close' }
    }
    const { s: sv, v } = svd(sysJac(s, x))
    const big = Math.max(...sv)
    const nulls = v.filter((_, i) => sv[i]! < tol * Math.max(big, 1))
    let d: number[] = new Array(x.length).fill(0)
    for (const u of nulls) {
      const c = u.reduce((a, b, i) => a + b * g[i]!, 0)
      d = d.map((dv, i) => dv + c * u[i]!)
    }
    const dn = norm(d)
    if (dn < 1e-6 * dist) return { path, why: `stuck: no closing direction toward the goal (${nulls.length} null directions)` }
    const { x: y, err } = sysNewton(s, x.map((xv, i) => xv + (h * d[i]!) / dn))
    if (err > 1e-9) return { path, why: `stuck: Newton failed (residual ${err.toExponential(1)})` }
    if (norm(gap(y)) >= dist) return { path, why: 'stuck: the closing set turns away from the goal' }
    x = y
    path.push({ x: x.slice(), err })
  }
  return { path, why: 'out of steps' }
}

/** Crease directions (radians) of segments from vertex v to points ps. */
export function dirsTo(v: [number, number], ps: [number, number][]): number[] {
  return ps.map(([x, y]) => Math.atan2(y - v[1], x - v[0]))
}
