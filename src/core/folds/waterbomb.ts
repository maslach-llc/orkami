// Waterbomb base (docs/study/01-how-paper-folds.md 3.7): a square pre-creased on both
// diagonals and both midlines, collapsed into a triangle with four flaps. Only six of the eight
// rays at the center are folded in the closed state.
//
//  A        m1        B                 rays from O         closed angle
//  +--------+---------+                 O-A  O-B  O-C  O-D   M, 180
//  |\   T1  .   T2   /|                 O-m2 O-m4            V, 180
//  |  \     .      /  |                 O-m1 O-m3            F, 0  (pre-creased, flat)
//  |    \   .    /    |
//  | Tl   \ . /   Tr  |                 faces: eight eighths, T1 = O A m1, T2 = O m1 B,
//  m4 - - - O - - - - m2                Tl = O A m4, Tl' = O m4 D, T7 = O D m3,
//  | Tl'  / . \   Tr' |                 T8 = O m3 C, Tr' = O m2 C, Tr = O m2 B
//  |    /   .    \    |
//  |  /     .      \  |                 face cycle around O:
//  |/   T7  .   T8   \|                 T1 -OA- Tl -Om4- Tl' -OD- T7 -Om3- T8 -OC- Tr' -Om2- Tr -OB- T2 -Om1- T1
//  +--------+---------+
//  D        m3        C
//
// Closed: the triangle O A B (base on the top edge, apex at the center), four layers; the
// visitor sees the front of T1 + T2 with a flat crease down its middle. Maekawa at O: M = 4,
// V = 2. Fold order: the midline as a book fold, then the sides pushed in: one coupled motion.
// Unfold order: one coupled motion back, every crease at once, the flat ones staying at 0.
// The tree roots on T1, runs the chains Tl, Tl', T7 and Tr, Tr', T8 outward, and leaves O-C
// out as the closing crease: the four mountain corners are driven, the two valleys solved so
// the loop closes. Suits: a square that waits as a tab at the top of its place.
import type { Pt } from '../affine.ts'
import { assertValid, type Fold } from '../fold.ts'
import { together } from '../schedule.ts'

export function waterbomb(w: number, h = w): Fold {
  if (Math.abs(w - h) > 1e-9 * w) throw new Error('the waterbomb base needs a square sheet')
  const O: Pt = [w / 2, h / 2]
  const A: Pt = [0, 0], m1: Pt = [w / 2, 0], B: Pt = [w, 0], m2: Pt = [w, h / 2]
  const C: Pt = [w, h], m3: Pt = [w / 2, h], D: Pt = [0, h], m4: Pt = [0, h / 2]
  const fold: Fold = {
    name: 'waterbomb',
    sheet: { width: w, height: h },
    faces: [
      { id: 'T1', pts: [O, A, m1] }, { id: 'T2', pts: [O, m1, B] },
      { id: 'Tl', pts: [O, m4, A] }, { id: 'Tl2', pts: [O, D, m4] },
      { id: 'T7', pts: [O, m3, D] }, { id: 'T8', pts: [O, C, m3] },
      { id: 'Tr', pts: [O, B, m2] }, { id: 'Tr2', pts: [O, m2, C] },
    ],
    creases: [
      { id: 'Om1', a: O, b: m1, assignment: 'F', parent: 'T1', child: 'T2', closed: 0 },
      { id: 'OA', a: O, b: A, assignment: 'M', parent: 'T1', child: 'Tl', closed: Math.PI },
      { id: 'Om4', a: O, b: m4, assignment: 'V', parent: 'Tl', child: 'Tl2', closed: Math.PI },
      { id: 'OD', a: O, b: D, assignment: 'M', parent: 'Tl2', child: 'T7', closed: Math.PI },
      { id: 'Om3', a: O, b: m3, assignment: 'F', parent: 'T7', child: 'T8', closed: 0 },
      { id: 'OB', a: O, b: B, assignment: 'M', parent: 'T2', child: 'Tr', closed: Math.PI },
      { id: 'Om2', a: O, b: m2, assignment: 'V', parent: 'Tr', child: 'Tr2', closed: Math.PI },
      { id: 'OC', a: O, b: C, assignment: 'M', parent: 'Tr2', child: 'T8', closed: Math.PI, closing: true },
    ],
    root: 'T1',
    closures: [{ vertex: O, closing: 'OC', solved: ['Om4', 'Om2'], across: [1, 0] }],
    suits: ['square'],
  }
  fold.schedule = together(fold)
  return assertValid(fold)
}
