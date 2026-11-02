// The library of named folds (docs/design/01-decisions.md D7), each with its crease pattern,
// closed state and unfold order drawn in docs/study/01-how-paper-folds.md section 3. The fish
// base is catalogued there but not shipped until the closure solver handles two vertices.
import type { Fold } from '../fold.ts'
import { accordion } from './accordion.ts'
import { blintz } from './blintz.ts'
import { book } from './book.ts'
import { cupboard } from './cupboard.ts'
import { diagonal } from './diagonal.ts'
import { kite } from './kite.ts'
import { lift } from './lift.ts'
import { preliminary } from './preliminary.ts'
import { waterbomb } from './waterbomb.ts'

export { accordion, blintz, book, cupboard, diagonal, kite, lift, preliminary, waterbomb }
export type { Axis as AccordionAxis } from './accordion.ts'
export type { Side } from './book.ts'
export type { Axis as CupboardAxis } from './cupboard.ts'
export type { Corner } from './diagonal.ts'
export type { Edge } from './lift.ts'

export type NamedFold = 'book' | 'lift' | 'cupboard' | 'accordion' | 'blintz' | 'diagonal' | 'waterbomb' | 'preliminary' | 'kite'

/** Every named fold on its defaults, by name, for a rectangle w x h. */
export const named: Record<NamedFold, (w: number, h: number) => Fold> = {
  book: (w, h) => book(w, h),
  lift: (w, h) => lift(w, h),
  cupboard: (w, h) => cupboard(w, h),
  accordion: (w, h) => accordion(w, h),
  blintz: (w, h) => blintz(w, h),
  diagonal: (w, h) => diagonal(w, h),
  waterbomb: (w, h) => waterbomb(w, h),
  preliminary: (w, h) => preliminary(w, h),
  kite: (w, h) => kite(w, h),
}
