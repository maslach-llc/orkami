// Sheet paint: the page's sheet (sheet.ts) as a background image any element can wear so it
// shows exactly the paper under it, and stays showing it while the page scrolls. That is what
// lets a block fold out of the background: lying folded, its paper back is the sheet at that
// spot (invisible), and it swings out of it. Client only.
//
//   paintSheet()          renders the sheet with the live colors into --ori-sheet (and
//                         --ori-sheet-flip, the sheet turned 180 degrees) on <html>, with
//                         --ori-vw/--ori-vh, the size the fixed sheet is drawn at
//   trackSheet(el, mode)  keeps --ori-sx/--ori-sy on el pointed at the paper under it;
//                         returns the untrack function
//   measureSheet()        re-reads every tracked element's position (after a layout change)
//
// `mode` is how the painted element sits in the fold: 'face' is a flat element showing the sheet
// through its own box; 'top' | 'bottom' | 'left' | 'right' is a paper back, the [data-unfold]
// ::after or an .ori-paper child turned over (rotateY 180) inside a block folded 180 degrees
// on that hinge, so the paint is placed where the folded block lies, mirrored the way the two
// turns leave it (a horizontal hinge needs the flipped sheet, a vertical one the plain sheet).
// The CSS that wears the variables is .ori-paper in origami.css.
import { CREASE_INK, sheetSvg, tones, type Tone } from './sheet'

export type SheetMode = 'face' | 'top' | 'bottom' | 'left' | 'right'
interface Tracked { el: HTMLElement, mode: SheetMode, x: number, y: number, w: number, h: number }

const tracked = new Set<Tracked>()
let vw = 0, vh = 0
let started = false
let frame = 0

// --- colors: the same math as color-mix(in srgb, A p%, B), on the hex values main.css sets
function hex(c: string): [number, number, number] {
  const s = c.trim().replace('#', '')
  const n = s.length === 3 ? [...s].map(ch => ch + ch).join('') : s
  return [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16)) as [number, number, number]
}
function mix(a: string, b: string, pctA: number) {
  const A = hex(a), B = hex(b), k = pctA / 100
  return `#${A.map((v, i) => Math.round(v * k + B[i]! * (1 - k)).toString(16).padStart(2, '0')).join('')}`
}

export function paintSheet() {
  if (import.meta.server) return
  start()
  const root = document.documentElement
  const cs = getComputedStyle(root)
  const v = (name: string) => cs.getPropertyValue(name).trim()
  const bg = v('--bg') || '#f3f4f1'
  const into = (t: Tone) => tones[t].into === 'var(--ori-1)' ? (v('--ori-1') || '#5d72e3') : tones[t].into
  const fill = (t: Tone) => mix(bg, into(t), 100 - tones[t].pct)
  const [r, g, b] = hex(v('--text') || '#0e1726')
  const crease = `rgba(${r},${g},${b},${CREASE_INK})`
  const url = (flip: boolean) => `url("data:image/svg+xml,${encodeURIComponent(sheetSvg(fill, crease, flip))}")`
  vw = root.clientWidth
  vh = root.clientHeight
  root.style.setProperty('--ori-sheet', url(false))
  root.style.setProperty('--ori-sheet-flip', url(true))
  root.style.setProperty('--ori-vw', `${vw}px`)
  root.style.setProperty('--ori-vh', `${vh}px`)
  place()
}

export function trackSheet(el: HTMLElement, mode: SheetMode) {
  if (import.meta.server) return () => {}
  start()
  const t: Tracked = { el, mode, x: 0, y: 0, w: 0, h: 0 }
  tracked.add(t)
  measure(t)
  placeOne(t)
  return () => {
    tracked.delete(t)
    el.style.removeProperty('--ori-sx')
    el.style.removeProperty('--ori-sy')
  }
}

export function measureSheet() {
  tracked.forEach(measure)
  place()
}

// Where the element is laid out, in page coordinates: the offset chain, which ignores
// transforms (the element is usually folded over when this runs)
function measure(t: Tracked) {
  let x = 0, y = 0
  let e: HTMLElement | null = t.el
  while (e) {
    x += e.offsetLeft
    y += e.offsetTop
    const p = e.offsetParent as HTMLElement | null
    if (p) { x += p.clientLeft; y += p.clientTop }
    e = p
  }
  t.x = x
  t.y = y
  t.w = t.el.offsetWidth
  t.h = t.el.offsetHeight
}

function placeOne(t: Tracked) {
  const L = t.x - window.scrollX, T = t.y - window.scrollY
  let sx = -L, sy = -T
  switch (t.mode) {
    case 'top': sx = L + t.w - vw; sy = T - vh; break
    case 'bottom': sx = L + t.w - vw; sy = T + 2 * t.h - vh; break
    case 'left': sx = t.w - L; break
    case 'right': sx = -(L + t.w); break
  }
  t.el.style.setProperty('--ori-sx', `${Math.round(sx)}px`)
  t.el.style.setProperty('--ori-sy', `${Math.round(sy)}px`)
}

function place() {
  frame = 0
  tracked.forEach(placeOne)
}

function onScroll() {
  if (!frame && tracked.size) frame = requestAnimationFrame(place)
}

function start() {
  if (started) return
  started = true
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', () => { paintSheet(); measureSheet() })
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintSheet)
  // The page settling (fonts, images, a panel opening) moves what is below it
  new ResizeObserver(() => measureSheet()).observe(document.body)
}
