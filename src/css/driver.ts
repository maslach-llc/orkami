// The CSS driver: a fold as flaps in the DOM. `mount(el, fold)` builds one `.ori-flap` per face
// inside the element from the hinge tree, nested by parent so a crease opening carries every
// face folded beyond it (D3), each flap a front and a back clipped to the face's polygon, the
// hinge as `transform-origin` and a `rotate3d` axis from the core's `hingeAxis`, the angle on
// the registered `--ori-a` property (orkami.css) with one transition per flap from the
// schedule. The back wears the page's sheet under `flatBack` (02, cue 2), so a folded block is
// the background until it moves; the tone of each side follows the one light in CSS (cue 1);
// the shadow a lifted flap casts is a layer in its parent's plane updated per frame from the
// pose (cue 3); the creases stay as hairlines (cue 6). Every number comes from the core: the
// driver builds no geometry of its own.
//
// Where the content goes. The element's own content is the print of one face, the content
// face: the root, or, when the root is the page (a lift), the page's one child, in which case
// the element itself is that flap and turns on the hinge; when several faces hang on the page
// (a word, D13) there is no content face: every face is a flap, no ground is drawn (the page is
// the ground) and the element's own content (the flat word) shows at the landing. The other faces' fronts show the
// element's background; the ground under them is the sheet until the paper lands, and at the
// landing the flaps step aside so the element's content shows flat (doc 06 prints content on
// every face). A face with a `slot` (a glyph) is painted paper: its print is the style's tone.
import { compose, invert, toCss, type Affine, type Pt } from '../core/affine.ts'
import { centroid, face as faceOf, seamOf, sign, treeCreases, type Crease, type Face, type FaceId, type Fold } from '../core/fold.ts'
import { flatBack, hingeAxis, pose } from '../core/pose.ts'
import { together, transitionable, type Schedule } from '../core/schedule.ts'
import { rotation, transform } from '../core/space.ts'
import { stackOrder } from '../core/stack.ts'
import { creaseGradient, penumbra, slotTone, style as makeStyle, type Style, type StyleOverrides } from '../core/style.ts'
import { hingeTree, reach } from '../core/tree.ts'
import { trackSheet, type SheetMode } from './sheet.ts'

export type Drive = 'css' | 'frame' | 'auto'

export interface MountOptions {
  /** The look; overrides over the default style, or a full `Style`. */
  style?: Style | StyleOverrides
  /** The schedule; the fold's own, else every crease together. */
  schedule?: Schedule
  /** How the angles move: CSS transitions on `--ori-a` (needs `@property`), a `requestAnimationFrame` loop, or auto (CSS when the browser registers properties and the fold has no closure to solve per frame). */
  drive?: Drive
  /** The state to mount in: 0 closed (the default), 1 flat and landed. */
  at?: number
  /** Milliseconds added before the schedule starts (a stagger over siblings). */
  delay?: number
  /** Whether the backs and grounds track the page's sheet (`trackSheet`); off for a block that is not part of the page. */
  sheet?: boolean | SheetMode
  /** The perspective distance in px; 2.2 times the width, never under 1000, by default. */
  perspective?: number
}

export type State = 'closed' | 'opening' | 'open' | 'closing' | 'still'

export interface Handle {
  readonly el: HTMLElement
  readonly fold: Fold
  readonly style: Style
  readonly schedule: Schedule
  readonly drive: Exclude<Drive, 'auto'>
  /** The current time, 0 closed to 1 flat. */
  readonly t: number
  readonly state: State
  /** Unfolds on the schedule; resolves when the paper has landed. */
  open(): Promise<void>
  /** Folds back on the schedule reversed; resolves when closed. */
  close(): Promise<void>
  /** Puts the fold at t with no motion (a slider, a scroll, a loop driving its own clock). */
  set(t: number): void
  /** Removes everything the driver added and leaves the element as it was. */
  destroy(): void
  /** Resolves the first time the paper lies flat. */
  readonly landed: Promise<void>
}

const SVG = 'http://www.w3.org/2000/svg'
const DEG = 180 / Math.PI
const num = (n: number) => String(+n.toFixed(4))
const px = (n: number) => `${num(n)}px`
const polygon = (pts: Pt[]) => `polygon(${pts.map(([x, y]) => `${px(x)} ${px(y)}`).join(', ')})`
const mirrorX = (w: number) => (pts: Pt[]): Pt[] => pts.map(([x, y]) => [w - x, y])
/** The bounding box of a polygon. */
const bounds = (pts: Pt[]) => {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/** A CSS linear-gradient from point `from` to point `to` in a w x h box, stops at fractions of that run, each a black of the given alpha (a number or a CSS value). */
function gradient(from: Pt, to: Pt, stops: { offset: number; alpha: string }[], w: number, h: number): string {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  const run = Math.hypot(dx, dy)
  if (run < 1e-9) return 'none'
  const ux = dx / run, uy = dy / run
  const angle = Math.atan2(ux, -uy) * DEG
  const length = Math.abs(w * ux) + Math.abs(h * uy)
  const along = (p: Pt) => (p[0] - w / 2) * ux + (p[1] - h / 2) * uy + length / 2
  const start = along(from)
  return `linear-gradient(${num(angle)}deg, ${stops.map(s => `rgb(0 0 0 / ${s.alpha}) ${px(start + s.offset * run)}`).join(', ')})`
}

/** The grain tile at the style's values, as a data: URL (02, cue 7). */
export function grainUrl(g: Style['grain'], strength = g.strength): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${g.frequency}' numOctaves='${g.octaves}' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 ${strength}'/></feComponentTransfer></filter><rect width='96' height='96' filter='url(%23n)'/></svg>`
  return `url("data:image/svg+xml,${svg.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}")`
}

/** One flap: a face hinged on its crease, its sides, its shadow in the parent's plane. */
interface Flap {
  face: Face
  crease: Crease
  /** The flap element: the host itself for the content face of a lift. */
  el: HTMLElement
  axis: { point: Pt; dir: Pt }
  shadows: { wrap: HTMLElement; shape: HTMLElement }[]
}

interface Deferred { promise: Promise<void>; resolve: () => void }
const deferred = (): Deferred => {
  let resolve!: () => void
  const promise = new Promise<void>(r => { resolve = r })
  return { promise, resolve }
}

/** The light's direction in a face's flat frame, from its pose matrix (column major, rigid): the page's light turned back by the face's rotation. */
function lightIn(matrix: number[] | undefined, light: readonly [number, number, number]): [number, number, number] {
  if (!matrix) return [light[0], light[1], light[2]]
  const m = matrix
  // R^T L: the rotation's columns dotted with L
  return [
    m[0]! * light[0] + m[1]! * light[1] + m[2]! * light[2],
    m[4]! * light[0] + m[5]! * light[1] + m[6]! * light[2],
    m[8]! * light[0] + m[9]! * light[1] + m[10]! * light[2],
  ]
}

/**
 * The shadow a flap casts on its parent's plane (D15, contact hardening): its outline is the
 * face projected along the light (so it meets the crease, where the flap does), a contact layer
 * sharp and dark at the crease that fades out over the first `2 * fade` px of gap, and an ambient
 * layer as soft and pale as `penumbra()` makes it at the flap's middle. The shape is drawn in its
 * own bounding box (`box`, in the parent's flat frame; `outline` and the masks are in the box),
 * so no clip sits far from its box's origin and nothing past the sheet is cut. Undefined when
 * the face lies in its parent's plane or the parent faces away from the light.
 */
export function castShadow(pts3: number[][], axis: { point: Pt; dir: Pt }, light: readonly [number, number, number], style: Style): {
  box: { x: number; y: number; w: number; h: number }
  outline: Pt[]
  contact: { opacity: number; sigma: number; mask: string }
  ambient: { opacity: number; sigma: number; mask: string }
} | undefined {
  const [lx, ly, lz] = light
  const h = Math.max(0, ...pts3.map(v => v[2]!))
  if (lz < 0.05 || h <= 0) return undefined
  // A face in the sheet casts nothing at rest: the shadow comes in over the first `fade` px of lift
  const fade = style.shadows.contact.fade
  const lift = Math.min(1, h / fade)
  const cast: Pt[] = pts3.map(v => [v[0]! - v[2]! * lx / lz, v[1]! - v[2]! * ly / lz])
  const gap = Math.max(...pts3.map(v => Math.max(0, v[2]!) / lz))
  // The direction away from the crease, toward the shadow's far side, and how far that is
  let n: Pt = [-axis.dir[1], axis.dir[0]]
  const c = centroid(cast)
  if ((c[0] - axis.point[0]) * n[0] + (c[1] - axis.point[1]) * n[1] < 0) n = [-n[0], -n[1]]
  const far = Math.max(1, ...cast.map(q => (q[0] - axis.point[0]) * n[0] + (q[1] - axis.point[1]) * n[1]))
  const b = bounds(cast)
  const box = { x: b.x, y: b.y, w: Math.max(1, b.w), h: Math.max(1, b.h) }
  const outline: Pt[] = cast.map(q => [q[0] - box.x, q[1] - box.y])
  const from: Pt = [axis.point[0] - box.x, axis.point[1] - box.y]
  const to: Pt = [from[0] + n[0] * far, from[1] + n[1] * far]
  const reach = Math.min(1, 2 * fade / Math.max(gap, 1e-6))
  const mid = penumbra(gap / 2, style)
  const s = style.shadows
  return {
    box,
    outline,
    contact: {
      opacity: (s.contact.opacity + s.ambient.opacity / 2) * lift,
      sigma: s.contact.blur / 2,
      mask: gradient(from, to, [{ offset: 0, alpha: '1' }, { offset: reach, alpha: '0' }], box.w, box.h),
    },
    ambient: {
      opacity: s.ambient.opacity * mid.strength * lift,
      sigma: mid.sigma,
      mask: gradient(from, to, [{ offset: 0, alpha: '1' }, { offset: 1, alpha: num(0.6 * penumbra(gap, style).strength) }], box.w, box.h),
    },
  }
}

/** Builds the flaps of `fold` inside `el` and returns the handle that drives them. `fold` may be a factory taking the element's size. */
export function mount(el: HTMLElement, foldOrFactory: Fold | ((w: number, h: number) => Fold), options: MountOptions = {}): Handle {
  const doc = el.ownerDocument
  const win = doc.defaultView
  const fold = typeof foldOrFactory === 'function' ? foldOrFactory(el.offsetWidth, el.offsetHeight) : foldOrFactory
  const style = makeStyle(options.style as StyleOverrides | undefined)
  const schedule = options.schedule ?? fold.schedule ?? together(fold)
  const tree = hingeTree(fold)
  const stack = stackOrder(fold, tree)
  const creases = new Map(treeCreases(fold).map(c => [c.id, c]))
  const W = fold.sheet.width, H = fold.sheet.height
  const P = options.perspective ?? Math.max(1000, 2.2 * W)
  const delay = options.delay ?? 0
  const total = schedule.total
  const reduced = !!win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const drive: Exclude<Drive, 'auto'> = options.drive && options.drive !== 'auto'
    ? options.drive
    : (fold.closures?.length ?? 0) === 0 && transitionable(schedule) && typeof win?.CSS?.registerProperty === 'function' ? 'css' : 'frame'

  // The content face: the root; or, on a page with one face hinged on it (a lift), that face,
  // which is then the element itself; or, on a page with several (a word, D13), none: every face
  // is a flap of painted paper, and the element's own content is what shows once they land
  const rootFace = faceOf(fold, fold.root)
  const onPage = !!rootFace.page
  const hung = tree.children[fold.root]?.length ?? 0
  if (onPage && hung === 0) throw new Error('a fold rooted on the page needs a face hinged on it')
  const lifted = onPage && hung === 1
  const contentId: FaceId | undefined = lifted ? creases.get(tree.children[fold.root]![0]!)!.child : onPage ? undefined : fold.root

  // --- the host
  const hostProps: string[] = []
  const setHost = (name: string, value: string) => { el.style.setProperty(name, value); hostProps.push(name) }
  const cs = win?.getComputedStyle?.(el)
  if (!cs || cs.position === 'static' || cs.position === '') setHost('position', 'relative')
  el.classList.add('ori-host')
  const bare = !cs || ((cs.backgroundImage === 'none' || cs.backgroundImage === '') && (cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent' || cs.backgroundColor === ''))
  const background = (side: HTMLElement) => {
    if (bare || !cs) { side.classList.add('ori-paper'); return }
    side.style.backgroundColor = cs.backgroundColor
    side.style.backgroundImage = cs.backgroundImage
    side.style.backgroundSize = cs.backgroundSize
    side.style.backgroundPosition = cs.backgroundPosition
    side.style.backgroundRepeat = cs.backgroundRepeat
  }
  setHost('--ori-total', `${num(total)}ms`)
  setHost('--ori-delay', `${num(delay)}ms`)
  setHost('--ori-lx', num(style.light.direction[0]))
  setHost('--ori-ly', num(style.light.direction[1]))
  setHost('--ori-lz', num(style.light.direction[2]))
  setHost('--ori-ka', num(style.light.ambient))
  setHost('--ori-kd', num(style.light.diffuse))
  setHost('--ori-occlusion', num(style.crease.gradient.occlusion))
  if (style.grain.on) setHost('--ori-grain', grainUrl(style.grain))
  else setHost('--ori-grain', 'none')

  const container = doc.createElement('div')
  container.className = 'ori-fold'
  container.setAttribute('aria-hidden', 'true')
  if (!lifted) container.style.perspective = px(P)

  // --- paper: the sides of a face. A side is a box the size of its face's bounds, clipped to
  // the face in its own coordinates, with the sheet-sized paper inside it shifted back into the
  // sheet's frame. A side as big as the sheet with the face clipped out of it is the same
  // picture, but Chromium's software compositor (no GPU: headless, a blocklisted driver) culls
  // a clip-path far from the box's origin on a 3D-transformed layer, and the blintz lost three
  // of its four corners mid-unfold; the face-sized box is also less to raster.
  const sideFor = (face: Face, crease: Crease | null, back: boolean): HTMLElement => {
    const side = doc.createElement('div')
    side.className = `ori-side ${back ? 'back' : 'front'}`
    side.dataset.face = face.id
    const pts = back ? mirrorX(W)(face.pts) : face.pts
    const full = face.pts.length === 4 && face.pts.every(([x, y]) => (x === 0 || x === W) && (y === 0 || y === H))
    const box = full ? { x: 0, y: 0, w: W, h: H } : bounds(pts)
    const local = (p: Pt[]): Pt[] => p.map(([x, y]) => [x - box.x, y - box.y])
    if (!full) {
      side.style.left = px(box.x)
      side.style.top = px(box.y)
      side.style.width = px(box.w)
      side.style.height = px(box.h)
      side.style.clipPath = polygon(local(pts))
      // The back turns about the sheet's vertical midline, as a sheet-sized side would
      if (back) side.style.transformOrigin = `${px(W / 2 - box.x)} ${px(H / 2 - box.y)}`
    }
    const paper = doc.createElement('div')
    paper.className = 'ori-face'
    paper.style.left = px(-box.x)
    paper.style.top = px(-box.y)
    paper.style.width = px(W)
    paper.style.height = px(H)
    side.append(paper)
    const layers: string[] = []
    if (back) {
      // The sheet under the face, placed where the face lies folded flat: the ink carries the
      // sheet in page coordinates under the inverse of flatBack, mirrored for the turned side
      const ink = doc.createElement('div')
      ink.className = 'ori-ink ori-paper'
      const S = 2 * Math.hypot(W, H) + 2
      const ox = (W - S) / 2, oy = (H - S) / 2
      ink.style.left = px(ox)
      ink.style.top = px(oy)
      ink.style.width = px(S)
      ink.style.height = px(S)
      const map: Affine = crease ? compose([-1, 0, 0, 1, W, 0], invert(flatBack(fold, crease.id, tree))) : [-1, 0, 0, 1, W, 0]
      ink.style.transformOrigin = `${px(-ox)} ${px(-oy)}`
      ink.style.transform = toCss(map)
      ink.style.backgroundPosition = `calc(var(--ori-sx, 0px) - ${px(ox)}) calc(var(--ori-sy, 0px) - ${px(oy)})`
      paper.append(ink)
    } else if (face.slot) {
      const tone = slotTone(style, face.slot)
      layers.push(`linear-gradient(${tone.top}, ${tone.bottom})`)
      const seam = seamOf(fold, face.id)
      if ((face.slot === 'shade' || face.slot === 'shade2') && seam) {
        const g = creaseGradient(face, seam, style)
        layers.push(gradient(g.from, g.to, g.stops.map(s => ({ offset: s.offset, alpha: num(s.opacity) })), W, H))
      }
    } else {
      background(paper)
    }
    if (crease && (crease.assignment === 'V') === !back) {
      // The crease going into shadow as the fold closes (02, cue 8, the dynamic part): on the
      // side the fold closes on, the fronts for a valley, the backs for a mountain; the outside
      // stays clean, so a block lying closed on the page is still the page. It rides the
      // side's ::after, so it is drawn in the side's own box
      const mid: Pt = [(crease.a[0] + crease.b[0]) / 2, (crease.a[1] + crease.b[1]) / 2]
      const c = centroid(face.pts)
      const to: Pt = [mid[0] + (c[0] - mid[0]) * 0.6, mid[1] + (c[1] - mid[1]) * 0.6]
      const m = back ? mirrorX(W) : (p: Pt[]) => p
      const [f, t] = local(m([mid, to]))
      side.style.setProperty('--ori-crease', gradient(f!, t!, [{ offset: 0, alpha: 'var(--ori-occ)' }, { offset: 1, alpha: '0' }], box.w, box.h))
    }
    if (layers.length) {
      paper.style.backgroundImage = ['var(--ori-grain)', ...layers].join(', ')
      paper.style.backgroundSize = ['96px 96px', ...layers.map(() => '100% 100%')].join(', ')
      paper.classList.add('ori-print')
    }
    return side
  }

  // --- the flaps, nested by parent
  const flaps: Flap[] = []
  const flapEls = new Map<FaceId, HTMLElement>()
  const parentEl = (id: FaceId): HTMLElement => {
    const p = tree.parent[id]
    if (p == null || p === contentId || p === fold.root && onPage) return container
    return flapEls.get(p) ?? container
  }
  const axisOf = (c: Crease) => {
    const a = hingeAxis(fold, c)
    return { point: [a.point[0], a.point[1]] as Pt, dir: [a.dir[0], a.dir[1]] as Pt }
  }
  const closedDeg = (c: Crease) => sign(c.assignment) * c.closed * DEG
  const shadowsFor = (into: HTMLElement, c: Crease, axis: { point: Pt; dir: Pt }): Flap['shadows'] => {
    if (!style.shadows.on) return []
    const layers = reach(fold, c.id, tree) < 40 ? ['contact'] : ['contact', 'ambient']
    return layers.map((name) => {
      const wrap = doc.createElement('div')
      wrap.className = `ori-shadow ${name}`
      wrap.style.transformOrigin = `${px(axis.point[0])} ${px(axis.point[1])}`
      const shape = doc.createElement('div')
      shape.className = 'ori-shadow-shape'
      wrap.append(shape)
      into.append(wrap)
      return { wrap, shape }
    })
  }
  const hingeProps = (target: HTMLElement, c: Crease, axis: { point: Pt; dir: Pt }) => {
    target.style.setProperty('--ori-ux', num(axis.dir[0]))
    target.style.setProperty('--ori-uy', num(axis.dir[1]))
    target.style.setProperty('--ori-step', String(stack.step[c.id] ?? 0))
    target.style.setProperty('--ori-closed', `${num(closedDeg(c))}deg`)
    target.style.setProperty('--ori-a', `${num(closedDeg(c))}deg`)
    const entry = schedule.creases[c.id] ?? { start: 0, duration: 1 }
    target.style.setProperty('--ori-start', `${num(entry.start * total)}ms`)
    target.style.setProperty('--ori-end', `${num((1 - entry.start - entry.duration) * total)}ms`)
    target.style.setProperty('--ori-dur', `${num(entry.duration * total)}ms`)
  }

  for (const id of tree.order) {
    const face = faceOf(fold, id)
    if (face.page || id === fold.root) continue
    const crease = creases.get(tree.hinge[id]!)!
    const axis = axisOf(crease)
    if (id === contentId) {
      // The element is the flap: it turns on the hinge about its own center's perspective
      el.classList.add('ori-lifted')
      setHost('--ori-p', px(P))
      setHost('--ori-hx', px(axis.point[0] - W / 2))
      setHost('--ori-hy', px(axis.point[1] - H / 2))
      setHost('transform-origin', `${px(W / 2)} ${px(H / 2)}`)
      hingeProps(el, crease, axis)
      hostProps.push('--ori-ux', '--ori-uy', '--ori-step', '--ori-closed', '--ori-a', '--ori-start', '--ori-end', '--ori-dur')
      if (bare) el.classList.add('ori-paper')
      const shade = doc.createElement('div')
      shade.className = 'ori-shade'
      container.append(shade)
      container.append(sideFor(face, crease, true))
      flaps.push({ face, crease, el, axis, shadows: shadowsFor(container, crease, axis) })
      flapEls.set(id, container)
      continue
    }
    const flap = doc.createElement('div')
    flap.className = 'ori-flap'
    flap.dataset.face = id
    flap.style.transformOrigin = `${px(axis.point[0])} ${px(axis.point[1])}`
    hingeProps(flap, crease, axis)
    const shadows = shadowsFor(flap, crease, axis)
    flap.append(sideFor(face, crease, false), sideFor(face, crease, true))
    parentEl(id).append(flap)
    flapEls.set(id, flap)
    flaps.push({ face, crease, el: flap, axis, shadows })
  }

  // --- the ground: the sheet where a face is not yet, the root's own front over the element
  // (its content shows at the landing), and the creases that stay
  const grounds: HTMLElement[] = []
  if (!onPage) {
    // A face joined to the content face by flat creases only never leaves the sheet: its flap
    // lies exactly where its ground would (layer step 0), and the two would fight for depth, the
    // ground winning (the waterbomb's T2 drew as a hole). It needs no ground: its front is the sheet.
    const stays = (id: FaceId): boolean => {
      if (id === contentId) return true
      const h = tree.hinge[id], p = tree.parent[id]
      if (h == null || p == null) return false
      return creases.get(h)!.closed === 0 && stays(p)
    }
    for (const face of fold.faces) {
      if (face.id === contentId || face.page || stays(face.id)) continue
      const g = doc.createElement('div')
      g.className = 'ori-ground ori-paper'
      g.style.clipPath = polygon(face.pts)
      grounds.push(g)
    }
    const root = sideFor(rootFace, null, false)
    root.classList.add('ori-root')
    container.prepend(...grounds, root)
  }
  /** While the paper is folded the element's own box paints nothing: the root front and the ground are it. */
  const cover = (on: boolean) => {
    if (onPage) return
    if (on) {
      el.style.setProperty('background-color', 'transparent')
      el.style.setProperty('background-image', 'none')
    } else {
      el.style.removeProperty('background-color')
      el.style.removeProperty('background-image')
    }
  }
  const svg = doc.createElementNS(SVG, 'svg') as unknown as HTMLElement
  svg.setAttribute('class', 'ori-creases')
  svg.setAttribute('viewBox', `0 0 ${num(W)} ${num(H)}`)
  svg.setAttribute('preserveAspectRatio', 'none')
  for (const c of creases.values()) {
    if (faceOf(fold, c.parent).page && c.child !== contentId) continue
    const line = doc.createElementNS(SVG, 'line')
    line.setAttribute('x1', num(c.a[0])); line.setAttribute('y1', num(c.a[1]))
    line.setAttribute('x2', num(c.b[0])); line.setAttribute('y2', num(c.b[1]))
    line.setAttribute('stroke', style.crease.onLit)
    line.setAttribute('stroke-width', String(style.crease.width))
    line.setAttribute('vector-effect', 'non-scaling-stroke')
    svg.append(line)
  }
  container.append(svg)
  el.append(container)

  const untrack = options.sheet === false ? () => {} : trackSheet(el, typeof options.sheet === 'string' ? options.sheet : undefined)

  // --- time
  let t = 0
  let state: State = 'closed'
  let raf = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Deferred | undefined
  const firstLanding = deferred()
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const request = (fn: () => void) => {
    if (win?.requestAnimationFrame) raf = win.requestAnimationFrame(fn)
    else timer = setTimeout(fn, 16)
  }
  const cancel = () => {
    if (raf && win?.cancelAnimationFrame) win.cancelAnimationFrame(raf)
    if (timer) clearTimeout(timer)
    raf = 0
    timer = undefined
  }
  const flush = () => { void el.offsetWidth }

  /** The per-frame paint: the shadows in the parent's plane from the pose (and the angles, when the clock drives them). */
  const paint = (at: number, angles: boolean) => {
    const p = pose(fold, at, schedule)
    for (const f of flaps) {
      const angle = p.angles[f.crease.id] ?? 0
      if (angles) f.el.style.setProperty('--ori-a', `${num(angle * DEG)}deg`)
      if (f.shadows.length === 0) continue
      const r = rotation([f.axis.point[0], f.axis.point[1], 0], [f.axis.dir[0], f.axis.dir[1], 0], angle)
      const pts3 = f.face.pts.map(([x, y]) => transform(r, [x, y, 0]))
      const cast = castShadow(pts3, f.axis, lightIn(p.faces[f.crease.parent]?.matrix, style.light.direction), style)
      f.shadows.forEach(({ wrap, shape }, i) => {
        const l = cast?.[i === 0 ? 'contact' : 'ambient']
        wrap.style.opacity = num(l?.opacity ?? 0)
        if (!l || !cast) return
        wrap.style.filter = `blur(${px(l.sigma)})`
        shape.style.left = px(cast.box.x)
        shape.style.top = px(cast.box.y)
        shape.style.width = px(cast.box.w)
        shape.style.height = px(cast.box.h)
        shape.style.clipPath = polygon(cast.outline)
        shape.style.setProperty('mask-image', l.mask)
        shape.style.setProperty('-webkit-mask-image', l.mask)
      })
    }
  }

  const classes = (open: boolean, landed: boolean) => {
    el.classList.toggle('is-open', open)
    el.classList.toggle('is-landed', landed)
    cover(!landed)
  }
  const land = () => {
    t = 1
    state = 'open'
    classes(true, true)
    paint(1, drive === 'frame')
    firstLanding.resolve()
  }
  const settle = (toT: 0 | 1) => {
    cancel()
    if (toT === 1) land()
    else { t = 0; state = 'closed'; classes(false, false); paint(0, drive === 'frame') }
    const d = pending
    pending = undefined
    d?.resolve()
  }

  /** Runs the clock from the current t toward `toT`, painting each frame; the angles ride CSS transitions or the clock. */
  const run = (toT: 0 | 1): Promise<void> => {
    cancel()
    pending?.resolve()
    pending = deferred()
    const from = t
    const dir = toT === 1 ? 1 : -1
    let t0 = now()
    // On CSS transitions the angles start at the browser's next style pass, which on a fresh mount
    // can be a long frame after this call: the clock (and the shadows it paints) takes its start
    // from the transitions' own, so the shadows do not run ahead of the paper. Only for a whole
    // run: a reversal mid-way keeps the call's time.
    let synced = drive !== 'css' || (from !== 0 && from !== 1)
    const sync = () => {
      for (const f of flaps) {
        const a = f.el.getAnimations?.().find(x => (x as CSSTransition).transitionProperty === '--ori-a')
        if (!a) continue
        if (typeof a.startTime === 'number') { t0 = a.startTime; synced = true }
        return
      }
    }
    const tick = () => {
      if (!synced) sync()
      const elapsed = Math.max(0, now() - t0 - delay)
      t = Math.min(1, Math.max(0, from + dir * elapsed / total))
      paint(t, drive === 'frame')
      if ((dir > 0 && t >= 1) || (dir < 0 && t <= 0)) { settle(toT); return }
      request(tick)
    }
    request(tick)
    return pending.promise
  }

  const scrub = (on: boolean) => el.classList.toggle('ori-scrub', on)

  const set = (at: number) => {
    cancel()
    const v = Math.min(1, Math.max(0, at))
    scrub(true)
    flush()
    t = v
    for (const f of flaps) f.el.style.setProperty('--ori-a', `${num((pose(fold, v, schedule).angles[f.crease.id] ?? 0) * DEG)}deg`)
    paint(v, false)
    if (v >= 1) { state = 'open'; classes(true, true); firstLanding.resolve() }
    else if (v <= 0) { state = 'closed'; classes(false, false) }
    else { state = 'still'; classes(false, false) }
    const d = pending
    pending = undefined
    d?.resolve()
  }

  const open = (): Promise<void> => {
    if (reduced) { set(1); return Promise.resolve() }
    if (state === 'open') return Promise.resolve()
    state = 'opening'
    if (drive === 'css') {
      scrub(false)
      flush()
      el.classList.remove('is-landed')
      el.classList.add('is-open')
      for (const f of flaps) f.el.style.setProperty('--ori-a', '0deg')
    } else {
      classes(true, false)
    }
    return run(1)
  }

  const close = (): Promise<void> => {
    if (reduced) { set(0); return Promise.resolve() }
    if (state === 'closed') return Promise.resolve()
    state = 'closing'
    if (drive === 'css') {
      scrub(false)
      flush()
      classes(false, false)
      for (const f of flaps) f.el.style.setProperty('--ori-a', f.el.style.getPropertyValue('--ori-closed'))
    } else {
      classes(false, false)
    }
    return run(0)
  }

  const destroy = () => {
    cancel()
    pending?.resolve()
    untrack()
    container.remove()
    cover(false)
    for (const name of new Set(hostProps)) el.style.removeProperty(name)
    el.classList.remove('ori-host', 'ori-lifted', 'ori-paper', 'ori-scrub', 'is-open', 'is-landed')
  }

  // The initial state, with no motion
  set(reduced ? 1 : options.at ?? 0)

  return {
    el,
    fold,
    style,
    schedule,
    drive,
    get t() { return t },
    get state() { return state },
    open,
    close,
    set,
    destroy,
    landed: firstLanding.promise,
  }
}

/** The polygon a side is clipped to, for a check or a test: the face's points, mirrored for the back. */
export function sidePolygon(fold: Fold, faceId: FaceId, back = false): Pt[] {
  const f = faceOf(fold, faceId)
  return back ? mirrorX(fold.sheet.width)(f.pts) : f.pts
}

/** Whether a flat element's size matches the fold's sheet; a fold built for another size would shear on the box. */
export function fits(el: { offsetWidth: number; offsetHeight: number }, fold: Fold, tol = 1): boolean {
  return Math.abs(el.offsetWidth - fold.sheet.width) <= tol && Math.abs(el.offsetHeight - fold.sheet.height) <= tol
}
