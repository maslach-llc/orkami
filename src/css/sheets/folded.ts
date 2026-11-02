// The default example sheet: seven large facets, the way a letter folded in thirds and once on
// the diagonal opens, with two valley points the creases fan out of. Each facet is the page
// color shifted a few percent into light or shade, alternating across every crease the way a
// strip's facets do, and two carry a trace of an accent. Faint on purpose: every facet stays
// within four lightness points of the page color, so text contrast never changes. Drawn
// 1600 x 1000 and sliced to the viewport (xMidYMid slice). One example of a sheet, not the only
// one: `paintSheet` takes any SVG, image or color.
import type { Pt } from '../../core/affine.ts'

export const FOLDED_W = 1600
export const FOLDED_H = 1000

const P: Record<string, Pt> = {
  a: [0, 0], b: [700, 0], c: [1600, 0], d: [1600, 480], e: [1600, 1000], f: [900, 1000],
  n: [480, 1000], g: [0, 1000], h: [0, 520],
  k: [560, 300], m: [1120, 560],
}

/** A facet's tone: a light or shade step off the page color, or the accent's trace. */
export type FoldedTone = 'l1' | 'l2' | 's1' | 's2' | 'b'

/** What a tone mixes into the page color, and how much of that (percent). */
export const FOLDED_TONES: Record<FoldedTone, { into: 'light' | 'dark' | 'accent'; pct: number }> = {
  l1: { into: 'light', pct: 2.5 },
  l2: { into: 'light', pct: 4 },
  s1: { into: 'dark', pct: 2 },
  s2: { into: 'dark', pct: 3.5 },
  b: { into: 'accent', pct: 4 },
}

/** The crease lines: the ink at this opacity. */
export const FOLDED_CREASE_INK = 0.06

export interface FoldedFacet {
  name: string
  keys: string
  tone: FoldedTone
}

export const FOLDED_FACETS: FoldedFacet[] = [
  { name: 'top-left', keys: 'abkh', tone: 'l2' },
  { name: 'top-right', keys: 'bcmk', tone: 's1' },
  { name: 'edge-right', keys: 'cdm', tone: 'b' },
  { name: 'bottom-right', keys: 'demf', tone: 'l1' },
  { name: 'center', keys: 'hkmn', tone: 's2' },
  { name: 'bottom', keys: 'nmf', tone: 'b' },
  { name: 'bottom-left', keys: 'ghn', tone: 'l1' },
]

/** The facets as polygons, points in sheet units. */
export const foldedPolys = FOLDED_FACETS.map(f => ({ ...f, pts: [...f.keys].map(k => P[k]!) }))

// Each shared edge drawn once, so the creases do not double up (the outer edges are not creases)
const border = new Set(['ab', 'bc', 'cd', 'de', 'ef', 'fn', 'gn', 'gh', 'ah'])
const edges = new Set(FOLDED_FACETS.flatMap(({ keys }) => {
  const k = [...keys]
  return k.map((p, i) => [p, k[(i + 1) % k.length]!].sort().join(''))
}))
/** The crease lines as segments, in sheet units. */
export const foldedCreases: [Pt, Pt][] = [...edges].filter(e => !border.has(e)).map(e => [P[e[0]!]!, P[e[1]!]!])

export interface FoldedColors {
  /** The page color the facets step off. */
  bg: string
  /** The ink the creases are drawn in, at FOLDED_CREASE_INK. */
  ink: string
  /** The color two facets carry a trace of. */
  accent: string
}

/** `#rgb` or `#rrggbb` to channels. */
function channels(c: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim())
  if (!m) throw new Error(`the folded sheet needs hex colors, not ${c}`)
  const h = m[1]!.length === 3 ? [...m[1]!].map(ch => ch + ch).join('') : m[1]!
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** The same math as `color-mix(in srgb, a pctA%, b)`, on hex colors. */
export function mixHex(a: string, b: string, pctA: number): string {
  const A = channels(a), B = channels(b), k = pctA / 100
  return `#${A.map((v, i) => Math.round(v * k + B[i]! * (1 - k)).toString(16).padStart(2, '0')).join('')}`
}

/** A tone's color on a page of `colors.bg`. */
export function foldedToneColor(tone: FoldedTone, colors: FoldedColors): string {
  const { into, pct } = FOLDED_TONES[tone]
  const target = into === 'light' ? '#ffffff' : into === 'dark' ? '#000000' : colors.accent
  return mixHex(colors.bg, target, 100 - pct)
}

/** The sheet as a standalone SVG document with every color resolved, for a data: URL. */
export function foldedSheetSvg(colors: FoldedColors): string {
  const [r, g, b] = channels(colors.ink)
  const crease = `rgba(${r},${g},${b},${FOLDED_CREASE_INK})`
  const body = foldedPolys.map(p => `<polygon fill="${foldedToneColor(p.tone, colors)}" points="${p.pts.map(q => q.join(',')).join(' ')}"/>`).join('')
  const d = foldedCreases.map(([p, q]) => `M${p.join(',')}L${q.join(',')}`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FOLDED_W} ${FOLDED_H}" preserveAspectRatio="xMidYMid slice">${body}<path fill="none" stroke="${crease}" stroke-width="1" vector-effect="non-scaling-stroke" d="${d}"/></svg>`
}
