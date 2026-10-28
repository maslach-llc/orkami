// The origami brand geometry: the M mark and the MASLACH wordmark as strips of paper folded
// into letters. Every letter is a tree of flat facets; each facet hangs off its parent on a
// hinge (the crease they share), so a letter can be unfolded crease by crease in 3D
// (OrigamiUnfold.vue) or drawn flat as polygons (OrigamiWord.vue, OrigamiMark.vue, icon.svg).
//
// Units: letters are 270 tall; the ribbon is 72 wide (the M's diagonal strip is 76). Facets
// alternate lit and shaded along each strip, the way a zigzag catches one light from the upper
// left, and that alternation is what reads as folded paper whatever the colors are. Lit
// facets take the accent (--ori-1, --ori-3), shaded facets the dark (--ori-2, --ori-4).
// Mirrors the Origami M component set on the "new logo" page of the Figma brand file
// (4dCOuFddrSlSROuULc5Rl1).

export type Pt = [number, number]

export interface Facet {
  /** Layer name, stable for Figma and CSS: leg-left, fold-left, top, bar, ... */
  name: string
  /** Polygon in letter space (y down, 0..270). */
  pts: Pt[]
  /** Index of the facet this one is creased to, or -1 for the letter's root facet. */
  parent: number
  /** The crease: two points on the shared edge, A to B. The root hinges on its left edge. */
  hinge: [Pt, Pt]
  /** Catches the light (accent) or sits in shade (dark). */
  lit: boolean
}

export interface Glyph {
  char: string
  width: number
  facets: Facet[]
}

export const HEIGHT = 270
export const STRIP = 72

const f = (name: string, pts: Pt[], parent: number, hinge: [Pt, Pt], lit: boolean): Facet => ({ name, pts, parent, hinge, lit })

// The mark. Two triangular legs and two diagonal strips meeting in a valley fold at x=200.
export const M: Glyph = {
  char: 'M',
  width: 400,
  facets: [
    f('leg-left', [[0, 0], [112, 190], [0, 270]], -1, [[0, 0], [0, 270]], true),
    f('fold-left', [[0, 0], [200, 163], [200, 270], [112, 190]], 0, [[0, 0], [112, 190]], false),
    f('fold-right', [[400, 0], [288, 190], [200, 270], [200, 163]], 1, [[200, 163], [200, 270]], true),
    f('leg-right', [[400, 0], [400, 270], [288, 190]], 2, [[400, 0], [288, 190]], false),
  ],
}

// Every other letter is cut from the same strip and ends the way the M's legs do: in a point.
// A terminal is a triangle (the strip sliced on the diagonal), a corner is a square of the
// strip width split by its diagonal, and that diagonal is the crease. Drawn by hand in the
// Figma letter set; the numbers here are the cleaned-up version of those shapes.

// A: two strokes meeting in a vertical crease at the apex, pointed at the feet, no bar (the
// M has none either, and the wordmark reads as a lockup, not as text).
const A: Glyph = {
  char: 'A',
  width: 300,
  facets: [
    f('stroke-left', [[0, 270], [150, 0], [150, 148.3]], -1, [[0, 270], [150, 0]], true),
    f('stroke-right', [[300, 270], [150, 0], [150, 148.3]], 0, [[150, 0], [150, 148.3]], false),
  ],
}

// S: a zigzag strip, both ends cut to a point.
const S: Glyph = {
  char: 'S',
  width: 220,
  facets: [
    f('top', [[0, 0], [220, 0], [72, 72]], -1, [[0, 0], [220, 0]], true),
    f('side-left', [[0, 0], [72, 72], [72, 99], [0, 171]], 0, [[0, 0], [72, 72]], false),
    f('middle', [[0, 171], [72, 99], [220, 99], [148, 171]], 1, [[0, 171], [72, 99]], true),
    f('side-right', [[220, 99], [148, 171], [148, 198], [220, 270]], 2, [[220, 99], [148, 171]], false),
    f('bottom', [[220, 270], [148, 198], [0, 270]], 3, [[148, 198], [220, 270]], true),
  ],
}

const L: Glyph = {
  char: 'L',
  width: 200,
  facets: [
    f('stem', [[0, 0], [72, 198], [0, 270]], -1, [[0, 0], [0, 270]], true),
    f('foot', [[0, 270], [72, 198], [200, 270]], 0, [[0, 270], [72, 198]], false),
  ],
}

const C: Glyph = {
  char: 'C',
  width: 220,
  facets: [
    f('top', [[0, 0], [220, 0], [72, 72]], -1, [[0, 0], [220, 0]], true),
    f('spine', [[0, 0], [72, 72], [72, 198], [0, 270]], 0, [[0, 0], [72, 72]], false),
    f('bottom', [[0, 270], [72, 198], [220, 270]], 1, [[0, 270], [72, 198]], true),
  ],
}

// H: two stems tapering in opposite directions, the bar a strip folded between them, its
// ends sitting on the stems' inner edges.
const H: Glyph = (() => {
  const W = 200, S = STRIP
  const xl = (y: number) => S * (1 - y / HEIGHT)
  const xr = (y: number) => W - S * (y / HEIGHT)
  const y1 = 99, y2 = 171
  return {
    char: 'H',
    width: W,
    facets: [
      f('stem-left', [[0, 0], [S, 0], [0, HEIGHT]], -1, [[0, 0], [0, HEIGHT]], true),
      f('bar', [[xl(y1), y1], [xr(y1), y1], [xr(y2), y2], [xl(y2), y2]], 0, [[xl(y2), y2], [xl(y1), y1]], false),
      f('stem-right', [[W, 0], [W, HEIGHT], [W - S, HEIGHT]], 1, [[xr(y1), y1], [xr(y2), y2]], true),
    ],
  }
})()

export const GLYPHS: Record<string, Glyph> = { M, A, S, L, C, H }

/** Space between letters, and after the mark, in letter units. */
export const GAP = 40
export const MARK_GAP = 52
/** Pairs that sit closer: the L's foot runs under the A's leg. */
export const KERN: Record<string, number> = { LA: -18 }

export interface PlacedFacet extends Facet {
  /** Letter index in the word, and facet index within the letter. */
  letter: number
  index: number
  /** Absolute polygon and hinge, in word space. */
  abs: Pt[]
  hingeAbs: [Pt, Pt]
  /** Color slot 1..4 (--ori-N): lit facets alternate 1 and 3, shaded 2 and 4. */
  slot: 1 | 2 | 3 | 4
}

export interface Word {
  text: string
  width: number
  height: number
  letters: { char: string, x: number, width: number }[]
  facets: PlacedFacet[]
}

/** Lay out a word in the origami face. Unknown letters are skipped. */
export function layout(text = 'MASLACH'): Word {
  const letters: Word['letters'] = []
  const facets: PlacedFacet[] = []
  let x = 0
  let prev = ''
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch]
    if (!g) continue
    x += KERN[prev + ch] ?? 0
    prev = ch
    const letter = letters.length
    letters.push({ char: ch, x, width: g.width })
    let lit = 0, shade = 0
    g.facets.forEach((fc, index) => {
      const slot = (fc.lit ? (lit++ % 2 ? 3 : 1) : (shade++ % 2 ? 4 : 2)) as PlacedFacet['slot']
      const mv = ([px, py]: Pt): Pt => [px + x, py]
      facets.push({ ...fc, letter, index, abs: fc.pts.map(mv), hingeAbs: [mv(fc.hinge[0]), mv(fc.hinge[1])], slot })
    })
    x += g.width + (ch === 'M' ? MARK_GAP : GAP)
  }
  const last = letters[letters.length - 1]
  return { text, width: last ? last.x + last.width : 0, height: HEIGHT, letters, facets }
}

/** SVG `points` attribute for a polygon. */
export const points = (pts: Pt[]) => pts.map(p => `${round(p[0])},${round(p[1])}`).join(' ')
const round = (n: number) => Math.round(n * 10) / 10

/** The four facet colors of the mark: lit, shaded, lit, deep shade. */
export type Palette = [string, string, string, string]

/** The brand mark when no project is selected: cobalt on the lit faces, night navy in the folds. */
export const BRAND: Palette = ['#5d72e3', '#16213a', '#2f49d1', '#0b0f1a']
/** The same on the night navy of dark mode, where a near-black fold would vanish. */
export const BRAND_DARK: Palette = ['#8fa2ff', '#2a3a63', '#5d72e3', '#16213a']
