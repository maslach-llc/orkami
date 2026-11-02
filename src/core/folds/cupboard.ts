// Cupboard (docs/study/01-how-paper-folds.md 3.3): two parallel valleys at the quarter lines;
// both outer quarters fold in to meet at the center, two doors.
//
//  +-----+-----------+-----+
//  |     |           |     |     c1 (V): x = W/4      c2 (V): x = 3W/4
//  |  L  |     C     |  R  |     L folds over the left half of C, R over the right half
//  |     |   root    |     |     both angle 180
//  +-----+-----------+-----+
//
// Closed: W/2 x H (the middle), two layers, the doors' backs meeting on the center line.
// Fold order: c1 then c2. Unfold order: c2 then c1, a step apart: a hand opening one door then
// the other. Suits: a wide hero (doors sideways); turned 90 degrees (creases at y = H/4 and
// 3H/4, faces T, C, B), a tall column that opens top and bottom.
import type { Pt } from '../affine.ts'
import { assertValid, type Fold } from '../fold.ts'
import { sequence } from '../schedule.ts'

export type Axis = 'vertical' | 'horizontal'

const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

export function cupboard(w: number, h: number, axis: Axis = 'vertical'): Fold {
  const vertical = axis === 'vertical'
  const faces = vertical
    ? [{ id: 'c', pts: box(w / 4, 0, 3 * w / 4, h) }, { id: 'l', pts: box(0, 0, w / 4, h) }, { id: 'r', pts: box(3 * w / 4, 0, w, h) }]
    : [{ id: 'c', pts: box(0, h / 4, w, 3 * h / 4) }, { id: 't', pts: box(0, 0, w, h / 4) }, { id: 'b', pts: box(0, 3 * h / 4, w, h) }]
  const line = (k: number): [Pt, Pt] => vertical ? [[k * w, 0], [k * w, h]] : [[0, k * h], [w, k * h]]
  const [c1, c2] = [line(1 / 4), line(3 / 4)]
  const fold: Fold = {
    name: 'cupboard',
    sheet: { width: w, height: h },
    faces,
    creases: [
      { id: 'c1', a: c1[0], b: c1[1], assignment: 'V', parent: 'c', child: vertical ? 'l' : 't', closed: Math.PI },
      { id: 'c2', a: c2[0], b: c2[1], assignment: 'V', parent: 'c', child: vertical ? 'r' : 'b', closed: Math.PI },
    ],
    root: 'c',
    suits: vertical ? ['wide'] : ['tall'],
  }
  fold.schedule = sequence(fold, ['c2', 'c1'])
  return assertValid(fold)
}
