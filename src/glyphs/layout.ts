// A word laid out from the glyphs: each letter's fold placed at its x, every face with its
// absolute polygon and hinge in word space, so a flat renderer can draw the lockup and the
// engine can hang each letter on its hinge. The placement is the seed's `layout()`.
import type { Pt } from '../core/affine.ts'
import { assertValid, type Crease, type Face, type Fold, type Slot } from '../core/fold.ts'
import { timed } from '../core/schedule.ts'
import { GAP, GLYPHS, HEIGHT, KERN, MARK_GAP, type Glyph } from './glyphs.ts'

export interface PlacedFace {
  /** Letter index in the word, and face index within the letter (the fold's face order). */
  letter: number
  index: number
  face: Face
  /** The crease the face hangs on, null for the letter's root. */
  crease: Crease | null
  /** Absolute polygon and hinge, in word space. The root's hinge is the glyph's own (its left edge). */
  abs: Pt[]
  hingeAbs: [Pt, Pt]
  slot: Slot
}

export interface Word {
  text: string
  width: number
  height: number
  letters: { char: string; x: number; width: number; glyph: Glyph }[]
  faces: PlacedFace[]
}

/** Lay out a word from the glyph set. Unknown letters are skipped. */
export function layout(text = 'MASLACH'): Word {
  const letters: Word['letters'] = []
  const faces: PlacedFace[] = []
  let x = 0
  let prev = ''
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch]
    if (!g) continue
    x += KERN[prev + ch] ?? 0
    prev = ch
    const letter = letters.length
    letters.push({ char: ch, x, width: g.width, glyph: g })
    const mv = ([px, py]: Pt): Pt => [px + x, py]
    g.fold.faces.forEach((face, index) => {
      const crease = g.fold.creases.find(c => c.child === face.id) ?? null
      const hinge: [Pt, Pt] = crease ? [crease.a, crease.b] : g.hinge
      faces.push({ letter, index, face, crease, abs: face.pts.map(mv), hingeAbs: [mv(hinge[0]), mv(hinge[1])], slot: face.slot ?? 'lit' })
    })
    x += g.width + (ch === 'M' ? MARK_GAP : GAP)
  }
  const last = letters[letters.length - 1]
  return { text, width: last ? last.x + last.width : 0, height: HEIGHT, letters, faces }
}

/** SVG `points` attribute for a polygon, rounded to 0.1. */
export const points = (pts: Pt[]) => pts.map(p => `${round(p[0])},${round(p[1])}`).join(' ')
const round = (n: number) => Math.round(n * 10) / 10

/** How far a letter's root starts lifted off the page about its own left edge: the folded packet held in its place while the facets open out of it (the seed's 0.08 pi; D13). */
export const PACKET = Math.PI * 0.08
/** The seed's choreography: ms between one letter starting and the next, and between one crease of a letter and the next. */
export const LETTER_STEP = 70
export const FACET_STEP = 60

export interface WordFoldOptions {
  /** The root's lift at t = 0, radians in [0, pi); 0 lays each packet flat in its place (D1's strict rest state). */
  packet?: number
  /** ms between letters. */
  letterStep?: number
  /** ms between a letter's creases, in facet order. */
  step?: number
  /** The base duration (D4), ms. */
  base?: number
}

/** The id a letter's face or crease takes in the word fold: its letter index, a dot, its own id. */
export const wordId = (letter: number, id: string) => `${letter}.${id}`

/**
 * A word as one fold (D13): the root is the page under it (a `page` face, the word's box), and
 * each letter hangs on the page by its glyph's own hinge (the letter's left or top edge, `Glyph.hinge`)
 * on a valley that starts at `packet`, so the letter is a packet lying in its own place, lifted a
 * little on that edge, never hinged on its neighbour: it does not fly. The letter's facets are
 * its glyph's fold below it, ids prefixed by `wordId`. The schedule is the seed's: letter i starts
 * at `i * letterStep` ms, its k-th facet's crease `k * step` after, each running for its reach (D4).
 */
export function wordFold(text = 'MASLACH', { packet = PACKET, letterStep = LETTER_STEP, step = FACET_STEP, base }: WordFoldOptions = {}): Fold {
  if (!(packet >= 0 && packet < Math.PI)) throw new Error(`packet ${packet} is outside [0, pi)`)
  const w = layout(text)
  const faces: Face[] = [{ id: 'page', pts: [[0, 0], [w.width, 0], [w.width, w.height], [0, w.height]], page: true }]
  const creases: Crease[] = []
  const starts: Record<string, number> = {}
  for (const f of w.faces) {
    const id = wordId(f.letter, f.face.id)
    faces.push({ id, pts: f.abs, ...(f.face.slot ? { slot: f.face.slot } : {}) })
    const at = f.letter * letterStep + f.index * step
    if (f.crease) {
      const cid = wordId(f.letter, f.crease.id)
      creases.push({ ...f.crease, id: cid, a: f.hingeAbs[0], b: f.hingeAbs[1], parent: wordId(f.letter, f.crease.parent), child: id })
      starts[cid] = at
    } else {
      const cid = wordId(f.letter, 'hinge')
      creases.push({ id: cid, a: f.hingeAbs[0], b: f.hingeAbs[1], assignment: packet > 0 ? 'V' : 'F', parent: 'page', child: id, closed: packet })
      starts[cid] = at
    }
  }
  const fold: Fold = { name: `word-${w.text}`, sheet: { width: w.width, height: w.height, cut: true }, faces, creases, root: 'page' }
  fold.schedule = timed(fold, starts, base === undefined ? {} : { base })
  return assertValid(fold)
}
