// v-unfold: a block lies folded in the page as a shape of paper and unfolds out of it when it
// scrolls into view, on the CSS driver. The directive API is the one the seed had, so
// a site swaps the import and keeps its templates:
//
//   <section v-unfold>                         a flap of the page lifting out of the background
//                                              on its top crease (the default, a lift)
//   <aside v-unfold="'left'">                  folded 180 degrees over on its left edge and
//                                              swinging out, paper back first ('top', 'bottom',
//                                              'right' likewise: a lift on that edge)
//   <div v-unfold="'blintz'">                  any named fold: the square's corners folded to
//                                              the center, opening out into the block
//   <div v-unfold="{ hinge: myFold }">         a Fold of the core, or a factory (w, h) => Fold
//   <ul v-unfold.stagger>                      each child unfolds in turn, `step` ms apart
//   <ul v-unfold.stagger="{ hinge: 'left', step: 60 }">
//   <ul v-unfold.stagger.refold>               folds back once it is more than a screen away,
//                                              and unfolds again on the way back
//   <ol v-unfold.always="{ open: ready }">     opens when `open` turns true instead of on
//                                              scroll; `.always` folds even a block already on
//                                              screen at hydration (otherwise left flat, so
//                                              nothing folds away in front of the visitor)
//
// The directive is a no-op on the server (getSSRProps) and under reduced motion; the fold is
// applied on mount, client only, so server HTML is flat. A target must not clip (orkami.css).
import type { Directive } from 'vue'
import type { Fold } from '../core/fold.ts'
import { lift, named, type Edge, type NamedFold } from '../core/folds/index.ts'
import type { StyleOverrides } from '../core/style.ts'
import { mount, type Handle, type MountOptions } from '../css/driver.ts'

/** The seed's hinges plus every named fold. */
export type Hinge = 'lift' | Edge | NamedFold
export type FoldSpec = Hinge | Fold | ((w: number, h: number) => Fold)

export interface UnfoldOptions {
  hinge?: FoldSpec
  /** ms between one child starting and the next (`.stagger`). */
  step?: number
  /** ms before the first starts. */
  delay?: number
  /** Opens on this turning true instead of on scroll. */
  open?: boolean
  style?: StyleOverrides
  /** Passed to the driver's `mount`. */
  mount?: Omit<MountOptions, 'delay' | 'style'>
}

export type UnfoldValue = Hinge | UnfoldOptions | undefined

const EDGES: Edge[] = ['top', 'bottom', 'left', 'right']

/** A hinge name, Fold or factory as the factory `mount` takes. */
export function foldFor(spec: FoldSpec | undefined): (w: number, h: number) => Fold {
  if (spec === undefined || spec === 'lift') return (w, h) => lift(w, h, 'top')
  if (typeof spec === 'function') return spec
  if (typeof spec === 'string') {
    if ((EDGES as string[]).includes(spec)) return (w, h) => lift(w, h, spec as Edge)
    const make = named[spec as NamedFold]
    if (!make) throw new Error(`v-unfold: no fold named ${spec}`)
    return make
  }
  return () => spec
}

export const options = (value: UnfoldValue): UnfoldOptions => typeof value === 'string' ? { hinge: value } : (value ?? {})

interface Bound {
  handles: Handle[]
  open: () => void
  dispose: () => void
}

const bound = new WeakMap<Element, Bound>()

let io: IntersectionObserver | undefined
let away: IntersectionObserver | undefined
const pending = new WeakMap<Element, () => void>()
const refolds = new WeakMap<Element, () => void>()

type Win = Window & typeof globalThis

/** Opens once the element is (a little) on screen. */
function observe(win: Win, el: Element, open: () => void) {
  const observer = io ??= new win.IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      observer.unobserve(e.target)
      pending.get(e.target)?.()
      pending.delete(e.target)
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
  pending.set(el, open)
  observer.observe(el)
}

/** `.refold`: watches with a margin of one viewport, so leaving it means more than a screen away. */
function watchAway(win: Win, el: Element, refold: () => void) {
  const observer = away ??= new win.IntersectionObserver((entries) => {
    for (const e of entries) if (!e.isIntersecting) refolds.get(e.target)?.()
  }, { rootMargin: '100% 0px', threshold: 0 })
  refolds.set(el, refold)
  observer.observe(el)
}

export const vUnfold: Directive<HTMLElement, UnfoldValue> = {
  mounted(el, binding) {
    const win = el.ownerDocument.defaultView as Win | null
    if (!win) return
    if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const o = options(binding.value)
    const targets = binding.modifiers.stagger ? Array.from(el.children) as HTMLElement[] : [el]
    if (!targets.length) return

    // Already on screen at hydration: leave it flat rather than fold it away in front of the visitor
    const r = el.getBoundingClientRect()
    const onScreen = r.top < win.innerHeight && r.bottom > 0
    if (onScreen && !binding.modifiers.always) return

    const factory = foldFor(o.hinge)
    const step = o.step ?? 90
    let state: 'folded' | 'open' = 'folded'
    const handles = targets.map((t, i) => mount(t, factory, { ...o.mount, style: o.style, delay: (o.delay ?? 0) + i * step }))

    const open = () => {
      if (state === 'open') return
      state = 'open'
      for (const h of handles) void h.open()
    }
    // Folding back is instant (only the opening is animated): a block folded where the visitor
    // can see it would otherwise swing half shut and back before it opens
    const fold = () => {
      state = 'folded'
      for (const h of handles) h.set(0)
    }

    if ('open' in o) {
      if (o.open) win.requestAnimationFrame(open)
    } else {
      observe(win, el, open)
    }
    if (binding.modifiers.refold) {
      watchAway(win, el, () => {
        if (state !== 'open') return
        fold()
        observe(win, el, open)
      })
    }
    bound.set(el, {
      handles,
      open,
      dispose: () => {
        io?.unobserve(el)
        away?.unobserve(el)
        pending.delete(el)
        refolds.delete(el)
        for (const h of handles) h.destroy()
      },
    })
  },
  updated(el, binding) {
    if (options(binding.value).open) bound.get(el)?.open()
  },
  unmounted(el) {
    bound.get(el)?.dispose()
    bound.delete(el)
  },
  getSSRProps: () => ({}),
}

/** The driver handles behind a bound element, for a test or an inspector. */
export const handlesOf = (el: Element): Handle[] => bound.get(el)?.handles ?? []
