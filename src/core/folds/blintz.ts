// Blintz (docs/study/01-how-paper-folds.md 3.4): the four corners folded to the center on the
// creases joining the edge midpoints.
//
//  +-----------o-----------+
//  |         /   \         |     c1 (V): (W/2, 0) to (0, H/2)      TL
//  |  TL   /       \  TR   |     c2 (V): (W/2, 0) to (W, H/2)      TR
//  |     /           \     |     c3 (V): (W, H/2) to (W/2, H)      BR
//  o   /       C       \   o     c4 (V): (0, H/2) to (W/2, H)      BL
//  |     \   root     /     |     every corner angle 180
//  |  BL   \       /  BR   |
//  |         \   /         |
//  +-----------o-----------+
//
// Closed, on a square: the diamond between the edge midpoints, two layers, the four corner tips
// meeting at the center. Fold order: c1, c2, c3, c4, clockwise from top left, a third of a step
// apart. Unfold order: the reverse, c4 first. Suits: a square card. On a rectangle the corner
// lands where the reflection puts it, P = (W H^2, W^2 H) / (W^2 + H^2), not at the center, and
// the flaps cross: the fold is honest about it and the catalogue keeps it to squares.
import type { Pt } from '../affine.ts'
import { assertValid, type Fold } from '../fold.ts'
import { sequence } from '../schedule.ts'

export function blintz(w: number, h: number): Fold {
  const top: Pt = [w / 2, 0], right: Pt = [w, h / 2], bottom: Pt = [w / 2, h], left: Pt = [0, h / 2]
  const fold: Fold = {
    name: 'blintz',
    sheet: { width: w, height: h },
    faces: [
      { id: 'c', pts: [top, right, bottom, left] },
      { id: 'tl', pts: [[0, 0], top, left] },
      { id: 'tr', pts: [top, [w, 0], right] },
      { id: 'br', pts: [right, [w, h], bottom] },
      { id: 'bl', pts: [left, bottom, [0, h]] },
    ],
    creases: [
      { id: 'c1', a: top, b: left, assignment: 'V', parent: 'c', child: 'tl', closed: Math.PI },
      { id: 'c2', a: top, b: right, assignment: 'V', parent: 'c', child: 'tr', closed: Math.PI },
      { id: 'c3', a: right, b: bottom, assignment: 'V', parent: 'c', child: 'br', closed: Math.PI },
      { id: 'c4', a: left, b: bottom, assignment: 'V', parent: 'c', child: 'bl', closed: Math.PI },
    ],
    root: 'c',
    suits: ['square'],
  }
  fold.schedule = sequence(fold, ['c4', 'c3', 'c2', 'c1'], { step: 30 })
  return assertValid(fold)
}
