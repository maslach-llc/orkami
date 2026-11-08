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
//   <figure v-unfold="{ hinge: 'cupboard',      a picture printed across the faces (D17), folded
//     print: { image: url } }">                 inside the paper and unfolding out of it
//   <figure v-unfold="{ ..., still: seen }">    already seen: mounted flat, no motion, the
//                                              directive kept in the template
//
// The directive is a no-op on the server (getSSRProps) and under reduced motion; the fold is
// applied on mount, client only, so server HTML is flat. A printed picture is the driver's to
// paint, so where the directive would do nothing (reduced motion, a block on screen at
// hydration) it mounts the picture still instead. The opening waits for the picture to decode
// (`Handle.ready`). A target must not clip (orkami.css).
import type { Directive } from 'vue'
import type { Fold } from '../core/fold.ts'
import { lift, named, type Edge, type NamedFold } from '../core/folds/index.ts'
import { isImagePrint } from '../core/print.ts'
import type { StyleOverrides } from '../core/style.ts'
import { mount, type Handle, type MountOptions, type Print } from '../css/driver.ts'

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
  /** What is printed on the faces (the driver's `print`): 'landed', 'content' or `{ image }`. */
  print?: Print
  /** Mounts flat with no motion and never opens: a block the visitor has already seen. */
  still?: boolean
  /** Passed to the driver's `mount`. */
  mount?: Omit<MountOptions, 'delay' | 'style' | 'print' | 'still'>
}

/** Opens every handle once its print is ready; a picture that fails to decode is reported and the paper opens without it. */
export function openWhenReady(handles: Handle[]): Promise<void> {
  return Promise.all(handles.map(h => h.ready)).then(
    () => Promise.all(handles.map(h => h.open())).then(() => {}),
    (e: unknown) => { console.error('v-unfold: the print did not decode', e); return Promise.all(handles.map(h => h.open())).then(() => {}) },
  )
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
    const o = options(binding.value)
    const targets = binding.modifiers.stagger ? Array.from(el.children) as HTMLElement[] : [el]
    if (!targets.length) return
    const factory = foldFor(o.hinge)
    const step = o.step ?? 90
    const mountAll = (still: boolean) => targets.map((t, i) => mount(t, factory, { ...o.mount, style: o.style, print: o.print, still, delay: (o.delay ?? 0) + i * step }))
    /** Flat with no motion: the block stays bound, so it is destroyed with the element. */
    const stillAll = () => {
      const handles = mountAll(true)
      bound.set(el, { handles, open: () => {}, dispose: () => { for (const h of handles) h.destroy() } })
    }

    // Reduced motion and a block already on screen at hydration are left flat rather than folded
    // away in front of the visitor: untouched, unless a picture is printed, which only the driver paints
    const r = el.getBoundingClientRect()
    const onScreen = r.top < win.innerHeight && r.bottom > 0
    const flat = !!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches || onScreen && !binding.modifiers.always
    if (o.still || flat && isImagePrint(o.print)) { stillAll(); return }
    if (flat) return

    let state: 'folded' | 'open' = 'folded'
    const handles = mountAll(false)

    const open = () => {
      if (state === 'open') return
      state = 'open'
      void openWhenReady(handles)
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
