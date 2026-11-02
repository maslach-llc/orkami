// What the pages share: the shapes a fold is shown at, the named folds in catalogue order,
// and the house style (the logo's four tones, docs/design/02-look.md) for the wordmark pages.
import { named, type Fold, type NamedFold, type StyleOverrides } from 'orkami'

export type Shape = 'wide' | 'square' | 'tall'
export const SHAPES: Record<Shape, [number, number]> = { wide: [320, 180], square: [240, 240], tall: [180, 320] }

export const FOLDS = Object.keys(named) as NamedFold[]

/** The fold `name` at `shape`, or the reason it refuses that rectangle (a base needs a square). */
export function tryFold(name: NamedFold, w: number, h: number): { fold?: Fold; error?: string } {
  try { return { fold: named[name](w, h) } } catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
}

/** The logo's tones (02-look.md, the reference lockup): the wordmark pages draw it in these. */
export const HOUSE: StyleOverrides = {
  tones: {
    lit: [{ top: '#6D80E6', bottom: '#5467CC' }, { top: '#445BD6', bottom: '#2A42BC' }],
    shade: [{ top: '#2D374E', bottom: '#141E34' }, { top: '#232731', bottom: '#0A0E17' }],
  },
}

export const deg = (r: number) => (r * 180 / Math.PI).toFixed(1)
