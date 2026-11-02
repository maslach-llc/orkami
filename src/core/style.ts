// The look as a themable style (docs/design/02-look.md; docs/design/01-decisions.md D9) and the
// rules that turn a style and a pose into what a driver draws: a face's tone from its print and
// the one light (docs/study/02-paper-on-a-screen.md, cue 1), the shadow stack from its height
// (cue 3), the crease gradient and its per-frame occlusion (cue 8). The default style is a
// neutral paper; a host passes its own tones in. Nothing here names a site or a brand.
import type { Pt } from './affine.ts'
import { centroid, type Crease, type Face, type FaceId, type Fold, type Slot } from './fold.ts'
import { shade } from './light.ts'
import type { Pose } from './pose.ts'
import type { Vec3 } from './space.ts'

/** A face's print: a top-to-bottom gradient. A single color is both ends. */
export interface Tone {
  top: string
  bottom: string
}

/** The Tone of one flat color. */
export const flat = (c: string): Tone => ({ top: c, bottom: c })

export interface Style {
  tones: {
    /** The two lit slots, alternating along a strip. */
    lit: [Tone, Tone]
    /** The two shade slots. */
    shade: [Tone, Tone]
    /** The unprinted side; defaults to the host's sheet color. */
    back: Tone
  }
  crease: {
    /** Hairline width, px. */
    width: number
    /** Hairline on a lit face. */
    onLit: string
    /** Hairline on a shaded face. */
    onShade: string
    gradient: {
      /** Darkening at the hinge of a shade face, 0..1. */
      strength: number
      /** How far into the face it reaches, as a fraction of hinge-to-centroid. */
      depth: number
      /** The per-frame extra at the crease as the angle nears 180 (02, cue 8). */
      occlusion: number
    }
  }
  grain: {
    on: boolean
    /** Alpha of the multiplied noise. */
    strength: number
    /** feTurbulence baseFrequency. */
    frequency: number
    octaves: number
  }
  shadows: {
    /** The contact layer, gone by `fade` px of lift. */
    contact: { offset: [number, number]; blur: number; opacity: number; fade: number }
    /** The ambient layer, drifting and softening with lift: offset in px per px, blur in px per px, opacity as the fraction lost at 300 px. */
    ambient: {
      offset: [number, number]
      blur: number
      spread: number
      opacity: number
      lift: { offset: [number, number]; blur: number; opacity: number }
    }
  }
  /** The only value in the first release. */
  edges: 'sharp'
  light: {
    /** Unit, page coordinates, toward the light. */
    direction: [number, number, number]
    /** ka */
    ambient: number
    /** kd */
    diffuse: number
  }
  /** Content shows mirrored through the back. */
  thin: boolean
}

/** The neutral paper with the reference effects: the "default style" block of docs/design/02-look.md. */
export const DEFAULT_STYLE: Style = {
  tones: {
    lit: [{ top: '#FFFFFF', bottom: '#E6E6E6' }, { top: '#F8F8F5', bottom: '#DEDEDC' }],
    shade: [{ top: '#E4E5E0', bottom: '#CBCBC6' }, { top: '#CED0CA', bottom: '#B5B7B0' }],
    back: { top: '#f3f4f1', bottom: '#f3f4f1' },
  },
  crease: {
    width: 1,
    onLit: 'rgb(0 0 0 / .3)',
    onShade: 'rgb(255 255 255 / .4)',
    gradient: { strength: 0.38, depth: 0.6, occlusion: 0.12 },
  },
  grain: { on: true, strength: 0.14, frequency: 1.0, octaves: 3 },
  shadows: {
    contact: { offset: [0, 2], blur: 4, opacity: 0.14, fade: 24 },
    ambient: {
      offset: [0, 16],
      blur: 32,
      spread: -6,
      opacity: 0.22,
      lift: { offset: [0.225, 0.35], blur: 0.8, opacity: 0.5 },
    },
  },
  edges: 'sharp',
  light: { direction: [-0.346, -0.538, 0.769], ambient: 0.35, diffuse: 0.85 },
  thin: false,
}

/** A partial style: objects may be given in part, arrays (tuples, tones' pairs) are replaced whole. */
export type StyleOverrides = DeepPartial<Style>
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K]
}

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function merge<T>(base: T, over: unknown): T {
  if (over === undefined) return base
  if (!isPlain(base) || !isPlain(over)) return over as T
  const out: Record<string, unknown> = { ...base }
  for (const k of Object.keys(over)) out[k] = merge(base[k], over[k])
  return out as T
}

/** The default style with `overrides` deep-merged over it: a host passes its four slot tones and keeps the rest. */
export function style(overrides: StyleOverrides = {}): Style {
  return merge(DEFAULT_STYLE, overrides)
}

/** The print Tone of a slot; an unslotted face prints as the first lit slot. */
export function slotTone(style: Style, slot?: Slot): Tone {
  switch (slot) {
    case 'lit2': return style.tones.lit[1]
    case 'shade': return style.tones.shade[0]
    case 'shade2': return style.tones.shade[1]
    default: return style.tones.lit[0]
  }
}

/** `#rgb` or `#rrggbb` to channels 0..255. */
export function parseHex(c: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim())
  if (!m) throw new Error(`not a hex color: ${c}`)
  const h = m[1]!.length === 3 ? [...m[1]!].map(ch => ch + ch).join('') : m[1]!
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Channels to `#rrggbb`, lowercase, each clamped to 0..255 and rounded. */
export function hex([r, g, b]: [number, number, number]): string {
  const ch = (v: number) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0')
  return `#${ch(r)}${ch(g)}${ch(b)}`
}

/** A hex color with every channel scaled by k (the Lambert factor), clamped. */
export function scaleColor(c: string, k: number): string {
  const [r, g, b] = parseHex(c)
  return hex([r * k, g * k, b * k])
}

const scaleTone = (t: Tone, k: number): Tone => ({ top: scaleColor(t.top, k), bottom: scaleColor(t.bottom, k) })

function posed(face: Face, pose: Pose) {
  const p = pose.faces[face.id]
  if (!p) throw new Error(`pose has no face ${face.id}`)
  return p
}

/** The Lambert factor k = ka + kd * max(0, L . N) of a face in a pose (02, cue 1): 1 (1.004) when flat. */
export function brightness(face: Face, pose: Pose, style: Style = DEFAULT_STYLE): number {
  return shade(posed(face, pose).normal, style.light.direction, style.light.ambient, style.light.diffuse)
}

/** The face's displayed tone: its slot's print times k. The resting pose shows the print as printed. */
export function tone(face: Face, pose: Pose, style: Style = DEFAULT_STYLE): Tone {
  return scaleTone(slotTone(style, face.slot), brightness(face, pose, style))
}

/** The back's displayed tone: the back print times k of the reversed normal (02, cue 2). */
export function backTone(face: Face, pose: Pose, style: Style = DEFAULT_STYLE): Tone {
  const [x, y, z] = posed(face, pose).normal
  const reversed: Vec3 = [-x, -y, -z]
  return scaleTone(style.tones.back, shade(reversed, style.light.direction, style.light.ambient, style.light.diffuse))
}

/**
 * The crease gradient of a shade face (02, cue 8, the fixed part): from the hinge's midpoint
 * toward the face's centroid and 2.2 times that distance beyond (the seed's reach), black at
 * `strength` on the hinge, falling to a floor at `depth` and rising a little at the far end.
 * The two far stops are in the seed's ratio to the hinge stop (.46 : .1 : .18), so a style with
 * strength .46 and depth .6 reproduces the seed's `creaseGradient` stops exactly.
 */
export function creaseGradient(face: Face, crease: Crease, style: Style = DEFAULT_STYLE): { from: Pt; to: Pt; stops: { offset: number; opacity: number }[] } {
  const { strength, depth } = style.crease.gradient
  const from: Pt = [(crease.a[0] + crease.b[0]) / 2, (crease.a[1] + crease.b[1]) / 2]
  const c = centroid(face.pts)
  const to: Pt = [from[0] + (c[0] - from[0]) * 2.2, from[1] + (c[1] - from[1]) * 2.2]
  return {
    from,
    to,
    stops: [
      { offset: 0, opacity: strength },
      { offset: depth, opacity: strength * 10 / 46 },
      { offset: 1, opacity: strength * 18 / 46 },
    ],
  }
}

/** The two shadow layers under a face at `height` px above the sheet (02, cue 3): the resting stack at 0, the contact layer gone by `fade`, the ambient layer drifting, softening and thinning with lift. */
export function shadowAt(height: number, style: Style = DEFAULT_STYLE): {
  contact: { offset: [number, number]; blur: number; opacity: number }
  ambient: { offset: [number, number]; blur: number; spread: number; opacity: number }
} {
  const h = Math.max(0, height)
  const c = style.shadows.contact, a = style.shadows.ambient
  return {
    contact: { offset: [c.offset[0], c.offset[1]], blur: c.blur, opacity: c.opacity * Math.max(0, 1 - h / c.fade) },
    ambient: {
      offset: [a.offset[0] + h * a.lift.offset[0], a.offset[1] + h * a.lift.offset[1]],
      blur: a.blur + h * a.lift.blur,
      spread: a.spread,
      opacity: a.opacity * (1 - a.lift.opacity * Math.min(1, h / 300)),
    },
  }
}

/** The highest point of a face above the sheet plane in a pose, in sheet units; 0 for a face lying on or under it. */
export function faceHeight(fold: Fold, pose: Pose, faceId: FaceId): number {
  if (!fold.faces.some(f => f.id === faceId)) throw new Error(`no face ${faceId}`)
  const p = pose.faces[faceId]
  if (!p) throw new Error(`pose has no face ${faceId}`)
  return Math.max(0, ...p.pts.map(v => v[2]))
}

/** The per-frame extra darkening at a crease at a signed fold angle (02, cue 8, the dynamic part): 0 when flat, the style's full `occlusion` at 180 degrees. */
export function occlusion(angle: number, style: Style = DEFAULT_STYLE): number {
  return style.crease.gradient.occlusion * Math.abs(angle) / Math.PI
}
