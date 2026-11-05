// The flat SVG rendering of a word of glyphs: the resting lockup every unfold lands on (K4 in
// docs/design/02-look.md). Each facet is a polygon filled with its slot's print (the style's
// top-to-bottom gradient over the letter's height), the shade facets carry the crease gradient
// from their hinge (02, cue 8), the creases their hairline (cue 6), grain over the lot (cue 7)
// and the resting shadow pair under it (cue 3, `shadowAt(0)`). A string of markup, so a server
// can render it and an adapter can wrap it (the Vue `Word` and `Mark`); no DOM is touched.
// Ported from the seed's flat wordmark, with the values from the style instead of tokens.
import { creaseGradient, shadowAt, slotTone, style as makeStyle, type Style, type StyleOverrides } from '../core/style.ts'
import { layout, points, type PlacedFace } from './layout.ts'

export interface SvgOptions {
  /** The look; overrides over the default style, or a full `Style`. A tone may be any CSS color (a `var()` too). */
  style?: Style | StyleOverrides
  /** The resting shadow pair under the paper. On by default; off in tight spaces such as a header. */
  shadow?: boolean
  /** The grain; the style's `grain.on` by default. */
  grain?: boolean
  /** A prefix for the ids in the markup, unique per instance on a page. */
  id?: string
  /** The accessible name; empty (the default) hides the image from assistive tech. */
  label?: string
}

export interface WordSvg {
  width: number
  height: number
  viewBox: string
  /** The SVG's children: `<defs>` and the drawing. */
  inner: string
  /** The whole `<svg>` element. */
  markup: string
}

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const n = (v: number) => String(Math.round(v * 100) / 100)
const shaded = (f: PlacedFace) => f.slot === 'shade' || f.slot === 'shade2'

/** The word drawn flat as SVG markup. Unknown letters are skipped, as in `layout`. */
export function wordSvg(text = 'MASLACH', options: SvgOptions = {}): WordSvg {
  const style = makeStyle(options.style as StyleOverrides | undefined)
  const w = layout(text)
  const pre = (options.id ?? 'ori').replace(/[^a-zA-Z0-9_-]/g, '')
  const id = (s: string) => `${pre}-${s}`
  const shadow = options.shadow ?? true
  const grain = options.grain ?? style.grain.on
  const defs: string[] = []
  // The prints: one gradient per slot, over the letters' height in user space
  for (const slot of ['lit', 'lit2', 'shade', 'shade2'] as const) {
    const t = slotTone(style, slot)
    defs.push(`<linearGradient id="${id(slot)}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${n(w.height)}"><stop offset="0" stop-color="${attr(t.top)}"/><stop offset="1" stop-color="${attr(t.bottom)}"/></linearGradient>`)
  }
  const key = (f: PlacedFace) => `${f.letter}-${f.index}`
  for (const f of w.faces) {
    if (!shaded(f) || !f.seam) continue
    const g = creaseGradient({ ...f.face, pts: f.abs }, { ...f.seam.crease, a: f.seam.a, b: f.seam.b }, style)
    defs.push(`<linearGradient id="${id(`crease-${key(f)}`)}" gradientUnits="userSpaceOnUse" x1="${n(g.from[0])}" y1="${n(g.from[1])}" x2="${n(g.to[0])}" y2="${n(g.to[1])}">${g.stops.map(s => `<stop offset="${n(s.offset)}" stop-color="#000" stop-opacity="${n(s.opacity)}"/>`).join('')}</linearGradient>`)
  }
  if (shadow) {
    // Figma's blur is twice the SVG standard deviation (02-look.md)
    const s = shadowAt(0, style)
    defs.push(`<filter id="${id('shadow')}" x="-10%" y="-20%" width="120%" height="160%"><feDropShadow dx="${n(s.ambient.offset[0])}" dy="${n(s.ambient.offset[1])}" stdDeviation="${n(s.ambient.blur / 2)}" flood-color="#000" flood-opacity="${n(s.ambient.opacity)}"/><feDropShadow dx="${n(s.contact.offset[0])}" dy="${n(s.contact.offset[1])}" stdDeviation="${n(s.contact.blur / 2)}" flood-color="#000" flood-opacity="${n(s.contact.opacity)}"/></filter>`)
  }
  if (grain) {
    defs.push(`<filter id="${id('grain')}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${n(style.grain.frequency)}" numOctaves="${Math.round(style.grain.octaves)}" stitchTiles="stitch" result="n"/><feColorMatrix type="saturate" values="0" in="n" result="g"/><feComponentTransfer in="g" result="a"><feFuncA type="table" tableValues="0 ${n(style.grain.strength)}"/></feComponentTransfer><feComposite in="a" in2="SourceAlpha" operator="in"/></filter>`)
    defs.push(`<clipPath id="${id('clip')}"><path d="${w.faces.map(f => `M${f.abs.map(p => `${n(p[0])} ${n(p[1])}`).join('L')}Z`).join('')}"/></clipPath>`)
  }
  // A crease is drawn as on shade where it is a shade face's seam (the seed's: the crease that face hung on)
  const onShade = (f: PlacedFace) => w.faces.some(g => g.letter === f.letter && shaded(g) && g.seam?.crease.id === f.crease?.id)
  const body: string[] = []
  body.push(`<g${shadow ? ` filter="url(#${id('shadow')})"` : ''}>${w.faces.map(f => `<polygon data-face="${attr(f.face.id)}" points="${points(f.abs)}" fill="url(#${id(f.slot)})"/>`).join('')}</g>`)
  body.push(`<g class="ori-crease-shade">${w.faces.filter(f => shaded(f) && f.seam).map(f => `<polygon points="${points(f.abs)}" fill="url(#${id(`crease-${key(f)}`)})"/>`).join('')}</g>`)
  body.push(`<g class="ori-creases" fill="none" stroke-width="${n(style.crease.width)}">${w.faces.filter(f => f.crease).map(f => `<line x1="${n(f.hingeAbs[0][0])}" y1="${n(f.hingeAbs[0][1])}" x2="${n(f.hingeAbs[1][0])}" y2="${n(f.hingeAbs[1][1])}" stroke="${attr(onShade(f) ? style.crease.onShade : style.crease.onLit)}" vector-effect="non-scaling-stroke"/>`).join('')}</g>`)
  if (grain) body.push(`<rect width="100%" height="100%" clip-path="url(#${id('clip')})" filter="url(#${id('grain')})" style="mix-blend-mode:multiply"/>`)
  const inner = `<defs>${defs.join('')}</defs>${body.join('')}`
  const viewBox = `0 0 ${n(w.width)} ${n(w.height)}`
  const label = options.label ?? ''
  const a11y = label ? ` role="img" aria-label="${attr(label)}"` : ' aria-hidden="true"'
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" class="ori-word" viewBox="${viewBox}" overflow="visible"${a11y}>${inner}</svg>`
  return { width: w.width, height: w.height, viewBox, inner, markup }
}
