// The WebGL driver's stage: a renderer on a canvas, a camera at arm's length, the one light, an
// ambient fill and a shadow floor at the sheet plane (docs/study/02-paper-on-a-screen.md cues 1,
// 3 and 4; D5, D14, D15). `stage(canvas, { width, height })` frames a sheet of that size with a bleed
// around it (a flap swinging about its crease reaches past the box); `add(handle)` puts a
// `buildFold` handle on it, centered; `play(handle)` runs the handle's t on
// requestAnimationFrame, the schedule's easing being applied per crease by `pose()`.
//
// The light is the style's direction (page coordinates, toward the light) with ka and kd as the
// ambient and directional intensities (times pi: three's Lambert divides by it), and the canvas
// is drawn with no output encoding, so a face shows `tone()` exactly (scene.ts). The shadow map
// softens with the highest face's height and tightens as it lands, from `shadowAt()`.
import {
  AmbientLight,
  DirectionalLight,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  NoToneMapping,
  PCFShadowMap,
  VSMShadowMap,
  type ShadowMapType,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  WebGLRenderer,
} from 'three'
import type { Fold } from '../core/fold.ts'
import { pose } from '../core/pose.ts'
import { together, type Schedule } from '../core/schedule.ts'
import { shadowAt, style as makeStyle, type Style, type StyleOverrides } from '../core/style.ts'
import type { FoldHandle } from './scene.ts'

export interface StageOptions {
  /** The sheet's size in sheet units (px): what the canvas frames, plus the bleed. */
  width: number
  height: number
  /** The margin around the sheet the canvas also shows, [x, y] per side; `bleedFor(fold)` computes one. */
  bleed?: [number, number]
  /** The light and the shadows come from the style. */
  style?: Style | StyleOverrides
  /** The camera's distance; 2.2 times the width, never under 1000, as the CSS driver's perspective. */
  perspective?: number
  /** Capped at 2; the window's devicePixelRatio by default. */
  pixelRatio?: number
  /** The shadow map's size. 1024 by default. */
  shadowMap?: number
  /** The shadow filter: 'soft' (VSM, a blurred map whose radius follows the height; the default) or 'pcf' (three's PCFShadowMap, cheaper, dithered at large radii). */
  shadowFilter?: 'soft' | 'pcf'
  /** A renderer to draw with instead of making one on the canvas (a test, a shared context). */
  renderer?: WebGLRenderer
}

export interface Stage {
  readonly renderer: WebGLRenderer
  readonly scene: Scene
  readonly camera: PerspectiveCamera
  readonly light: DirectionalLight
  readonly ambient: AmbientLight
  readonly floor: Mesh
  /** The group the handles hang in: the sheet's top left corner, so the sheet's center is the scene's origin. */
  readonly content: Group
  readonly style: Style
  add(handle: FoldHandle): void
  remove(handle: FoldHandle): void
  /** Sets the drawing buffer to w x h CSS px (the canvas's box). */
  resize(w: number, h: number): void
  render(): void
  /** Runs the handle from its t to `to` (1 open, 0 closed) over `duration` ms (the schedule's total by default, scaled by the distance), then calls `onDone`; resolves at the end. Under reduced motion it jumps. */
  play(handle: FoldHandle, duration?: number, onDone?: () => void, to?: 0 | 1): Promise<void>
  /** Stops a running play where it is. */
  stop(): void
  /** Disposes the renderer (when the stage made it), the floor and the shadow map; the handles are their own. */
  dispose(): void
}

/** The camera distance for a sheet of width w: 2.2 widths, never under 1000 (02, cue 4). */
export const distanceFor = (w: number) => Math.max(1000, 2.2 * w)

/**
 * The bleed a fold needs on each side so every face stays on the canvas through the motion:
 * the poses at `samples` times, projected from the camera's distance onto the sheet plane,
 * plus the shadow's drift under the light and its blur at the highest lift. From the core's poses; nothing guessed.
 */
export function bleedFor(fold: Fold, { schedule = fold.schedule ?? together(fold), perspective, samples = 24, style }: { schedule?: Schedule; perspective?: number; samples?: number; style?: Style | StyleOverrides } = {}): [number, number] {
  const W = fold.sheet.width, H = fold.sheet.height
  const s = makeStyle(style as StyleOverrides | undefined)
  const d = perspective ?? distanceFor(W)
  const [lx, ly, lz] = s.light.direction
  const cx = W / 2, cy = H / 2
  let mx = 0, my = 0, top = 0
  for (let i = 0; i <= samples; i++) {
    const p = pose(fold, i / samples, schedule)
    for (const f of fold.faces) {
      if (f.page) continue
      for (const [x, y, z] of p.faces[f.id]!.pts) {
        const k = d / Math.max(1, d - z)
        const px = cx + (x - cx) * k, py = cy + (y - cy) * k
        // Where the point's shadow falls on the sheet
        const hz = Math.max(0, z)
        top = Math.max(top, hz)
        const sx = x - lx / lz * hz, sy = y - ly / lz * hz
        for (const [ax, ay] of [[px, py], [sx, sy]] as const) {
          mx = Math.max(mx, -ax, ax - W)
          my = Math.max(my, -ay, ay - H)
        }
      }
    }
  }
  // The shadow's soft edge reaches about three standard deviations past its shape at the highest lift
  const blur = 3 * shadowSoftness(top, s)
  return [Math.ceil(mx + blur), Math.ceil(my + blur)]
}

/** The combined opacity of the resting shadow pair, contact over ambient: what the floor shows under a face's full shadow. */
export const restingShadow = (s: Style) => {
  const r = shadowAt(0, s)
  return 1 - (1 - r.contact.opacity) * (1 - r.ambient.opacity)
}

/** How much of a face's direct light a shadow takes: tuned so a shadow on a face darkens it as much as the floor's shadow darkens the page. */
export const SHADOW_INTENSITY = 0.5

/** The shadow's blur radius (a standard deviation, sheet px) at a height: the contact layer's at touchdown, the ambient layer's as the face lifts, from `shadowAt()`. */
export function shadowSoftness(height: number, s: Style): number {
  const r = shadowAt(height, s)
  const lift = Math.min(1, Math.max(0, height) / s.shadows.contact.fade)
  return (r.contact.blur / 2) * (1 - lift) + (r.ambient.blur / 2) * lift
}

export function stage(canvas: HTMLCanvasElement | OffscreenCanvas, options: StageOptions): Stage {
  const style = makeStyle(options.style as StyleOverrides | undefined)
  const W = options.width, H = options.height
  const [bx, by] = options.bleed ?? [0, 0]
  const vw = W + 2 * bx, vh = H + 2 * by
  const dist = options.perspective ?? distanceFor(W)
  const win = (canvas as HTMLCanvasElement).ownerDocument?.defaultView ?? (typeof window === 'undefined' ? undefined : window)
  const own = !options.renderer
  const renderer = options.renderer ?? new WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true })
  renderer.setPixelRatio(Math.min(2, options.pixelRatio ?? win?.devicePixelRatio ?? 1))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = LinearSRGBColorSpace
  renderer.toneMapping = NoToneMapping
  renderer.shadowMap.enabled = true
  const filter: ShadowMapType = options.shadowFilter === 'pcf' ? PCFShadowMap : VSMShadowMap
  renderer.shadowMap.type = filter

  const scene = new Scene()
  // The camera looks straight at the sheet's center from arm's length; its view of the sheet plane is the bled canvas exactly
  const camera = new PerspectiveCamera(2 * Math.atan(vh / 2 / dist) * 180 / Math.PI, vw / vh, dist / 10, dist * 4)
  camera.position.set(0, 0, dist)
  camera.lookAt(0, 0, 0)

  const [lx, ly, lz] = style.light.direction
  const light = new DirectionalLight(0xffffff, style.light.diffuse * Math.PI)
  light.position.set(lx, -ly, lz).normalize().multiplyScalar(dist)
  light.castShadow = true
  const size = options.shadowMap ?? 1024
  light.shadow.mapSize.set(size, size)
  const ext = Math.hypot(vw, vh) / 2
  light.shadow.camera.left = -ext
  light.shadow.camera.right = ext
  light.shadow.camera.top = ext
  light.shadow.camera.bottom = -ext
  light.shadow.camera.near = dist / 4
  light.shadow.camera.far = dist * 2
  light.shadow.bias = -0.0005
  light.shadow.normalBias = 0.5
  light.shadow.intensity = SHADOW_INTENSITY
  light.shadow.blurSamples = 32
  light.shadow.camera.updateProjectionMatrix()
  const ambient = new AmbientLight(0xffffff, style.light.ambient * Math.PI)
  scene.add(light, light.target, ambient)

  // The page under the sheet catches the shadows, a hair below it so a resting face never fights it
  const floor = new Mesh(new PlaneGeometry(vw, vh), new ShadowMaterial({ opacity: Math.min(1, restingShadow(style) / SHADOW_INTENSITY), transparent: true, depthWrite: false }))
  floor.position.z = -0.5
  floor.receiveShadow = true
  scene.add(floor)

  const content = new Group()
  content.position.set(-W / 2, H / 2, 0)
  scene.add(content)
  const handles = new Set<FoldHandle>()
  const texel = (2 * ext) / size

  const render = () => {
    let h = 0
    for (const x of handles) h = Math.max(h, x.height)
    light.shadow.radius = Math.max(1, shadowSoftness(h, style) / texel)
    renderer.render(scene, camera)
  }

  let raf = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: (() => void) | undefined
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const request = (fn: (ms: number) => void) => {
    if (win?.requestAnimationFrame) raf = win.requestAnimationFrame(fn)
    else timer = setTimeout(() => fn(now()), 16)
  }
  const stop = () => {
    if (raf && win?.cancelAnimationFrame) win.cancelAnimationFrame(raf)
    if (timer) clearTimeout(timer)
    raf = 0
    timer = undefined
    const p = pending
    pending = undefined
    p?.()
  }
  const reduced = () => !!win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const play = (handle: FoldHandle, duration = handle.schedule.total, onDone?: () => void, to: 0 | 1 = 1): Promise<void> => {
    stop()
    return new Promise<void>((resolve) => {
      const finish = () => { onDone?.(); resolve() }
      const from = handle.t
      if (reduced() || from === to) { handle.set(to); render(); finish(); return }
      const span = Math.abs(to - from) * duration
      const t0 = now()
      pending = resolve
      const tick = () => {
        const x = Math.min(1, (now() - t0) / Math.max(1, span))
        handle.set(from + (to - from) * x)
        render()
        if (x >= 1) { raf = 0; pending = undefined; finish(); return }
        request(tick)
      }
      request(tick)
    })
  }

  return {
    renderer,
    scene,
    camera,
    light,
    ambient,
    floor,
    content,
    style,
    add(handle) { handles.add(handle); content.add(handle.root) },
    remove(handle) { handles.delete(handle); content.remove(handle.root) },
    resize(w, h) {
      renderer.setSize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    },
    render,
    play,
    stop,
    dispose() {
      stop()
      for (const h of handles) content.remove(h.root)
      handles.clear()
      floor.geometry.dispose()
      ;(floor.material as ShadowMaterial).dispose()
      light.shadow.map?.dispose()
      if (own) renderer.dispose()
    },
  }
}
