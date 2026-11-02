// Preliminary, or square base (docs/study/01-how-paper-folds.md 3.8): the inverse assignment
// of the waterbomb, collapsing into a square. Same figure and faces as the waterbomb:
//
//  A        m1        B                 rays from O              closed angle
//  +--------+---------+                 O-m1 O-m2 O-m3 O-m4      M, 180
//  |\   T1  .   T2   /|                 O-B  O-D                 V, 180
//  |  \     .      /  |                 O-A  O-C                 F, 0
//  |    \   .    /    |
//  | Tl   \ . /   Tr  |                 faces: T1 = O A m1, T2 = O m1 B, Tl = O A m4,
//  m4 - - - O - - - - m2                Tl' = O m4 D, T7 = O D m3, T8 = O m3 C,
//  | Tl'  / . \   Tr' |                 Tr' = O m2 C, Tr = O m2 B
//  |    /   .    \    |
//  |  /     .      \  |
//  |/   T7  .   T8   \|
//  +--------+---------+
//  D        m3        C
//
// Closed: the quarter A m1 O m4, four layers; the front layer is T1 + Tl, coplanar across the
// flat O-A, so the visitor sees the top-left quarter of the content with a flat crease on its
// diagonal. Maekawa at O: M = 4, V = 2. Fold and unfold order: as the waterbomb, one coupled
// motion. The tree roots on T1, runs the chains T2, Tr, Tr' and Tl, Tl', T7, T8, and leaves
// O-C out as the closing crease, flat in every pose. Suits: a square that waits as its own
// top-left quarter.
import type { Pt } from '../affine.ts'
import { assertValid, type Fold } from '../fold.ts'
import { together } from '../schedule.ts'

export function preliminary(w: number, h = w): Fold {
  if (Math.abs(w - h) > 1e-9 * w) throw new Error('the preliminary base needs a square sheet')
  const O: Pt = [w / 2, h / 2]
  const A: Pt = [0, 0], m1: Pt = [w / 2, 0], B: Pt = [w, 0], m2: Pt = [w, h / 2]
  const C: Pt = [w, h], m3: Pt = [w / 2, h], D: Pt = [0, h], m4: Pt = [0, h / 2]
  const fold: Fold = {
    name: 'preliminary',
    sheet: { width: w, height: h },
    faces: [
      { id: 'T1', pts: [O, A, m1] }, { id: 'T2', pts: [O, m1, B] },
      { id: 'Tl', pts: [O, m4, A] }, { id: 'Tl2', pts: [O, D, m4] },
      { id: 'T7', pts: [O, m3, D] }, { id: 'T8', pts: [O, C, m3] },
      { id: 'Tr', pts: [O, B, m2] }, { id: 'Tr2', pts: [O, m2, C] },
    ],
    creases: [
      { id: 'OA', a: O, b: A, assignment: 'F', parent: 'T1', child: 'Tl', closed: 0 },
      { id: 'Om1', a: O, b: m1, assignment: 'M', parent: 'T1', child: 'T2', closed: Math.PI },
      { id: 'OB', a: O, b: B, assignment: 'V', parent: 'T2', child: 'Tr', closed: Math.PI },
      { id: 'Om2', a: O, b: m2, assignment: 'M', parent: 'Tr', child: 'Tr2', closed: Math.PI },
      { id: 'Om4', a: O, b: m4, assignment: 'M', parent: 'Tl', child: 'Tl2', closed: Math.PI },
      { id: 'OD', a: O, b: D, assignment: 'V', parent: 'Tl2', child: 'T7', closed: Math.PI },
      { id: 'Om3', a: O, b: m3, assignment: 'M', parent: 'T7', child: 'T8', closed: Math.PI },
      { id: 'OC', a: O, b: C, assignment: 'F', parent: 'Tr2', child: 'T8', closed: 0, closing: true },
    ],
    root: 'T1',
    closures: [{ vertex: O, closing: 'OC', solved: ['OB', 'OD'], across: [Math.SQRT1_2, -Math.SQRT1_2] }],
    suits: ['square'],
  }
  fold.schedule = together(fold)
  return assertValid(fold)
}
