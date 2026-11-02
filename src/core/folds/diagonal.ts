// Diagonal (docs/study/01-how-paper-folds.md 3.5): one crease corner to corner; one triangle
// turns over onto the other.
//
//  +-----------------------+
//  |  \                    |
//  |     \        B        |     c1 (V): (0, 0) to (W, H)
//  |        \              |     B (the triangle with corner (W, 0)) folds over A: angle 180
//  |    A      \           |
//  |   root       \        |
//  |                 \     |
//  +-----------------------+
//
// Closed, on a square: the triangle A, two layers, the back of B on A. Fold order: c1. Unfold
// order: c1. Suits: a square or near-square card. On a wide block the moving corner lands
// outside the box and the flap reads as a tilting slab; the geometry stays honest and the
// catalogue keeps the diagonal to squares.
import type { Pt } from '../affine.ts'
import { assertValid, type Fold } from '../fold.ts'
import { together } from '../schedule.ts'

export type Corner = 'tr' | 'tl' | 'br' | 'bl'

/** `corner` is the one that moves; the crease is the diagonal that does not pass through it. */
export function diagonal(w: number, h: number, corner: Corner = 'tr'): Fold {
  const tl: Pt = [0, 0], tr: Pt = [w, 0], br: Pt = [w, h], bl: Pt = [0, h]
  // The two diagonals cut the sheet into two pairs of triangles; the moving one has the corner
  const main = corner === 'tr' || corner === 'bl'
  const crease: [Pt, Pt] = main ? [tl, br] : [tr, bl]
  const upper: Pt[] = main ? [tl, tr, br] : [tl, tr, bl]
  const lower: Pt[] = main ? [tl, br, bl] : [tr, br, bl]
  const b = corner === 'tr' || corner === 'tl' ? upper : lower
  const a = b === upper ? lower : upper
  const fold: Fold = {
    name: 'diagonal',
    sheet: { width: w, height: h },
    faces: [{ id: 'a', pts: a }, { id: 'b', pts: b }],
    creases: [{ id: 'c1', a: crease[0], b: crease[1], assignment: 'V', parent: 'a', child: 'b', closed: Math.PI }],
    root: 'a',
    suits: ['square'],
  }
  fold.schedule = together(fold)
  return assertValid(fold)
}
