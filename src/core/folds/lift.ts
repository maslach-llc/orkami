// Lift (docs/study/01-how-paper-folds.md 3.2): a book fold whose root is the page. The block
// is a flap hinged on one of its own edges, lying folded back over the page with its back up;
// opening it turns it 180 degrees onto its place.
//
//  ===========================   the page (root; the sheet paint is this)
//  +-------------------------+   c1 (V): the block's top edge, (0, 0) to (W, 0)
//  |                         |
//  |         block           |   closed: lying above its place, back up, over the page
//  |                         |   (y from -H to 0), angle 180
//  +-------------------------+
//
// Closed: W x H, mirrored across the hinge edge, back up; the visitor sees the back, painted
// with the page, so nothing. Fold order: c1. Unfold order: c1. Suits: everything that should
// arrive out of the background: sections, cards, rows. The hinge edge is the one nearest the
// content the block belongs to. Paper rests flat (D1): no -90 degree start.
import type { Pt } from '../affine.ts'
import { assertValid, type Fold } from '../fold.ts'
import { together } from '../schedule.ts'

export type Edge = 'top' | 'bottom' | 'left' | 'right'

const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

/** `edge` is the block's edge the hinge runs along; the page the block lies on when closed is the box reflected across it. */
export function lift(w: number, h: number, edge: Edge = 'top'): Fold {
  const page = edge === 'top' ? box(0, -h, w, 0) : edge === 'bottom' ? box(0, h, w, 2 * h) : edge === 'left' ? box(-w, 0, 0, h) : box(w, 0, 2 * w, h)
  const hinge: [Pt, Pt] = edge === 'top' ? [[0, 0], [w, 0]] : edge === 'bottom' ? [[0, h], [w, h]] : edge === 'left' ? [[0, 0], [0, h]] : [[w, 0], [w, h]]
  const fold: Fold = {
    name: 'lift',
    sheet: { width: w, height: h },
    faces: [{ id: 'page', pts: page, page: true }, { id: 'block', pts: box(0, 0, w, h) }],
    creases: [{ id: 'c1', a: hinge[0], b: hinge[1], assignment: 'V', parent: 'page', child: 'block', closed: Math.PI }],
    root: 'page',
    suits: ['wide', 'square', 'tall', 'list'],
  }
  fold.schedule = together(fold)
  return assertValid(fold)
}
