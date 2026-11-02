// Accordion, or pleat (docs/study/01-how-paper-folds.md 3.6): n parallel creases, alternately
// valley and mountain; n + 1 panels zigzag onto each other, each hinged to the one before it.
//
//  +-----------------------+
//  |          P0  root     |
//  +-----------------------+   c1 (V), y = H/4
//  |          P1           |
//  +-----------------------+   c2 (M), y = H/2
//  |          P2           |
//  +-----------------------+   c3 (V), y = 3H/4
//  |          P3           |
//  +-----------------------+
//
// Closed: W x H/(n+1), n + 1 layers, P1 on P0, P2 under P1, and so on. Fold order: c1, c2,
// c3: the hand pleats from the fixed end. Unfold order: cn, ..., c1: the outermost panel swings
// out first and lands beside the stack, then the next carries the one already open, the way a
// carpet unrolls. Suits: a list of steps or a tall column on horizontal creases; a strip of
// letters or cards side by side on vertical creases.
import type { Pt } from '../affine.ts'
import { assertValid, type Crease, type Face, type Fold } from '../fold.ts'
import { sequence } from '../schedule.ts'

export type Axis = 'horizontal' | 'vertical'

const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

/** n creases, n + 1 panels; horizontal creases stack the panels top to bottom, vertical ones left to right. */
export function accordion(w: number, h: number, n = 3, axis: Axis = 'horizontal'): Fold {
  if (!Number.isInteger(n) || n < 1) throw new Error(`an accordion needs at least one crease, not ${n}`)
  const horizontal = axis === 'horizontal'
  const span = (horizontal ? h : w) / (n + 1)
  const faces: Face[] = []
  const creases: Crease[] = []
  for (let k = 0; k <= n; k++) {
    faces.push({ id: `p${k}`, pts: horizontal ? box(0, k * span, w, (k + 1) * span) : box(k * span, 0, (k + 1) * span, h) })
    if (k === 0) continue
    const at = k * span
    creases.push({
      id: `c${k}`,
      a: horizontal ? [0, at] : [at, 0],
      b: horizontal ? [w, at] : [at, h],
      assignment: k % 2 ? 'V' : 'M',
      parent: `p${k - 1}`,
      child: `p${k}`,
      closed: Math.PI,
    })
  }
  const fold: Fold = {
    name: 'accordion',
    sheet: { width: w, height: h },
    faces,
    creases,
    root: 'p0',
    suits: horizontal ? ['list', 'tall'] : ['wide'],
  }
  fold.schedule = sequence(fold, creases.map(c => c.id).reverse())
  return assertValid(fold)
}
