// The WebGL driver's scene graph: a fold from the core as nested three.js Groups, one per face,
// hinged on the creases of the hinge tree (D3). Each group's origin is its crease's point and
// its rotation is about the crease's axis, so a crease opening carries every face folded beyond
// it; each face is a flat `ShapeGeometry` of its polygon (sharp, one plane, no smoothing), a
// front and a back mesh, lit by the one light (D5) through `MeshLambertMaterial`. `set(t)` takes
// the angles from `pose()` and only sets rotations: the core computes, the driver draws.
//
// Coordinates. The core works in page coordinates (x right, y down, z toward the visitor), which
// is a mirror of three's (y up). Every point goes into the scene as (x, -y, z); a rotation by a
// about the page axis (ux, uy, 0) is then a rotation by -a about (ux, -uy, 0). The root group is
// the sheet with its top left corner at the group's origin; `stage()` centers it.
//
// Color. The prints are the style's tones in sRGB, multiplied by the Lambert factor
// k = ka + kd * max(0, L . N) in that same space, as the core's `tone()` and the CSS driver's
// overlay do. So the vertex colors carry raw sRGB values, the lights carry ka and kd (times pi,
// three's Lambert divides by it), and the stage renders with no output encoding: the rendered
// face is `tone()` exactly.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  BackSide,
  FrontSide,
  Group,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshLambertMaterial,
  RepeatWrapping,
  RGBAFormat,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  type Texture,
} from 'three'
import type { Pt } from '../core/affine.ts'
import { centroid, face as faceOf, seamOf, shadeSeams, treeCreases, type Crease, type Face, type FaceId, type Fold } from '../core/fold.ts'
import { hingeAxis, pose, type Pose } from '../core/pose.ts'
import { together, type Schedule } from '../core/schedule.ts'
import { stackOrder } from '../core/stack.ts'
import { creaseGradient, faceHeight, occlusion, parseHex, slotTone, style as makeStyle, type Style, type StyleOverrides, type Tone } from '../core/style.ts'
import { hingeTree } from '../core/tree.ts'

/** The tones a fold is painted in: `lit` for lit and unslotted faces, `shade` for shade faces, `back` for every back. A color string is a flat tone. */
export interface Palette {
  lit?: Tone | string
  shade?: Tone | string
  back?: Tone | string
}

/** A per-face paint: a tone (or color) for that side, a material of the caller's own (used as given and never disposed), or undefined for the style's. */
export type PaintFn = (face: Face, side: 'front' | 'back') => Tone | string | Material | undefined

export interface BuildOptions {
  /** The look; overrides over the default style, or a full `Style`. */
  style?: Style | StyleOverrides
  /** The schedule; the fold's own, else every crease together. */
  schedule?: Schedule
  /** The paint: a palette over the style's tones, or a per-face callback. */
  palette?: Palette | PaintFn
  /** The flat-state layer step in sheet units (D12): a child sits `step * layer` along its parent's normal so coplanar faces never fight for depth, in full when its crease is closed, easing to none as it lies flat (where faces tile and cannot overlap). 0.5 by default, as the CSS driver's `--ori-layer`. */
  layer?: number
  /** The crease hairlines (02, cue 6). On by default. */
  creases?: boolean
  /** Whether the faces cast and receive shadows; the style's `shadows.on` by default. */
  shadows?: boolean
  /** The time to build at: 0 closed (the default), 1 flat. */
  at?: number
}

export interface FoldHandle {
  readonly fold: Fold
  readonly style: Style
  readonly schedule: Schedule
  /** The sheet: the root face's group, top left corner at its origin, in three's axes (y up). */
  readonly root: Group
  /** Each face's hinge group (the root's is `root`). */
  readonly groups: Map<FaceId, Group>
  /** Each face's front mesh; its back mesh is its child. Page faces have none. */
  readonly faces: Map<FaceId, Mesh>
  readonly backs: Map<FaceId, Mesh>
  /** The crease hairlines, by crease id. */
  readonly lines: Map<string, LineSegments>
  /** The current time, 0 closed to 1 flat. */
  readonly t: number
  /** The current pose, from the core. */
  readonly pose: Pose
  /** The highest point of any face above the sheet, sheet units: what the stage softens the shadow by. */
  readonly height: number
  /** Puts the fold at t: rotations from `pose()`, the crease occlusion and the hairlines' fade. */
  set(t: number): void
  /** Disposes every geometry, material and texture the handle made and detaches the root. */
  dispose(): void
}

/** The height (sheet units) above which a face casts a shadow: past its own layer step, so a face lying in the sheet casts none. */
const CAST = 1

/** A page point into the scene's axes. */
const P = ([x, y]: Pt, z = 0) => new Vector3(x, -y, z)

/** A color string (hex, `rgb()` / `rgba()` with numbers, or a `/ alpha`, or `color(srgb r g b)` as a browser computes a `color-mix()`) to channels 0..1 and an alpha. Any other CSS color goes through `resolveStyle` / `resolvePalette` first. */
export function parseColor(c: string): { rgb: [number, number, number]; alpha: number } {
  const s = c.trim()
  if (s.startsWith('#')) {
    const [r, g, b] = parseHex(s)
    return { rgb: [r / 255, g / 255, b / 255], alpha: 1 }
  }
  const srgb = /^color\(\s*srgb\s+([^)]*)\)$/i.exec(s)
  if (srgb) {
    const parts = srgb[1]!.split(/[\s/]+/).filter(Boolean)
    const ch = (v: string) => v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v)
    return { rgb: [ch(parts[0]!), ch(parts[1]!), ch(parts[2]!)], alpha: parts[3] === undefined ? 1 : ch(parts[3]) }
  }
  const m = /^rgba?\(([^)]*)\)$/i.exec(s)
  if (!m) throw new Error(`not a color the WebGL driver reads: ${c}`)
  const parts = m[1]!.split(/[\s,/]+/).filter(Boolean)
  const ch = (v: string) => v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / 255
  const a = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])
  return { rgb: [ch(parts[0]!), ch(parts[1]!), ch(parts[2]!)], alpha: a }
}

const toTone = (v: Tone | string): Tone => typeof v === 'string' ? { top: v, bottom: v } : v
const rgb = (c: string) => parseColor(c).rgb

/** The grain tile (02, cue 7): fractal value noise, multiplied, at the style's strength. Pure arithmetic, so it builds without a DOM. */
export function grainTexture(g: Style['grain'], size = 96): DataTexture {
  // A seeded generator so every page shows the same paper
  let seed = 0x9e3779b9
  const rand = () => { seed = (seed ^ (seed << 13)) >>> 0; seed = (seed ^ (seed >>> 17)) >>> 0; seed = (seed ^ (seed << 5)) >>> 0; return seed / 4294967296 }
  const octaves = Math.max(1, Math.round(g.octaves))
  // Lattice periods dividing the tile so it wraps: frequency 1 is one cell per px, as feTurbulence
  const layers = Array.from({ length: octaves }, (_, o) => {
    const cells = Math.max(2, Math.min(size, Math.round(size * g.frequency * 2 ** o / 2)))
    return { cells, values: Float32Array.from({ length: cells * cells }, rand) }
  })
  const data = new Uint8Array(size * size * 4)
  const smooth = (x: number) => x * x * (3 - 2 * x)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let n = 0, amp = 1, norm = 0
      for (const { cells, values } of layers) {
        const fx = x / size * cells, fy = y / size * cells
        const x0 = Math.floor(fx), y0 = Math.floor(fy)
        const sx = smooth(fx - x0), sy = smooth(fy - y0)
        const v = (i: number, j: number) => values[((j % cells) * cells) + (i % cells)]!
        const top = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx
        const bottom = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx
        n += amp * (top + (bottom - top) * sy)
        norm += amp
        amp /= 2
      }
      const k = Math.round(255 * (1 - g.strength * (n / norm)))
      const i = (y * size + x) * 4
      data[i] = data[i + 1] = data[i + 2] = k
      data[i + 3] = 255
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearFilter
  tex.repeat.set(1 / size, 1 / size)
  tex.needsUpdate = true
  return tex
}

/** The uniforms the paper shader adds to a Lambert material: the crease gradient (fixed, 02 cue 8) and the occlusion at the crease (per frame). Points in scene axes. */
interface PaperUniforms {
  oriGradFrom: { value: Vector2 }
  oriGradTo: { value: Vector2 }
  /** Opacities at 0, depth and 1, and depth. */
  oriGrad: { value: [number, number, number, number] }
  oriOccFrom: { value: Vector2 }
  oriOccTo: { value: Vector2 }
  oriOcc: { value: number }
}

/** A Lambert material with the paper's two crease darkenings multiplied into the diffuse color, after the vertex colors and the grain. */
function paperMaterial(side: typeof FrontSide | typeof BackSide, map: Texture | null, uniforms: PaperUniforms): MeshLambertMaterial {
  const m = new MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true, side, map })
  m.shadowSide = DoubleSide
  m.userData.ori = uniforms
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vOriSheet;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOriSheet = position.xy;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vOriSheet;
uniform vec2 oriGradFrom; uniform vec2 oriGradTo; uniform vec4 oriGrad;
uniform vec2 oriOccFrom; uniform vec2 oriOccTo; uniform float oriOcc;
float oriAlong(vec2 a, vec2 b) { vec2 d = b - a; return clamp(dot(vOriSheet - a, d) / max(dot(d, d), 1e-6), 0.0, 1.0); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float s = oriAlong(oriGradFrom, oriGradTo);
  float g = s < oriGrad.w ? mix(oriGrad.x, oriGrad.y, s / max(oriGrad.w, 1e-6)) : mix(oriGrad.y, oriGrad.z, (s - oriGrad.w) / max(1.0 - oriGrad.w, 1e-6));
  float o = oriOcc * (1.0 - oriAlong(oriOccFrom, oriOccTo));
  diffuseColor.rgb *= (1.0 - g) * (1.0 - o);
}`)
  }
  m.customProgramCacheKey = () => 'orkami-paper'
  return m
}

/** Builds the fold as nested groups and returns the handle that poses them. */
export function buildFold(fold: Fold, options: BuildOptions = {}): FoldHandle {
  const style = makeStyle(options.style as StyleOverrides | undefined)
  const schedule = options.schedule ?? fold.schedule ?? together(fold)
  const tree = hingeTree(fold)
  const stack = stackOrder(fold, tree)
  const creases = new Map(treeCreases(fold).map(c => [c.id, c]))
  const H = fold.sheet.height
  const layer = options.layer ?? 0.5
  const shadows = options.shadows ?? style.shadows.on
  const palette = typeof options.palette === 'function' ? undefined : options.palette
  const paint = typeof options.palette === 'function' ? options.palette : undefined

  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  const grain = style.grain.on ? grainTexture(style.grain) : null
  if (grain) textures.add(grain)

  const printOf = (face: Face): Tone => {
    const lit = face.slot !== 'shade' && face.slot !== 'shade2'
    const own = lit ? palette?.lit : palette?.shade
    return own ? toTone(own) : slotTone(style, face.slot)
  }
  const backOf = (): Tone => palette?.back ? toTone(palette.back) : style.tones.back

  /** The face's geometry in its group's frame (its hinge point at the origin), vertex colors the print's top-to-bottom gradient over the sheet. */
  const geometryOf = (face: Face, origin: Vector3, tone: Tone): ShapeGeometry => {
    const shape = new Shape(face.pts.map(p => { const v = P(p).sub(origin); return new Vector2(v.x, v.y) }))
    const g = new ShapeGeometry(shape)
    const pos = g.getAttribute('position')
    const top = rgb(tone.top), bottom = rgb(tone.bottom)
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const f = Math.min(1, Math.max(0, -(pos.getY(i) + origin.y) / (H || 1)))
      for (let k = 0; k < 3; k++) colors[i * 3 + k] = top[k]! + (bottom[k]! - top[k]!) * f
    }
    g.setAttribute('color', new BufferAttribute(colors, 3))
    // The grain is fixed to the sheet: uv in sheet units
    const uv = g.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + origin.x, pos.getY(i) + origin.y)
    geometries.add(g)
    return g
  }

  const uniformsFor = (face: Face, crease: Crease | null, origin: Vector3, side: 'front' | 'back'): PaperUniforms => {
    const local = (p: Pt) => { const v = P(p).sub(origin); return new Vector2(v.x, v.y) }
    const u: PaperUniforms = {
      oriGradFrom: { value: new Vector2() }, oriGradTo: { value: new Vector2(1, 0) }, oriGrad: { value: [0, 0, 0, 0.5] },
      oriOccFrom: { value: new Vector2() }, oriOccTo: { value: new Vector2(1, 0) }, oriOcc: { value: 0 },
    }
    const seam = seamOf(fold, face.id)
    if (seam && side === 'front' && (face.slot === 'shade' || face.slot === 'shade2')) {
      const g = creaseGradient(face, seam, style)
      u.oriGradFrom.value = local(g.from)
      u.oriGradTo.value = local(g.to)
      u.oriGrad.value = [g.stops[0]!.opacity, g.stops[1]!.opacity, g.stops[2]!.opacity, g.stops[1]!.offset]
    }
    if (!crease) return u
    // The occlusion darkens the side the fold closes on, as the CSS driver: the front of a valley, the back of a mountain
    const mid: Pt = [(crease.a[0] + crease.b[0]) / 2, (crease.a[1] + crease.b[1]) / 2]
    const c = centroid(face.pts)
    u.oriOccFrom.value = local(mid)
    u.oriOccTo.value = local([mid[0] + (c[0] - mid[0]) * 0.6, mid[1] + (c[1] - mid[1]) * 0.6])
    return u
  }
  const occludes = (crease: Crease, side: 'front' | 'back') => crease.assignment === 'V' ? side === 'front' : crease.assignment === 'M' ? side === 'back' : false

  const root = new Group()
  root.name = `orkami:${fold.name ?? 'fold'}`
  const groups = new Map<FaceId, Group>()
  const faces = new Map<FaceId, Mesh>()
  const backs = new Map<FaceId, Mesh>()
  const lines = new Map<string, LineSegments>()
  const origins = new Map<FaceId, Vector3>()
  /** Per hinged face: its group, the rotation axis in scene axes, its crease, the uniforms to update. */
  const hinged: { group: Group; axis: Vector3; crease: Crease; occ: PaperUniforms[]; step: number }[] = []

  for (const id of tree.order) {
    const face = faceOf(fold, id)
    const hinge = tree.hinge[id]
    const parent = tree.parent[id]
    let group: Group
    let origin: Vector3
    let crease: Crease | null = null
    if (!hinge || !parent) {
      group = root
      origin = new Vector3()
    } else {
      crease = creases.get(hinge)!
      const axis = hingeAxis(fold, crease)
      origin = P([axis.point[0], axis.point[1]])
      group = new Group()
      group.name = id
      const parentOrigin = origins.get(parent)!
      group.position.copy(origin).sub(parentOrigin)
      groups.get(parent)!.add(group)
      // D12: the flat-state layer, along the parent's normal, before the hinge turns (set per frame)
      hinged.push({ group, axis: new Vector3(axis.dir[0], -axis.dir[1], 0).normalize(), crease, occ: [], step: (stack.step[hinge] ?? 0) * layer })
    }
    groups.set(id, group)
    origins.set(id, origin)
    if (face.page) continue

    const sideMaterial = (side: 'front' | 'back'): Material => {
      const own = paint?.(face, side)
      if (own instanceof Material) return own
      const u = uniformsFor(face, crease, origin, side)
      if (crease && occludes(crease, side)) hinged[hinged.length - 1]!.occ.push(u)
      const m = paperMaterial(side === 'front' ? FrontSide : BackSide, side === 'front' ? grain : null, u)
      materials.add(m)
      return m
    }
    const frontPaint = paint?.(face, 'front')
    const frontTone = frontPaint && !(frontPaint instanceof Material) ? toTone(frontPaint) : printOf(face)
    const backPaint = paint?.(face, 'back')
    const backTone = backPaint && !(backPaint instanceof Material) ? toTone(backPaint) : backOf()
    const front = new Mesh(geometryOf(face, origin, frontTone), sideMaterial('front'))
    front.name = `${id}:front`
    const back = new Mesh(geometryOf(face, origin, backTone), sideMaterial('back'))
    back.name = `${id}:back`
    front.castShadow = shadows
    front.receiveShadow = shadows && id === fold.root
    back.receiveShadow = false
    front.add(back)
    group.add(front)
    faces.set(id, front)
    backs.set(id, back)
  }

  // The hairlines: one per crease between two faces of the sheet (a hinge on the page is not a crease), in the parent's frame, just over the faces that meet there
  const lineMaterials = new Map<string, LineBasicMaterial>()
  const lineMaterial = (color: string) => {
    let m = lineMaterials.get(color)
    if (!m) {
      const c = parseColor(color)
      m = new LineBasicMaterial({ color: new Color().setRGB(...c.rgb), transparent: true, opacity: 0, depthWrite: false })
      m.userData.alpha = c.alpha
      lineMaterials.set(color, m)
      materials.add(m)
    }
    return m
  }
  if (options.creases ?? true) {
    const onShade = shadeSeams(fold)
    for (const c of creases.values()) {
      if (faceOf(fold, c.parent).page) continue
      const origin = origins.get(c.parent)!
      const lift = 0.05
      const a = P(c.a, lift).sub(origin), b = P(c.b, lift).sub(origin)
      a.z = b.z = lift
      const g = new BufferGeometry().setFromPoints([a, b])
      geometries.add(g)
      const line = new LineSegments(g, lineMaterial(onShade.has(c.id) ? style.crease.onShade : style.crease.onLit))
      line.name = `${c.id}:crease`
      line.renderOrder = 1
      groups.get(c.parent)!.add(line)
      lines.set(c.id, line)
    }
  }

  let t = 0
  let current: Pose = pose(fold, 0, schedule)
  let height = 0
  const set = (at: number) => {
    t = Math.min(1, Math.max(0, at))
    current = pose(fold, t, schedule)
    for (const h of hinged) {
      const angle = current.angles[h.crease.id] ?? 0
      h.group.quaternion.setFromAxisAngle(h.axis, -angle)
      // The layer step in full where the faces stack (closed) and none where they only tile (flat): a depth buffer needs it only for overlap
      h.group.position.z = h.crease.closed > 0 ? h.step * Math.min(1, Math.abs(angle) / h.crease.closed) : 0
      const o = occlusion(angle, style)
      for (const u of h.occ) u.oriOcc.value = o
    }
    // The hairlines come in over the last third of the motion and stay (02, cue 6)
    const fade = Math.min(1, Math.max(0, (t - 2 / 3) * 3))
    for (const m of lineMaterials.values()) m.opacity = (m.userData.alpha as number) * fade
    height = 0
    for (const f of fold.faces) {
      if (f.page) continue
      const fh = faceHeight(fold, current, f.id)
      height = Math.max(height, fh)
      // A face lying in the sheet casts nothing, as in the CSS driver: it is part of the page, not a card on it; lifted, it
      // casts. Only the face that stays put (the root) and the floor receive: a blurred shadow map shades a moving face
      // with its own neighbours, which reads as dirt, not as shadow (D15)
      const mesh = faces.get(f.id)
      if (mesh) mesh.castShadow = shadows && fh > CAST
    }
    root.updateMatrixWorld(true)
  }
  set(options.at ?? 0)

  return {
    fold,
    style,
    schedule,
    root,
    groups,
    faces,
    backs,
    lines,
    get t() { return t },
    get pose() { return current },
    get height() { return height },
    set,
    dispose() {
      root.removeFromParent()
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      for (const x of textures) x.dispose()
    },
  }
}

/** For a test or an inspector: the materials and geometries a handle owns, by walking its tree. */
export function resources(handle: FoldHandle): { geometries: Set<BufferGeometry>; materials: Set<Material> } {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>()
  handle.root.traverse((o) => {
    const m = o as Mesh
    if (m.geometry) geometries.add(m.geometry as BufferGeometry)
    if (m.material) for (const x of Array.isArray(m.material) ? m.material : [m.material]) materials.add(x)
  })
  return { geometries, materials }
}
