// CSS colors for the WebGL driver: the CSS and SVG drivers take any CSS color for a tone (a
// `var()` of the host's tokens, a `color-mix()`), since the cascade resolves it; WebGL needs
// numbers. `resolveStyle` and `resolvePalette` turn every tone and palette color that `parseColor` cannot read into
// the color the browser computes for it at an element, so a theme or a palette set as custom
// properties paints the lit paper too. Read once, when the fold is built (a play).
import { style as makeStyle, type Style, type StyleOverrides, type Tone } from '../core/style.ts'
import type { Palette } from './scene.ts'

const READ = /^(#[0-9a-f]{3}([0-9a-f]{3})?|rgba?\([^)]*\)|color\(\s*srgb\s[^)]*\))$/i

/** The color `c` computes to at `el` (a probe child reads it), or `c` when it already is one the driver reads. */
export function cssColor(c: string, el: Element): string {
  if (READ.test(c.trim())) return c
  const doc = el.ownerDocument
  const win = doc.defaultView
  if (!win) throw new Error(`cannot resolve the color ${c} without a window`)
  const probe = doc.createElement('span')
  probe.style.display = 'none'
  probe.style.color = c
  el.appendChild(probe)
  const out = win.getComputedStyle(probe).color
  probe.remove()
  if (!out || !READ.test(out.trim())) throw new Error(`the color ${c} computes to ${out || 'nothing'} at the element, which the WebGL driver cannot read`)
  return out
}

const tone = (t: Tone, el: Element): Tone => ({ top: cssColor(t.top, el), bottom: cssColor(t.bottom, el) })
const paint = (v: Tone | string | undefined, el: Element) => v === undefined ? undefined : typeof v === 'string' ? cssColor(v, el) : tone(v, el)

/** The style with every tone resolved at `el` (see `cssColor`). */
export function resolveStyle(s: Style | StyleOverrides | undefined, el: Element): Style {
  const st = makeStyle(s as StyleOverrides | undefined)
  const { lit, shade, back } = st.tones
  return { ...st, tones: { lit: [tone(lit[0], el), tone(lit[1], el)], shade: [tone(shade[0], el), tone(shade[1], el)], back: tone(back, el) } }
}

/** The palette with every color resolved at `el`. */
export function resolvePalette(p: Palette, el: Element): Palette {
  return { lit: paint(p.lit, el), shade: paint(p.shade, el), back: paint(p.back, el) }
}
