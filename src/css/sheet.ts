// Sheet paint: the page's sheet (its paper: a pattern, an image or a plain color) as a
// background any element can wear so it shows exactly the paper under it, and keeps showing it
// as the page scrolls. That is what lets a block fold out of the background: lying folded, its
// back is the sheet at that spot (invisible), and it swings out of it (docs/study/02, cue 2).
//
//   paintSheet(sheet?, options?)  registers the page's sheet on <html>: --ori-sheet (the image,
//                                 none for a plain color), --ori-paper (the paper color under
//                                 it), --ori-vw/--ori-vh (the size the fixed sheet is drawn
//                                 at). With no argument, the folded example sheet in the page's
//                                 own colors (--ori-bg, --ori-ink, --ori-accent).
//   trackSheet(el, mode?)         keeps --ori-sx/--ori-sy on el pointed at the paper under it;
//                                 returns the untrack function
//   measureSheet()                re-reads every tracked element's position (after a layout
//                                 change)
//
// `mode` says how the sheet sits on the page: 'fixed' (the default) is a sheet drawn once at
// the viewport's size and fixed to it, so the paint follows the scroll; 'scroll' is a sheet that
// scrolls with the document (a body background), measured once. The CSS that wears the
// variables is .ori-paper in orkami.css; the driver's backs and grounds inherit them from the
// host. The module touches no DOM at import time, so it loads on a server.
import { foldedSheetSvg, type FoldedColors } from './sheets/folded.ts'

export type SheetMode = 'fixed' | 'scroll'

/** What the page's paper is: an SVG document, a CSS image value, or a plain color. */
export type SheetSpec =
  | { svg: string; color?: string }
  | { image: string; color?: string }
  | { color: string }
  | string

export interface PaintOptions {
  /** How the sheet sits on the page; the default is a sheet fixed to the viewport. */
  mode?: SheetMode
  /** The document to paint; the global one by default. */
  document?: Document
}

interface Tracked { el: HTMLElement; mode: SheetMode; x: number; y: number }

const tracked = new Set<Tracked>()
let mode: SheetMode = 'fixed'
let started = false
let frame = 0
let lastSheet: SheetSpec | undefined

const doc = (d?: Document) => d ?? (typeof document === 'undefined' ? undefined : document)

/** The hex color a custom property on <html> resolves to, else the fallback. */
function rootColor(root: HTMLElement, name: string, fallback: string): string {
  const v = root.ownerDocument.defaultView?.getComputedStyle(root).getPropertyValue(name).trim() ?? ''
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : fallback
}

/** The folded example sheet's colors from the page's tokens. */
export function pageColors(root: HTMLElement): FoldedColors {
  return {
    bg: rootColor(root, '--ori-bg', '#f3f4f1'),
    ink: rootColor(root, '--ori-ink', '#0e1726'),
    accent: rootColor(root, '--ori-accent', '#8a8f99'),
  }
}

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

/** The CSS image and paper color a spec resolves to. */
export function resolveSheet(spec: SheetSpec | undefined, colors: FoldedColors): { image: string; color: string } {
  if (spec === undefined) return { image: svgUrl(foldedSheetSvg(colors)), color: colors.bg }
  if (typeof spec === 'string') {
    const s = spec.trim()
    if (s.startsWith('<svg')) return { image: svgUrl(s), color: colors.bg }
    if (/^(url\(|[a-z-]+-gradient\(|image\()/i.test(s)) return { image: s, color: colors.bg }
    return { image: 'none', color: s }
  }
  if ('svg' in spec) return { image: svgUrl(spec.svg), color: spec.color ?? colors.bg }
  if ('image' in spec) return { image: spec.image, color: spec.color ?? colors.bg }
  return { image: 'none', color: spec.color }
}

/**
 * Registers the page's sheet. Call it once the page's colors are known, and again when they
 * change (it is also re-run on resize and on a color-scheme change).
 */
export function paintSheet(sheet?: SheetSpec, options: PaintOptions = {}): void {
  const d = doc(options.document)
  if (!d) return
  if (options.mode) mode = options.mode
  lastSheet = sheet
  start(d)
  const root = d.documentElement
  const { image, color } = resolveSheet(sheet, pageColors(root))
  root.style.setProperty('--ori-sheet', image)
  root.style.setProperty('--ori-paper', color)
  root.style.setProperty('--ori-vw', `${root.clientWidth}px`)
  root.style.setProperty('--ori-vh', `${root.clientHeight}px`)
  measureSheet()
}

/** Keeps `--ori-sx/--ori-sy` on `el` pointed at the paper under it; returns the untrack function. */
export function trackSheet(el: HTMLElement, sheetMode: SheetMode = mode): () => void {
  const d = el.ownerDocument
  if (!d || !d.defaultView) return () => {}
  start(d)
  const t: Tracked = { el, mode: sheetMode, x: 0, y: 0 }
  tracked.add(t)
  measure(t)
  placeOne(t)
  return () => {
    tracked.delete(t)
    el.style.removeProperty('--ori-sx')
    el.style.removeProperty('--ori-sy')
  }
}

/** Re-reads every tracked element's position (after a layout change) and places the paint. */
export function measureSheet(): void {
  tracked.forEach(measure)
  place()
}

/** The background offset that puts the sheet's origin under an element laid out at (x, y) in the document, at a scroll position. */
export function paintOffset(x: number, y: number, scrollX: number, scrollY: number, sheetMode: SheetMode): [number, number] {
  if (sheetMode === 'scroll') return [-x, -y]
  return [-(x - scrollX), -(y - scrollY)]
}

// Where the element is laid out, in document coordinates: the offset chain, which ignores
// transforms (the element is usually folded over when this runs)
function measure(t: Tracked): void {
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
}

function placeOne(t: Tracked): void {
  const win = t.el.ownerDocument.defaultView
  const [sx, sy] = paintOffset(t.x, t.y, win?.scrollX ?? 0, win?.scrollY ?? 0, t.mode)
  t.el.style.setProperty('--ori-sx', `${Math.round(sx)}px`)
  t.el.style.setProperty('--ori-sy', `${Math.round(sy)}px`)
}

function place(): void {
  frame = 0
  tracked.forEach(placeOne)
}

function start(d: Document): void {
  if (started) return
  const win = d.defaultView
  if (!win) return
  started = true
  win.addEventListener('scroll', () => {
    if (!frame && tracked.size) frame = win.requestAnimationFrame(place)
  }, { passive: true })
  win.addEventListener('resize', () => paintSheet(lastSheet, { document: d }))
  win.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => paintSheet(lastSheet, { document: d }))
  // The page settling (fonts, images, a panel opening) moves what is below it
  if (typeof win.ResizeObserver === 'function') new win.ResizeObserver(() => measureSheet()).observe(d.body)
}
