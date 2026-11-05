// Letters as folds: a wordmark's glyphs as strips of paper folded into letters, each a `Fold`
// of the core model (a demo of letters as folds, docs/design/01-decisions.md D9). Every letter
// is a tree of flat facets; each facet hangs off its parent on a hinge (the crease they share),
// so a letter can be unfolded crease by crease by the engine or drawn flat as polygons.
// The polygons are the seed's (`origami.ts`), every number identical; the trees are rooted in
// each letter's middle facet so it folds down onto itself (0.1.1).
//
// Units: letters are 270 tall; the ribbon is 72 wide (the M's diagonal strip is 76). Facets
// alternate lit and shaded along each strip, the way a zigzag catches one light from the upper
// left, and that alternation is what reads as folded paper whatever the colors are. Lit facets
// take the lit slots, shaded facets the shade slots (docs/design/02-look.md).
import type { Pt } from '../core/affine.ts'
import { assertValid, type Assignment, type Crease, type Face, type Fold, type Slot } from '../core/fold.ts'

/** A letter: its fold (one crease per hinged facet), the hinge it hangs on in a word, and the order its flaps open. */
export interface Glyph {
  char: string
  width: number
  fold: Fold
  /** An edge of the root facet: how the letter hangs in the word. Not part of the glyph's fold: `wordFold` hangs the letter on the page by it (D13). */
  hinge: [Pt, Pt]
  /** The letter's creases in the order they open, the top of the folded packet first: a hand unfolding the last flap it folded. */
  order: string[]
}

export const HEIGHT = 270
export const STRIP = 72

interface Facet {
  /** Layer name, stable across the renderers: leg-left, fold-left, top, bar, ... */
  name: string
  /** Polygon in letter space (y down, 0..270). */
  pts: Pt[]
  /** Index of the facet this one is creased to, or -1 for the letter's root facet. */
  parent: number
  /** The crease: two points on the shared edge, A to B. For the root, the edge the letter hangs on in a word. */
  hinge: [Pt, Pt]
  /** Catches the light (a lit slot) or sits in shade (a shade slot). */
  lit: boolean
  /** The crease (by its child facet) a shade facet's gradient falls from when not its own hinge: the seed's hinge, kept so the resting look is the seed's whatever the tree. */
  seam?: string
}

const f = (name: string, pts: Pt[], parent: number, hinge: [Pt, Pt], lit: boolean, seam?: string): Facet => ({ name, pts, parent, hinge, lit, ...(seam ? { seam } : {}) })

/**
 * A facet tree as a Fold: the root is the facet with no parent, the creases are the hinges,
 * alternating valley and mountain by depth (a zigzag strip), closing at 180 degrees. Facets keep
 * the letter's drawing order (the slots alternate along it), whichever one is the root. `order`
 * lists the creases as they open (by child facet name); every crease must be in it once.
 */
function glyphOf(char: string, width: number, facets: Facet[], order: string[]): Glyph {
  const roots = facets.filter(fc => fc.parent === -1)
  const root = roots[0]
  if (!root || roots.length > 1) throw new Error(`glyph ${char}: needs exactly one root facet`)
  let lit = 0, shade = 0
  const faces: Face[] = facets.map(fc => {
    // The seed's slot alternation: lit facets alternate the two lit slots in facet order, shaded the two shade slots
    const slot: Slot = fc.lit ? (lit++ % 2 ? 'lit2' : 'lit') : (shade++ % 2 ? 'shade2' : 'shade')
    return { id: fc.name, pts: fc.pts, slot, ...(fc.seam ? { seam: fc.seam } : {}) }
  })
  const depth = (i: number): number => facets[i]!.parent < 0 ? 0 : 1 + depth(facets[i]!.parent)
  const creases: Crease[] = facets
    .map((fc, i) => ({ fc, i }))
    .filter(({ fc }) => fc.parent >= 0)
    .map(({ fc, i }) => {
      const assignment: Assignment = depth(i) % 2 ? 'V' : 'M'
      return { id: fc.name, a: fc.hinge[0], b: fc.hinge[1], assignment, parent: facets[fc.parent]!.name, child: fc.name, closed: Math.PI }
    })
  const fold: Fold = { name: `glyph-${char}`, sheet: { width, height: HEIGHT, cut: true }, faces, creases, root: root.name }
  const ids = creases.map(c => c.id)
  if (order.length !== ids.length || !ids.every(id => order.includes(id))) throw new Error(`glyph ${char}: order must list every crease once`)
  return { char, width, fold: assertValid(fold), hinge: root.hinge, order }
}

// Each letter folds down onto its middle facet (the root), so the folded packet lies in the
// letter's own place, and opens from the top of the packet down, one flap after the next.

// The mark. Two triangular legs and two diagonal strips meeting in a valley fold at x=200: folded,
// it is its own left half doubled (the right half over on the centre crease, its leg tucked in
// over it, the left leg under), and it opens like a book on that crease.
const M = glyphOf('M', 400, [
  f('leg-left', [[0, 0], [112, 190], [0, 270]], 1, [[0, 0], [112, 190]], true),
  f('fold-left', [[0, 0], [200, 163], [200, 270], [112, 190]], -1, [[200, 163], [200, 270]], false, 'leg-left'),
  f('fold-right', [[400, 0], [288, 190], [200, 270], [200, 163]], 1, [[200, 163], [200, 270]], true),
  f('leg-right', [[400, 0], [400, 270], [288, 190]], 2, [[400, 0], [288, 190]], false),
], ['leg-right', 'fold-right', 'leg-left'])

// Every other letter is cut from the same strip and ends the way the M's legs do: in a point.
// A terminal is a triangle (the strip sliced on the diagonal), a corner is a square of the
// strip width split by its diagonal, and that diagonal is the crease. Drawn by hand in the
// letter set; the numbers here are the cleaned-up version of those shapes.

// A: two strokes meeting in a vertical crease at the apex, pointed at the feet, no bar (the
// M has none either, and the wordmark reads as a lockup, not as text).
const A = glyphOf('A', 300, [
  f('stroke-left', [[0, 270], [150, 0], [150, 148.3]], -1, [[0, 270], [150, 0]], true),
  f('stroke-right', [[300, 270], [150, 0], [150, 148.3]], 0, [[150, 0], [150, 148.3]], false),
], ['stroke-right'])

// S: a zigzag strip, both ends cut to a point, folded in from both ends onto its middle.
const S = glyphOf('S', 220, [
  f('top', [[0, 0], [220, 0], [72, 72]], 1, [[0, 0], [72, 72]], true),
  f('side-left', [[0, 0], [72, 72], [72, 99], [0, 171]], 2, [[0, 171], [72, 99]], false, 'top'),
  f('middle', [[0, 171], [72, 99], [220, 99], [148, 171]], -1, [[0, 171], [148, 171]], true),
  f('side-right', [[220, 99], [148, 171], [148, 198], [220, 270]], 2, [[220, 99], [148, 171]], false),
  f('bottom', [[220, 270], [148, 198], [0, 270]], 3, [[148, 198], [220, 270]], true),
], ['bottom', 'side-right', 'top', 'side-left'])

const L = glyphOf('L', 200, [
  f('stem', [[0, 0], [72, 198], [0, 270]], -1, [[0, 0], [0, 270]], true),
  f('foot', [[0, 270], [72, 198], [200, 270]], 0, [[0, 270], [72, 198]], false),
], ['foot'])

// C: the spine with its two arms folded down onto it on their mitres.
const C = glyphOf('C', 220, [
  f('top', [[0, 0], [220, 0], [72, 72]], 1, [[0, 0], [72, 72]], true),
  f('spine', [[0, 0], [72, 72], [72, 198], [0, 270]], -1, [[0, 0], [0, 270]], false, 'top'),
  f('bottom', [[0, 270], [72, 198], [220, 270]], 1, [[0, 270], [72, 198]], true),
], ['bottom', 'top'])

// H: two stems tapering in opposite directions, the bar a strip folded between them, its
// ends sitting on the stems' inner edges. Folded, both stems lie over the bar.
const H = (() => {
  const W = 200, S = STRIP
  const xl = (y: number) => S * (1 - y / HEIGHT)
  const xr = (y: number) => W - S * (y / HEIGHT)
  const y1 = 99, y2 = 171
  return glyphOf('H', W, [
    f('stem-left', [[0, 0], [S, 0], [0, HEIGHT]], 1, [[xl(y2), y2], [xl(y1), y1]], true),
    f('bar', [[xl(y1), y1], [xr(y1), y1], [xr(y2), y2], [xl(y2), y2]], -1, [[xl(y2), y2], [xr(y2), y2]], false, 'stem-left'),
    f('stem-right', [[W, 0], [W, HEIGHT], [W - S, HEIGHT]], 1, [[xr(y1), y1], [xr(y2), y2]], true),
  ], ['stem-right', 'stem-left'])
})()

export const GLYPHS: Record<string, Glyph> = { M, A, S, L, C, H }

/** The glyph of a letter (case does not matter); throws for a letter the set does not have. */
export function glyph(char: string): Glyph {
  const g = GLYPHS[char.toUpperCase()]
  if (!g) throw new Error(`no glyph for ${JSON.stringify(char)}`)
  return g
}

/** Space between letters, and after the mark, in letter units. */
export const GAP = 40
export const MARK_GAP = 52
/** Pairs that sit closer: the L's foot runs under the A's leg. */
export const KERN: Record<string, number> = { LA: -18 }
