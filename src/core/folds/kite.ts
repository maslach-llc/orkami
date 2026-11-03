// Kite base (docs/study/01-how-paper-folds.md 3.9): two valleys bringing two adjacent edges
// onto the diagonal. The study draws the square on its corner, A at the top, the reference
// diagonal A-C vertical; here A is the top-left corner of the page box, B top right, C bottom
// right, D bottom left, and A-C runs corner to corner.
//
//           A
//          /|\
//         / | \
//        /  |  \        c1 (V): A to p, where p is on D-C and angle(p A C) = 22.5 degrees
//       /   |   \       c2 (V): A to q, where q is on B-C, mirror of p
//      /    |    \      A-C: a reference line, not a crease (F or absent)
//   D /     |     \ B   the flaps (A D p) and (A B q) fold over the kite (A p C q), angle 180
//     \  ,--+--.  /
//      \/   |   \/
//      p\   |   /q
//        \  |  /
//         \ | /
//          \|/
//           C
//
// Closed: the kite A p C q, two layers on its upper half, the backs of the two flaps over the
// top of the kite. The two flaps are mirror images and open together (D7), meeting nowhere on
// the way; `sequence(fold, ['c2', 'c1'])` gives a hand's one-then-the-other.
// Suits: a square block with a pointed top; kept because the fish base starts from it and the
// letter glyphs use its 22.5 degree wedges. On a rectangle each crease bisects its own corner
// angle, so each flap's edge still lands on the diagonal.
import type { Pt } from '../affine.ts'
import { assertValid, type Fold } from '../fold.ts'
import { together } from '../schedule.ts'

export function kite(w: number, h: number): Fold {
  const A: Pt = [0, 0], B: Pt = [w, 0], C: Pt = [w, h], D: Pt = [0, h]
  // p on the bottom edge where the bisector of angle DAC meets it; q on the right edge, of BAC
  const p: Pt = [h * Math.tan(Math.atan2(w, h) / 2), h]
  const q: Pt = [w, w * Math.tan(Math.atan2(h, w) / 2)]
  const fold: Fold = {
    name: 'kite',
    sheet: { width: w, height: h },
    faces: [
      { id: 'kite', pts: [A, p, C, q] },
      { id: 'left', pts: [A, D, p] },
      { id: 'right', pts: [A, B, q] },
    ],
    creases: [
      { id: 'c1', a: A, b: p, assignment: 'V', parent: 'kite', child: 'left', closed: Math.PI },
      { id: 'c2', a: A, b: q, assignment: 'V', parent: 'kite', child: 'right', closed: Math.PI },
    ],
    root: 'kite',
    suits: ['square'],
  }
  fold.schedule = together(fold)
  return assertValid(fold)
}
