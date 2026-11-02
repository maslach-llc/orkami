// Book fold (docs/study/01-how-paper-folds.md 3.1): one crease across the sheet; one half
// turns over onto the other.
//
//  +-----------+-----------+
//  |           |           |
//  |     A     |     B     |     c1 (V): x = W/2, (W/2, 0) to (W/2, H)
//  |   root    |           |     B folds over A: angle 180
//  |           |           |
//  +-----------+-----------+
//
// Closed: W/2 x H (the half that stays), two layers, the back of B lying on A.
// Fold order: c1. Unfold order: c1. Suits: every rectangle (a wide hero on a horizontal
// crease, a column on a vertical one). The crease on an edge instead of the middle is the lift.
import type { Pt } from '../affine.ts'
import { assertValid, type Fold } from '../fold.ts'
import { together } from '../schedule.ts'

export type Side = 'left' | 'right' | 'top' | 'bottom'

const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

/** `side` names the half that stays put; the other half folds over it. */
export function book(w: number, h: number, side: Side = 'left'): Fold {
  const vertical = side === 'left' || side === 'right'
  const left = box(0, 0, w / 2, h), right = box(w / 2, 0, w, h)
  const top = box(0, 0, w, h / 2), bottom = box(0, h / 2, w, h)
  const a = side === 'left' ? left : side === 'right' ? right : side === 'top' ? top : bottom
  const b = side === 'left' ? right : side === 'right' ? left : side === 'top' ? bottom : top
  const crease: [Pt, Pt] = vertical ? [[w / 2, 0], [w / 2, h]] : [[0, h / 2], [w, h / 2]]
  const fold: Fold = {
    name: 'book',
    sheet: { width: w, height: h },
    faces: [{ id: 'a', pts: a }, { id: 'b', pts: b }],
    creases: [{ id: 'c1', a: crease[0], b: crease[1], assignment: 'V', parent: 'a', child: 'b', closed: Math.PI }],
    root: 'a',
    suits: ['wide', 'tall', 'square'],
  }
  fold.schedule = together(fold)
  return assertValid(fold)
}
