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
// Closed: W x H/(n+1), n + 1 layers, P1 on P0, P2 under P1, and so on. The motion is the
// pleat's own, all creases at once (D17): c1 opens on its time and every other crease follows
// it at twice its folded fraction. Unfolding, the stack first stands up on c1 (c1 to 90 degrees,
// the others still shut), then the panels fan out along the table in a zigzag whose low creases
// stay on it and slide away from c1, until the sheet lies flat. Folding is the same read back.
// Nothing swings through the air carrying the flat rest of the sheet, as a crease-by-crease
// sequence did. Suits: a list of steps or a tall column on horizontal creases; a strip of
// letters or cards side by side on vertical creases.
import type { Pt } from '../affine.ts'
import { assertValid, type Crease, type Face, type Fold } from '../fold.ts'
import { creaseDuration, type Schedule } from '../schedule.ts'
import { reach } from '../tree.ts'

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
  fold.schedule = pleat(fold)
  return assertValid(fold)
}

/** c1 on its own time for the whole motion, every inner crease following it at 2 (D17); as long as c1's flap takes to swing, the reach of the whole pleat. */
function pleat(fold: Fold): Schedule {
  const creases: Schedule['creases'] = {}
  for (const c of fold.creases) creases[c.id] = c.id === 'c1' ? { start: 0, duration: 1 } : { start: 0, duration: 1, follow: { crease: 'c1', ratio: 2 } }
  return { creases, total: creaseDuration(reach(fold, 'c1')) }
}
