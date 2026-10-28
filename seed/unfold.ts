// v-unfold: a block lies folded over its neighbor, back side up, and unfolds out of it when it
// scrolls into view, the origami motion of the brand (styles in assets/css/origami.css). The
// paper back is painted with the page's sheet (utils/sheetPaint.ts), so a folded block is the
// background until it moves.
//
//   <section v-unfold>                         a flap of the page lifting out of the
//                                              background on its top crease (the default,
//                                              "lift")
//   <aside v-unfold="'left'">                  folded 180 degrees over on its left edge and
//                                              swinging out, paper back first ('top',
//                                              'bottom', 'right' likewise)
//   <ul v-unfold.stagger>                      each child lifts in turn, 90ms apart
//   <ul v-unfold.stagger="{ hinge: 'left', step: 60 }">
//                                              each child unfolds out of the one before it
//   <div v-unfold="'blintz'">                  a square of paper with its corners folded to
//                                              the center, lying in the page as the diamond
//                                              between them, opening out into the block;
//                                              'diagonal' is one half folded over the other.
//                                              The content prints once the paper is flat.
//   <ul v-unfold.stagger.refold>               folds back once it is more than a screen away,
//                                              and unfolds again on the way back
//   <ol v-unfold.always="{ open: ready }">     opens when `open` turns true instead of on
//                                              scroll (the hero's rows, once the wordmark has
//                                              landed)
//
// v-sheet="'face'" paints an element with the sheet under it (.ori-paper) and keeps the paint
// in place as the page scrolls; 'top' | 'bottom' | 'left' | 'right' places it for a paper back
// inside a block folded on that hinge (see sheetPaint.ts).
//
// Registered on both sides so server rendering resolves the directives; the fold itself is
// applied on mount, client only, so server HTML is flat; anything already on
// screen when the page hydrates stays flat too (no flash of content folding away), unless
// `.always` is set. Reduced motion skips the fold entirely. A target must not clip (see the
// note in origami.css): the directive does not rearrange the DOM to work around it.
import { measureSheet, trackSheet, type SheetMode } from '~/utils/sheetPaint'

type Hinge = 'lift' | 'top' | 'bottom' | 'left' | 'right' | 'blintz' | 'diagonal'
interface Options { hinge?: Hinge, step?: number, delay?: number, open?: boolean }

const HINGES: Hinge[] = ['lift', 'top', 'bottom', 'left', 'right', 'blintz', 'diagonal']
// The quad folds (origami.css 2d): the block is a square of paper folded in on itself
const QUADS: Hinge[] = ['blintz', 'diagonal']

type Pt = [number, number]
// An affine map as CSS matrix(a, b, c, d, e, f): (x, y) -> (ax + cy + e, bx + dy + f)
type M = [number, number, number, number, number, number]
const compose = (p: M, q: M): M => [
  p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1],
  p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3],
  p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5],
]
// Reflection across the line through h along the unit direction u
function reflect([hx, hy]: Pt, [ux, uy]: Pt): M {
  const a = 2 * ux * ux - 1, b = 2 * ux * uy, d = 2 * uy * uy - 1
  return [a, b, b, d, hx - (a * hx + b * hy), hy - (b * hx + d * hy)]
}

const poly = (pts: Pt[]) => `polygon(${pts.map(([x, y]) => `${x}px ${y}px`).join(', ')})`
const svgNS = 'http://www.w3.org/2000/svg'

// The paper of a quad fold: one flap per folded corner, each a triangle on its crease with a
// front (the block's face) and a back (the sheet under it, reflected across the crease so
// that, lying folded, it is the page); plus the creases, which stay once the block is open.
// Returns the flaps, for the landing.
function paper(t: HTMLElement, hinge: 'blintz' | 'diagonal', step: number, face: string | undefined) {
  t.querySelector(':scope > .ori-fold')?.remove()
  const W = t.offsetWidth, H = t.offsetHeight
  const flaps: { tri: Pt[], hinge: [Pt, Pt] }[] = hinge === 'blintz'
    ? [
        { tri: [[0, 0], [W / 2, 0], [0, H / 2]], hinge: [[W / 2, 0], [0, H / 2]] },
        { tri: [[W, 0], [W, H / 2], [W / 2, 0]], hinge: [[W / 2, 0], [W, H / 2]] },
        { tri: [[W, H], [W / 2, H], [W, H / 2]], hinge: [[W, H / 2], [W / 2, H]] },
        { tri: [[0, H], [0, H / 2], [W / 2, H]], hinge: [[0, H / 2], [W / 2, H]] },
      ]
    : [{ tri: [[W, 0], [W, H], [0, H]], hinge: [[0, H], [W, 0]] }]

  const fold = document.createElement('div')
  fold.className = 'ori-fold'
  fold.setAttribute('aria-hidden', 'true')
  const els = flaps.map((f, i) => {
    const [[x1, y1], [x2, y2]] = f.hinge
    const len = Math.hypot(x2 - x1, y2 - y1)
    let ux = (x2 - x1) / len, uy = (y2 - y1) / len
    // The axis points so that a positive angle lifts the corner toward the visitor
    const [cx, cy] = f.tri[0]!
    if (ux * (cy - y1) - uy * (cx - x1) < 0) { ux = -ux; uy = -uy }
    const flap = document.createElement('div')
    flap.className = 'flap'
    flap.style.transformOrigin = `${x1}px ${y1}px`
    flap.style.setProperty('--ori-ux', String(ux))
    flap.style.setProperty('--ori-uy', String(uy))
    // The corners open one after another, a third of the stagger apart
    flap.style.transitionDelay = `calc(var(--ori-delay) + ${Math.round(i * step / 3)}ms)`

    const front = document.createElement('div')
    front.className = face ? 'side front' : 'side front ori-paper'
    front.style.clipPath = poly(f.tri)
    if (face) front.style.background = face

    // The back is seen through rotateY(180deg): its clip is the mirror image, and the sheet on
    // it is placed so that, folded (reflected across the crease, mirrored), it shows the page
    const back = document.createElement('div')
    back.className = 'side back'
    back.style.clipPath = poly(f.tri.map(([x, y]) => [W - x, y]))
    const ink = document.createElement('div')
    ink.className = 'ink ori-paper'
    const mirror: M = [-1, 0, 0, 1, W, 0]
    const [a, b, c, d, e, g] = compose(mirror, reflect([x1, y1], [ux, uy]))
    ink.style.transformOrigin = `${W}px ${H}px`
    ink.style.transform = `matrix(${[a, b, c, d, e, g].map(n => n.toFixed(5)).join(', ')})`
    ink.style.backgroundPosition = `calc(var(--ori-sx, 0px) + ${W}px) calc(var(--ori-sy, 0px) + ${H}px)`
    back.append(ink)
    flap.append(front, back)
    return flap
  })

  // The creases, drawn once at this size and scaling with the block
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('class', 'creases')
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.setAttribute('preserveAspectRatio', 'none')
  const shape = (pts: Pt[], fill: string) => {
    const p = document.createElementNS(svgNS, 'polygon')
    p.setAttribute('points', pts.map(([x, y]) => `${x},${y}`).join(' '))
    p.setAttribute('fill', fill)
    svg.append(p)
  }
  // The folded paper's footprint is a shade darker, the corners a shade lighter, the sheet's tones
  if (hinge === 'blintz') {
    shape([[W / 2, 0], [W, H / 2], [W / 2, H], [0, H / 2]], 'rgb(0 0 0 / .02)')
    for (const f of flaps) shape(f.tri, 'rgb(255 255 255 / .025)')
  }
  else {
    shape(flaps[0]!.tri, 'rgb(0 0 0 / .02)')
  }
  for (const f of flaps) {
    const l = document.createElementNS(svgNS, 'line')
    const [[x1, y1], [x2, y2]] = f.hinge
    l.setAttribute('x1', String(x1)); l.setAttribute('y1', String(y1))
    l.setAttribute('x2', String(x2)); l.setAttribute('y2', String(y2))
    l.setAttribute('stroke', 'rgb(0 0 0 / .07)')
    l.setAttribute('vector-effect', 'non-scaling-stroke')
    svg.append(l)
  }
  fold.append(svg, ...els)
  t.prepend(fold)
  return els
}

// A lifting flap with no background of its own is painted with the sheet, so it is the page's
// own paper coming up (a card keeps its card)
function bare(t: HTMLElement) {
  const cs = getComputedStyle(t)
  return cs.backgroundImage === 'none' && cs.backgroundColor === 'rgba(0, 0, 0, 0)'
}

export default defineNuxtPlugin((nuxtApp) => {
  let io: IntersectionObserver | undefined
  let away: IntersectionObserver | undefined
  const pending = new WeakMap<Element, () => void>()
  const refolds = new WeakMap<Element, () => void>()
  // Blocks that open on a signal: their open function, for the updated hook
  const signalled = new WeakMap<Element, () => void>()
  // Each block's sheet paint, let go of when it leaves the page
  const releases = new WeakMap<Element, () => void>()

  // Opens once the element is (a little) on screen
  function observe(el: Element, open: () => void) {
    io ??= new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        io!.unobserve(e.target)
        pending.get(e.target)?.()
        pending.delete(e.target)
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
    pending.set(el, open)
    io.observe(el)
  }

  // .refold: watches with a margin of one viewport, so leaving it means more than a screen away
  function watchAway(el: Element, refold: () => void) {
    away ??= new IntersectionObserver((entries) => {
      for (const e of entries) if (!e.isIntersecting) refolds.get(e.target)?.()
    }, { rootMargin: '100% 0px', threshold: 0 })
    refolds.set(el, refold)
    away.observe(el)
  }

  const opts = (value: Hinge | Options | undefined): Options => typeof value === 'string' ? { hinge: value } : (value ?? {})

  nuxtApp.vueApp.directive<HTMLElement, Hinge | Options | undefined>('unfold', {
    mounted(el, binding) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const o = opts(binding.value)
      const targets = binding.modifiers.stagger ? Array.from(el.children) as HTMLElement[] : [el]
      if (!targets.length) return

      // Already on screen at hydration: leave it flat rather than fold it away in front of the visitor
      const r = el.getBoundingClientRect()
      const onScreen = r.top < window.innerHeight && r.bottom > 0
      if (onScreen && !binding.modifiers.always) return

      const hinge = HINGES.includes(o.hinge!) ? o.hinge! : 'lift'
      const step = o.step ?? 90
      let state: 'folded' | 'open' = 'folded'
      let landed: AbortController | undefined
      const untrack = new Map<HTMLElement, () => void>()
      const release = (t: HTMLElement) => { untrack.get(t)?.(); untrack.delete(t) }

      // Folding is instant (only the opening is animated): a block folded where the visitor can
      // see it (`.always`) would otherwise swing half shut and back before it opens
      const quad = QUADS.includes(hinge)
      const flaps = new Map<HTMLElement, HTMLElement[]>()
      const fold = () => {
        targets.forEach((t, i) => {
          t.style.setProperty('transition', 'none', 'important')
          t.classList.remove('is-open', 'is-landed')
          t.dataset.unfold = hinge
          t.style.setProperty('--ori-delay', `${(o.delay ?? 0) + i * step}ms`)
          // The paper (a lifting flap's face, a folded block's back) is the sheet where it lies,
          // until it has landed
          release(t)
          if (quad) {
            const els = paper(t, hinge as 'blintz' | 'diagonal', step, bare(t) ? undefined : getComputedStyle(t).backgroundColor)
            els.forEach(f => f.style.setProperty('transition', 'none', 'important'))
            flaps.set(t, els)
            untrack.set(t, trackSheet(t, 'face'))
          }
          else if (hinge === 'lift') {
            if (!bare(t)) return
            t.classList.add('ori-paper')
            const stop = trackSheet(t, 'face')
            untrack.set(t, () => { stop(); t.classList.remove('ori-paper') })
          }
          else {
            untrack.set(t, trackSheet(t, hinge))
          }
        })
        void el.offsetWidth
        targets.forEach((t) => {
          t.style.removeProperty('transition')
          flaps.get(t)?.forEach(f => f.style.removeProperty('transition'))
        })
      }
      const open = () => {
        if (state === 'open') return
        state = 'open'
        landed = new AbortController()
        targets.forEach((t) => {
          t.classList.add('is-open')
          if (quad) {
            // The paper lies flat once its last flap has: the content prints on it and the
            // paper stays as the block's creases
            let left = flaps.get(t)!.length
            t.addEventListener('transitionend', (e) => {
              if (!(e.target as HTMLElement).classList?.contains('flap') || e.propertyName !== '--ori-a' || --left) return
              t.classList.add('is-landed')
              t.querySelector(':scope > .ori-fold')?.classList.add('flat')
              release(t)
            }, { signal: landed!.signal })
            return
          }
          // Once a target has landed, the folded rules (and its paper back) no longer apply: drop the attribute
          t.addEventListener('transitionend', (e) => {
            if (e.target !== t || (e.propertyName !== 'transform' && e.propertyName !== '--ori-a')) return
            delete t.dataset.unfold
            t.classList.remove('is-open')
            t.style.removeProperty('--ori-delay')
            release(t)
          }, { signal: landed!.signal })
        })
      }

      fold()
      releases.set(el, () => targets.forEach((t) => {
        release(t)
        t.querySelector(':scope > .ori-fold')?.remove()
      }))
      if ('open' in o) {
        signalled.set(el, open)
        if (o.open) requestAnimationFrame(open)
      }
      else {
        observe(el, open)
      }
      if (binding.modifiers.refold) {
        watchAway(el, () => {
          if (state !== 'open') return
          state = 'folded'
          landed?.abort()
          fold()
          observe(el, open)
        })
      }
    },
    updated(el, binding) {
      if (opts(binding.value).open) signalled.get(el)?.()
    },
    unmounted(el) {
      io?.unobserve(el)
      away?.unobserve(el)
      pending.delete(el)
      refolds.delete(el)
      signalled.delete(el)
      releases.get(el)?.()
      releases.delete(el)
    },
    getSSRProps: () => ({}),
  })

  const sheets = new WeakMap<Element, () => void>()
  nuxtApp.vueApp.directive<HTMLElement, SheetMode>('sheet', {
    mounted(el, binding) {
      sheets.set(el, trackSheet(el, binding.value))
      // Fonts and images still landing move the page under it
      requestAnimationFrame(measureSheet)
    },
    unmounted(el) {
      sheets.get(el)?.()
      sheets.delete(el)
    },
    getSSRProps: () => ({}),
  })
})
