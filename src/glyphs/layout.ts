// A word laid out from the glyphs: each letter's fold placed at its x, every face with its
// absolute polygon and hinge in word space, so a flat renderer can draw the lockup and the
// engine can hang each letter on its hinge. The placement is the seed's `layout()`.
import type { Pt } from '../core/affine.ts'
import type { Crease, Face, Slot } from '../core/fold.ts'
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
