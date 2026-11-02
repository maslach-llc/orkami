// The one light (docs/design/01-decisions.md D5; docs/study/02-paper-on-a-screen.md, cue 1): a
// fixed directional light from the upper left, in front of the page, and the Lambert factor
// that scales a face's print as it turns. Both drivers use these numbers and nothing else.
import type { Pt } from './affine.ts'
import { area } from './fold.ts'
import { cross3, dot, normalize, sub, transform, type Mat4, type Vec3 } from './space.ts'

/** Toward the light, unit, page coordinates (x right, y down, z toward the visitor). */
export const LIGHT: Vec3 = [-0.346, -0.538, 0.769]
/** k = AMBIENT + DIFFUSE * max(0, L . N): 1.0 (1.004) for a flat face. */
export const AMBIENT = 0.35
export const DIFFUSE = 0.85

/** max(0, L . N) for unit L and N. */
export function lambert(normal: Vec3, light: Vec3 = LIGHT): number {
  return Math.max(0, dot(normalize(normal), normalize(light)))
}

/** The brightness factor of a face with this normal: ambient + diffuse * max(0, L . N). The back of a face uses the reversed normal. */
export function shade(normal: Vec3, light: Vec3 = LIGHT, ambient = AMBIENT, diffuse = DIFFUSE): number {
  return ambient + diffuse * lambert(normal, light)
}

/** The unit normal of a face after a transform, oriented so the flat sheet's normal is (0, 0, 1), toward the visitor, whatever the polygon's winding. */
export function faceNormal(pts: Pt[], matrix?: Mat4): Vec3 {
  const p3 = pts.map(([x, y]) => (matrix ? transform(matrix, [x, y, 0]) : [x, y, 0] as Vec3))
  // Newell's method: robust for any simple polygon
  let n: Vec3 = [0, 0, 0]
  for (let i = 0; i < p3.length; i++) {
    const a = p3[i]!, b = p3[(i + 1) % p3.length]!
    n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]
  }
  if (dot(n, n) === 0 && p3.length >= 3) n = cross3(sub(p3[1]!, p3[0]!), sub(p3[2]!, p3[0]!))
  // Newell on the flat polygon gives z with the sign of its shoelace area; flip so flat is +z
  const flat = area(pts)
  const u = normalize(n)
  return flat < 0 ? [-u[0], -u[1], -u[2]] : u
}
