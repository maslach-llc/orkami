// The page's sheet of paper: the fold pattern behind every page (OrigamiSheet draws it), and
// the same pattern as a self-contained SVG so a block can be painted with the sheet under it
// (sheetPaint.ts, `.ori-paper` in origami.css) and fold out of the background rather than off
// a sheet of its own.
//
// Seven large facets, the way a letter folded in thirds and once on the diagonal opens: two
// valley points (k, m) with the creases fanning out of them to the edges. Each facet is the page
// color shifted a few percent into light or shade, alternating across every crease the way the
// wordmark's facets do, and two carry a trace of the brand color. Faint on purpose: every facet
// stays within 4 lightness points of --bg, so text contrast never changes. The sheet is drawn
// 1600 x 1000 and sliced to the viewport (xMidYMid slice), so at a desktop width the hero
// wordmark sits across the top two facets and the service rows on the shaded center one.
export type Pt = [number, number]
export const SHEET_W = 1600
export const SHEET_H = 1000

const P: Record<string, Pt> = {
  a: [0, 0], b: [700, 0], c: [1600, 0], d: [1600, 480], e: [1600, 1000], f: [900, 1000],
  n: [480, 1000], g: [0, 1000], h: [0, 520],
  k: [560, 300], m: [1120, 560],
}

export type Tone = 'l1' | 'l2' | 's1' | 's2' | 'b'
/** What a tone mixes into the page color, and how much of that (percent). */
export const tones: Record<Tone, { into: string, pct: number }> = {
  l1: { into: '#fff', pct: 2.5 },
  l2: { into: '#fff', pct: 4 },
  s1: { into: '#000', pct: 2 },
  s2: { into: '#000', pct: 3.5 },
  b: { into: 'var(--ori-1)', pct: 4 },
}
/** The crease lines: the ink at this opacity. */
export const CREASE_INK = 0.06

export interface Facet { name: string, keys: string, tone: Tone }
export const facets: Facet[] = [
  { name: 'top-left', keys: 'abkh', tone: 'l2' },
  { name: 'top-right', keys: 'bcmk', tone: 's1' },
  { name: 'edge-right', keys: 'cdm', tone: 'b' },
  { name: 'bottom-right', keys: 'demf', tone: 'l1' },
  { name: 'center', keys: 'hkmn', tone: 's2' },
  { name: 'bottom', keys: 'nmf', tone: 'b' },
  { name: 'bottom-left', keys: 'ghn', tone: 'l1' },
]

export const polys = facets.map(f => ({ ...f, points: [...f.keys].map(k => P[k]!.join(',')).join(' ') }))

// Each shared edge drawn once, so the creases do not double up (the sheet's outer edges are
// not creases)
const border = new Set(['ab', 'bc', 'cd', 'de', 'ef', 'fn', 'gn', 'gh', 'ah'])
const edges = new Set(facets.flatMap(({ keys }) => {
  const k = [...keys]
  return k.map((p, i) => [p, k[(i + 1) % k.length]!].sort().join(''))
}))
export const creases = [...edges].filter(e => !border.has(e))
  .map(e => `M${P[e[0]!]!.join(',')}L${P[e[1]!]!.join(',')}`).join('')

/** The tone as the CSS color OrigamiSheet fills with (color-mix over the live variables). */
export const toneColor = (t: Tone) => `color-mix(in srgb, var(--bg) ${100 - tones[t].pct}%, ${tones[t].into})`

/**
 * The sheet as a standalone SVG document, every color resolved (`fill` gives a tone's color,
 * `crease` the crease stroke), for a data: URL. `flip` turns the sheet 180 degrees: the paper
 * back of a block folded on a horizontal crease is seen upside down and mirrored.
 */
export function sheetSvg(fill: (t: Tone) => string, crease: string, flip = false) {
  const g = flip ? ` transform="rotate(180 ${SHEET_W / 2} ${SHEET_H / 2})"` : ''
  const body = polys.map(p => `<polygon fill="${fill(p.tone)}" points="${p.points}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET_W} ${SHEET_H}" preserveAspectRatio="xMidYMid slice"><g${g}>${body}<path fill="none" stroke="${crease}" stroke-width="1" vector-effect="non-scaling-stroke" d="${creases}"/></g></svg>`
}
