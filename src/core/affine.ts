// Plane geometry the fold engine is built on: points, and affine maps written the way CSS
// matrix() takes them, so a map computed here can be handed to a transform as it is.

export type Pt = [number, number]

/** An affine map as CSS matrix(a, b, c, d, e, f): (x, y) -> (ax + cy + e, bx + dy + f). */
export type Affine = [number, number, number, number, number, number]

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0]

/** p after q: compose(p, q) maps x to p(q(x)). */
export const compose = (p: Affine, q: Affine): Affine => [
  p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1],
  p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3],
  p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5],
]

export const apply = (m: Affine, [x, y]: Pt): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

/** Reflection across the line through h along the unit direction u: where a flap's content lands once it is folded flat over that crease. */
export function reflect([hx, hy]: Pt, [ux, uy]: Pt): Affine {
  const a = 2 * ux * ux - 1, b = 2 * ux * uy, d = 2 * uy * uy - 1
  return [a, b, b, d, hx - (a * hx + b * hy), hy - (b * hx + d * hy)]
}

/** The unit direction from a to b. */
export function direction(a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
  return [dx / l, dy / l]
}

/** The inverse map, so that compose(m, invert(m)) is the identity; throws on a map that collapses the plane. */
export function invert(m: Affine): Affine {
  const det = m[0] * m[3] - m[1] * m[2]
  if (Math.abs(det) < 1e-12) throw new Error('the map has no inverse')
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])]
}

/** The CSS transform for a map. */
export const toCss = (m: Affine) => `matrix(${m.map(n => +n.toFixed(6)).join(', ')})`
