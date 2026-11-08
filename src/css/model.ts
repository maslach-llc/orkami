// The CSS driver for a model folded in steps (D19): one sheet of paper on its own, not a block
// of the page, so both sides are painted paper and nothing tracks the page's sheet. The faces
// never change across a model's steps (only angles do), so the flaps are built once along the
// fold's hinge tree, nested by parent as `mount` nests them, and every step after that is
// custom properties: `--ori-a` per flap from `modelPose`, `--ori-step` per flap from
// `modelStack` (the nearer keyframe's layer order, swapping half way through a step with the
// paper in the air), and `--ori-k` per side from the posed normal.
//
// Why the tone is written inline: orkami.css takes a side's tone from its own flap's angle,
// which is right for a face hinged once on the sheet. A model's face is turned through several
// hinges, so its normal is the product of the chain; the core has it (`modelPose`), and the
// inline `--ori-k` overrides the stylesheet's calc with the same Lambert the WebGL driver uses.
//
// Why the angles are driven per frame and never by CSS transitions: a step that drives a
// closure (the collapse) solves its coupled creases at every progress, which no per-crease
// transition can follow, and a model has no single end state to aim at anyway.
import type { Pt } from '../core/affine.ts'
import { treeCreases, type Crease, type CreaseId, type Face, type FaceId } from '../core/fold.ts'
import { shade } from '../core/light.ts'
import { creasesMade, keyAt, modelPose, modelStack, modelTime, type Model } from '../core/model.ts'
import { hingeAxis } from '../core/pose.ts'
import { slotTone, style as makeStyle, type Style, type StyleOverrides, type Tone } from '../core/style.ts'
import { hingeTree } from '../core/tree.ts'
import { grainUrl } from './driver.ts'

export interface ModelMountOptions {
  /** The look; overrides over the default style, or a full `Style`. */
  style?: Style | StyleOverrides
  /** The time to mount at, 0 (the flat sheet, the default) to `steps.length`. */
  at?: number
  /** The perspective distance in px; 2.2 times the width, never under 1000, by default. */
  perspective?: number
  /** A multiplier on every step's duration: 1 the model's own pace (the default), 4 a slow look. */
  pace?: number
  /** Called after every frame drawn, with s. */
  onFrame?: (s: number) => void
  /** The clock, ms; `performance.now` by default (a test passes a fake). */
  now?: () => number
}

export interface ModelHandle {
  readonly el: HTMLElement
  readonly model: Model
  readonly style: Style
  /** The current time, 0 the flat sheet to `steps.length`. */
  readonly s: number
  readonly playing: boolean
  /** Puts the model at s with no motion; cancels a play, resolving it. */
  set(s: number): void
  /** Plays from `from` (the current s) to `to` (the last step's end): at the steps' own pace times `pace`, or linearly over `duration` ms when given. Resolves on arrival, or when a later play, set or stop takes over. */
  play(from?: number, to?: number, duration?: number): Promise<void>
  /** Stops where the paper is, resolving the running play. */
  stop(): void
  /** Removes everything the driver added and leaves the element as it was. */
  destroy(): void
}

const SVG = 'http://www.w3.org/2000/svg'
const DEG = 180 / Math.PI
const num = (n: number) => String(+n.toFixed(4))
const px = (n: number) => `${num(n)}px`
const polygon = (pts: Pt[]) => `polygon(${pts.map(([x, y]) => `${px(x)} ${px(y)}`).join(', ')})`
const bounds = (pts: Pt[]) => {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/** One face as drawn: its flap (the container for the root), its two sides, and its crease hairlines by crease. */
interface Drawn {
  face: Face
  crease: Crease | null
  flap: HTMLElement | null
  front: HTMLElement
  back: HTMLElement
  lines: { id: CreaseId; el: Element }[]
}

/** Builds the model's paper inside `el` once, at `options.at`, and returns the handle that drives it. */
export function mountModel(el: HTMLElement, model: Model, options: ModelMountOptions = {}): ModelHandle {
  const doc = el.ownerDocument
  const win = doc.defaultView
  const style = makeStyle(options.style as StyleOverrides | undefined)
  const tree = hingeTree(model)
  const W = model.sheet.width, H = model.sheet.height
  const P = options.perspective ?? Math.max(1000, 2.2 * W)
  const pace = options.pace ?? 1
  const n = model.steps.length
  const now = options.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
  const reduced = !!win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const creases = new Map(treeCreases(model).map(c => [c.id, c]))
  const light = style.light

  // --- the host
  const hostProps: string[] = []
  const setHost = (name: string, value: string) => { el.style.setProperty(name, value); hostProps.push(name) }
  const cs = win?.getComputedStyle?.(el)
  if (!cs || cs.position === 'static' || cs.position === '') setHost('position', 'relative')
  const hadHost = el.classList.contains('ori-host')
  el.classList.add('ori-host')
  setHost('--ori-grain', style.grain.on ? grainUrl(style.grain) : 'none')

  const container = doc.createElement('div')
  container.className = 'ori-fold ori-model'
  container.setAttribute('aria-hidden', 'true')
  container.style.perspective = px(P)

  // The hairlines a face carries: every crease on its edge, the tree's and the closing ones, each
  // drawn on both faces it parts so the side's clip keeps half the stroke on each and the two
  // halves meet as one line
  const edgeCreases = (id: FaceId) => model.creases.filter(c => c.parent === id || c.child === id)

  /** A side: a box the size of the face's bounds clipped to it (driver.ts's sideFor, for the same Chromium compositor reason), the sheet-sized paper inside painted with the tone and the grain. */
  const sideFor = (face: Face, back: boolean, lines: Drawn['lines']): HTMLElement => {
    const side = doc.createElement('div')
    side.className = `ori-side ${back ? 'back' : 'front'}`
    side.dataset.face = face.id
    // The back is drawn mirrored and turned about the sheet's vertical midline by orkami.css
    const mirror = (p: Pt): Pt => back ? [W - p[0], p[1]] : p
    const pts = face.pts.map(mirror)
    const box = bounds(pts)
    const local = (p: Pt[]): Pt[] => p.map(([x, y]) => [x - box.x, y - box.y])
    side.style.left = px(box.x)
    side.style.top = px(box.y)
    side.style.width = px(box.w)
    side.style.height = px(box.h)
    side.style.clipPath = polygon(local(pts))
    if (back) side.style.transformOrigin = `${px(W / 2 - box.x)} ${px(H / 2 - box.y)}`
    const paper = doc.createElement('div')
    paper.className = 'ori-face ori-print'
    paper.style.left = px(-box.x)
    paper.style.top = px(-box.y)
    paper.style.width = px(W)
    paper.style.height = px(H)
    const tone: Tone = back ? style.tones.back : slotTone(style, face.slot)
    paper.style.backgroundImage = `var(--ori-grain), linear-gradient(${tone.top}, ${tone.bottom})`
    paper.style.backgroundSize = '96px 96px, 100% 100%'
    side.append(paper)
    const edges = edgeCreases(face.id)
    if (edges.length) {
      const svg = doc.createElementNS(SVG, 'svg') as unknown as HTMLElement
      svg.setAttribute('class', 'ori-model-creases')
      svg.setAttribute('viewBox', `0 0 ${num(W)} ${num(H)}`)
      svg.setAttribute('preserveAspectRatio', 'none')
      for (const c of edges) {
        const [a, b] = [mirror(c.a), mirror(c.b)]
        const line = doc.createElementNS(SVG, 'line')
        line.setAttribute('x1', num(a[0])); line.setAttribute('y1', num(a[1]))
        line.setAttribute('x2', num(b[0])); line.setAttribute('y2', num(b[1]))
        line.setAttribute('stroke', style.crease.onLit)
        line.setAttribute('stroke-width', String(style.crease.width))
        line.setAttribute('vector-effect', 'non-scaling-stroke')
        line.setAttribute('data-crease', c.id)
        svg.append(line as unknown as HTMLElement)
        lines.push({ id: c.id, el: line as unknown as Element })
      }
      paper.append(svg)
    }
    return side
  }

  // --- the paper, built once: the root's two sides in the container, a flap per other face
  // nested in its parent's flap
  const drawn: Drawn[] = []
  const flapEls = new Map<FaceId, HTMLElement>()
  for (const id of tree.order) {
    const face = model.faces.find(f => f.id === id)!
    if (face.page) continue
    const lines: Drawn['lines'] = []
    const front = sideFor(face, false, lines), back = sideFor(face, true, lines)
    if (id === model.root) {
      container.append(front, back)
      drawn.push({ face, crease: null, flap: null, front, back, lines })
      continue
    }
    const crease = creases.get(tree.hinge[id]!)!
    const axis = hingeAxis(model, crease)
    const flap = doc.createElement('div')
    flap.className = 'ori-flap'
    flap.dataset.face = id
    flap.style.transformOrigin = `${px(axis.point[0])} ${px(axis.point[1])}`
    flap.style.setProperty('--ori-ux', num(axis.dir[0]))
    flap.style.setProperty('--ori-uy', num(axis.dir[1]))
    flap.append(front, back)
    const parent = tree.parent[id]
    ;(parent != null && flapEls.get(parent) || container).append(flap)
    flapEls.set(id, flap)
    drawn.push({ face, crease, flap, front, back, lines })
  }
  el.append(container)

  // --- a frame: angles, layer steps, tones and the creases made so far, all from the core
  let s = 0
  let shownKey = -1
  const draw = (at: number) => {
    s = Math.min(n, Math.max(0, at))
    const pose = modelPose(model, s, tree)
    const stack = modelStack(model, s)
    const key = keyAt(model, s)
    const made = key === shownKey ? undefined : creasesMade(model, key)
    shownKey = key
    for (const d of drawn) {
      if (d.flap && d.crease) {
        d.flap.style.setProperty('--ori-a', `${num((pose.angles[d.crease.id] ?? 0) * DEG)}deg`)
        d.flap.style.setProperty('--ori-step', String(stack.step[d.crease.id] ?? 0))
      }
      const nrm = pose.faces[d.face.id]!.normal
      d.front.style.setProperty('--ori-k', num(shade(nrm, light.direction, light.ambient, light.diffuse)))
      d.back.style.setProperty('--ori-k', num(shade([-nrm[0], -nrm[1], -nrm[2]], light.direction, light.ambient, light.diffuse)))
      if (made) for (const l of d.lines) l.el.setAttribute('visibility', made.has(l.id) ? 'visible' : 'hidden')
    }
    el.dataset.step = String(Math.ceil(s))
    el.dataset.key = String(key)
    options.onFrame?.(s)
  }

  // --- time
  let playing = false
  let raf = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: (() => void) | undefined
  const request = (fn: () => void) => {
    if (win?.requestAnimationFrame) raf = win.requestAnimationFrame(fn)
    else timer = setTimeout(fn, 16)
  }
  const cancel = () => {
    if (raf && win?.cancelAnimationFrame) win.cancelAnimationFrame(raf)
    if (timer) clearTimeout(timer)
    raf = 0
    timer = undefined
    playing = false
    const done = pending
    pending = undefined
    done?.()
  }

  const set = (at: number) => { cancel(); draw(at) }

  const play = (from = s, to = n, duration?: number): Promise<void> => {
    cancel()
    const a = Math.min(n, Math.max(0, from)), b = Math.min(n, Math.max(0, to))
    if (reduced || a === b) { draw(b); return Promise.resolve() }
    draw(a)
    playing = true
    const t0 = now()
    const promise = new Promise<void>((resolve) => { pending = resolve })
    const tick = () => {
      const ms = Math.max(0, now() - t0)
      const at = duration !== undefined
        ? (ms >= duration ? b : a + (b - a) * ms / duration)
        : modelTime(model, a, b, ms / pace)
      draw(at)
      if (s === b) { cancel(); return }
      request(tick)
    }
    request(tick)
    return promise
  }

  const destroy = () => {
    cancel()
    container.remove()
    for (const name of new Set(hostProps)) el.style.removeProperty(name)
    if (!hadHost) el.classList.remove('ori-host')
    delete el.dataset.step
    delete el.dataset.key
  }

  draw(options.at ?? 0)

  return {
    el,
    model,
    style,
    get s() { return s },
    get playing() { return playing },
    set,
    play,
    stop: cancel,
    destroy,
  }
}
