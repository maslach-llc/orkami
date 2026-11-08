// Space geometry for the pose: vectors and 4x4 matrices in page coordinates (x right, y down,
// z toward the visitor, the CSS and three.js convention), column major so a matrix can be handed
// to `matrix3d()` or `Matrix4.fromArray()` as it is.

export type Vec3 = [number, number, number]

/** A 4x4 matrix, column major: element (row, col) at index col * 4 + row. */
export type Mat4 = number[]

export const IDENTITY4: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

export const vec = (x: number, y: number, z = 0): Vec3 => [x, y, z]
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
export function normalize(a: Vec3): Vec3 {
  const l = length(a)
  return l ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]
}

/** a then b: multiply(a, b) maps x to a(b(x)). */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out: Mat4 = new Array(16).fill(0)
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + row]! * b[col * 4 + k]!
      out[col * 4 + row] = s
    }
  }
  return out
}

export function transform(m: Mat4, [x, y, z]: Vec3): Vec3 {
  return [
    m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
    m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
    m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
  ]
}

/** The linear part only (a direction, not a point). */
export function transformDir(m: Mat4, [x, y, z]: Vec3): Vec3 {
  return [
    m[0]! * x + m[4]! * y + m[8]! * z,
    m[1]! * x + m[5]! * y + m[9]! * z,
    m[2]! * x + m[6]! * y + m[10]! * z,
  ]
}

/** Rotation by `angle` radians about the line through `point` along the unit direction `axis` (Rodrigues; positive by the right-hand rule in these coordinates). */
export function rotation(point: Vec3, axis: Vec3, angle: number): Mat4 {
  const [ux, uy, uz] = normalize(axis)
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c
  const r = [
    t * ux * ux + c, t * ux * uy + s * uz, t * ux * uz - s * uy,
    t * ux * uy - s * uz, t * uy * uy + c, t * uy * uz + s * ux,
    t * ux * uz + s * uy, t * uy * uz - s * ux, t * uz * uz + c,
  ]
  // x' = R (x - p) + p = R x + (p - R p)
  const [px, py, pz] = point
  const tx = px - (r[0]! * px + r[3]! * py + r[6]! * pz)
  const ty = py - (r[1]! * px + r[4]! * py + r[7]! * pz)
  const tz = pz - (r[2]! * px + r[5]! * py + r[8]! * pz)
  return [r[0]!, r[1]!, r[2]!, 0, r[3]!, r[4]!, r[5]!, 0, r[6]!, r[7]!, r[8]!, 0, tx, ty, tz, 1]
}

/** The inverse of a rigid transform (a rotation and a translation): the transposed rotation, the translation taken back through it. */
export function invertRigid(m: Mat4): Mat4 {
  const r = [m[0]!, m[1]!, m[2]!, m[4]!, m[5]!, m[6]!, m[8]!, m[9]!, m[10]!]
  const t = [m[12]!, m[13]!, m[14]!]
  // out's rotation is r transposed: column i of out is row i of r
  const tx = -(r[0]! * t[0]! + r[1]! * t[1]! + r[2]! * t[2]!)
  const ty = -(r[3]! * t[0]! + r[4]! * t[1]! + r[5]! * t[2]!)
  const tz = -(r[6]! * t[0]! + r[7]! * t[1]! + r[8]! * t[2]!)
  return [r[0]!, r[3]!, r[6]!, 0, r[1]!, r[4]!, r[7]!, 0, r[2]!, r[5]!, r[8]!, 0, tx, ty, tz, 1]
}

export const isIdentity =(m: Mat4, eps = 1e-9) => m.every((v, i) => Math.abs(v - IDENTITY4[i]!) < eps)
