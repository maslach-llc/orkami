<script setup lang="ts">
// The wordmark unfolding in 3D, like a strip of paper. Every facet is a real paper face (a
// clipped div with a front and a back) hanging off its parent facet on the crease they share.
// Folded, a facet lies flat on the facet before it, back side up; opening, it swings 180
// degrees about the crease, toward the viewer, so what you see is the back of the paper
// coming over and its face landing in place. The parent's wrapper carries the fold, the
// child's wrapper sits inside it, so a crease opening carries everything folded beyond it.
// The first facet of the mark lies on the page itself, folded over on its left edge: the
// whole lockup lifts off the sheet there, paper back (the page's own paper) first, and the
// creases open out of that turn.
//
// Letters open together: each letter is folded back over the one before it on a crease in
// the gap between them, and all of them start within a few frames of each other, their own
// creases following; the whole word is moving at once and settles in about a second.
//
// The resting state is the same lockup OrigamiWord draws flat. `autoplay` starts the unfold
// on mount (after `delay` ms); `play()` runs it again; `show()` opens it with no animation.
// Folded faces are hidden, so a visitor who never gets the animation (reduced motion, no JS)
// sees the flat lockup, forced by CSS.
import { layout, type PlacedFacet, type Pt } from '~/utils/origami'

const props = withDefaults(defineProps<{
  text?: string
  label?: string
  autoplay?: boolean
  /** ms before an autoplay starts, so the page can settle first. */
  delay?: number
  /** ms between one letter starting and the next. */
  letterStep?: number
  /** ms between one crease of a letter opening and the next. */
  step?: number
  /** ms one crease takes to open. */
  duration?: number
}>(), { text: 'MASLACH', label: 'Maslach', autoplay: true, delay: 200, letterStep: 70, step: 60, duration: 760 })

const emit = defineEmits<{ done: [] }>()

const word = computed(() => layout(props.text))
const W = computed(() => word.value.width)
const H = computed(() => word.value.height)
const pct = (n: number, of: number) => `${Math.round((n / of) * 10000) / 100}%`

interface Face {
  key: string
  f: PlacedFacet
  children: Face[]
  /** Start of this crease's opening, ms from play(). */
  at: number
  /** The crease this face swings on, in word space. */
  hinge: [Pt, Pt]
}

const tree = computed(() => {
  const roots: Face[] = []
  const byLetter = new Map<number, Face[]>()
  let total = 0
  for (const f of word.value.facets) {
    const at = f.letter * props.letterStep + f.index * props.step
    let hinge = f.hingeAbs
    if (f.parent < 0 && f.letter > 0) {
      // A letter's root folds over the letter before it, on a crease in the gap between them
      const l = word.value.letters[f.letter]!, p = word.value.letters[f.letter - 1]!
      const x = (p.x + p.width + l.x) / 2
      hinge = [[x, 0], [x, H.value]]
    }
    const face: Face = { key: `${f.letter}-${f.index}`, f, children: [], at, hinge }
    const list = byLetter.get(f.letter) ?? []
    list.push(face)
    byLetter.set(f.letter, list)
    if (f.parent < 0) roots.push(face)
    else list[f.parent]!.children.push(face)
    total = Math.max(total, at + props.duration)
  }
  return { roots, total }
})

// Hinge: the wrapper rotates about the crease (transform-origin at A, axis A->B), the axis
// pointed so the face swings toward the viewer: for rotate3d(x, y, 0, a) a point p relative
// to the origin rises by (x*py - y*px) sin a, so flip the axis when that is negative at the
// facet's centroid.
function hingeStyle(face: Face) {
  const [a, b] = face.hinge
  let dx = b[0] - a[0], dy = b[1] - a[1]
  const c = centroid(face.f.abs)
  if (dx * (c[1] - a[1]) - dy * (c[0] - a[0]) < 0) { dx = -dx; dy = -dy }
  return {
    '--hx': String(dx),
    '--hy': String(dy),
    '--at': `${face.at}ms`,
    'transform-origin': `${pct(a[0], W.value)} ${pct(a[1], H.value)}`,
  }
}
const centroid = (pts: Pt[]) => pts.reduce<Pt>((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0])

// The face: a div the size of the facet's bounding box, clipped to the polygon, so its
// gradients span the facet the way they do in the SVG. The back is the same box, its clip
// mirrored, turned 180 degrees about its own vertical axis so it lands on the front's
// footprint facing the other way.
function faceStyle(face: Face, back = false) {
  const pts = face.f.abs
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0
  const poly = pts.map(p => `${pct(back ? w - (p[0] - x0) : p[0] - x0, w)} ${pct(p[1] - y0, h)}`).join(',')
  const style: Record<string, string> = {
    'left': pct(x0, W.value), 'top': pct(y0, H.value), 'width': pct(w, W.value), 'height': pct(h, H.value),
    'clip-path': `polygon(${poly})`,
    '--fill': `var(--ori-${face.f.slot})`,
    '--at': `${face.at}ms`,
  }
  if (!face.f.lit && !back) {
    // Crease shadow: from the hinge toward the facet's centroid, as a CSS angle (0deg = up)
    const [a, b] = face.f.hingeAbs
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const c = centroid(pts)
    const ang = Math.atan2(c[0] - mid[0], -(c[1] - mid[1])) * 180 / Math.PI
    style['--crease'] = `${Math.round(ang)}deg`
  }
  return style
}
const backStyle = (face: Face) => faceStyle(face, true)

const open = ref(false)
const playing = ref(false)
// Open with no animation, for a wordmark that is already unfolded somewhere else on the page
const instant = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function show() {
  if (import.meta.server) return
  clearTimeout(timer)
  playing.value = false
  instant.value = true
  open.value = true
  requestAnimationFrame(() => requestAnimationFrame(() => { instant.value = false }))
}

function play() {
  if (import.meta.server) return
  clearTimeout(timer)
  playing.value = true
  open.value = false
  // Two frames folded, so the transitions restart from the folded state
  requestAnimationFrame(() => requestAnimationFrame(() => {
    open.value = true
    timer = setTimeout(() => { playing.value = false; emit('done') }, tree.value.total)
  }))
}

// Without JavaScript nothing ever opens the creases, so the flat lockup is forced instead
useHead({ noscript: [{ key: 'origami-flat', innerHTML: '<style>.origami-unfold .hinge{transform:none!important;visibility:visible!important}</style>' }] })

onMounted(() => {
  if (!props.autoplay) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { open.value = true; return }
  timer = setTimeout(play, props.delay)
})
onBeforeUnmount(() => clearTimeout(timer))
defineExpose({ play, show, playing, open })
</script>

<template>
  <div
    class="origami-unfold"
    :class="{ open, playing, instant }"
    :style="{ 'aspect-ratio': `${W} / ${H}`, '--dur': `${duration}ms` }"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  >
    <template v-for="root in tree.roots" :key="root.key">
      <OrigamiUnfoldFace :face="root" :hinge="hingeStyle" :face-style="faceStyle" :back-style="backStyle" />
    </template>
  </div>
</template>

<style>
/* Unscoped: the faces are rendered by a recursive child component. */
.origami-unfold {
  --dur: 760ms;
  position: relative; width: 100%;
  perspective: 1400px; perspective-origin: 50% 40%;
  transform-style: preserve-3d;
}
.origami-unfold .hinge {
  position: absolute; inset: 0;
  transform-style: preserve-3d;
  transform: rotate3d(var(--hx), var(--hy), 0, 180deg);
  visibility: hidden;
  /* Paper swings over fast and settles into flat */
  transition: transform var(--dur) cubic-bezier(.4, .1, .2, 1) var(--at), visibility 0s linear var(--at);
}
/* Folding back (before a replay) is instant; only the opening is animated */
.origami-unfold:not(.open) .hinge, .origami-unfold.instant .hinge, .origami-unfold.instant .face { transition: none; }
.origami-unfold.open .hinge { transform: rotate3d(var(--hx), var(--hy), 0, 0deg); visibility: visible; }
.origami-unfold .face, .origami-unfold .back {
  position: absolute;
  backface-visibility: hidden;
  background-color: var(--fill);
  background-image:
    var(--ori-grain),
    linear-gradient(to bottom, rgb(255 255 255 / .22), rgb(255 255 255 / 0) 50%, rgb(0 0 0 / .12));
  background-blend-mode: multiply, normal;
  background-size: 96px 96px, 100% 100%;
}
.origami-unfold .face {
  filter: drop-shadow(0 10px 10px rgb(0 0 0 / .16)) drop-shadow(0 2px 2px rgb(0 0 0 / .14)) brightness(1);
  transition: filter var(--dur) ease-out var(--at);
}
.origami-unfold .face.shade {
  background-image:
    var(--ori-grain),
    linear-gradient(var(--crease), rgb(0 0 0 / .46), rgb(0 0 0 / .1) 60%, rgb(0 0 0 / .18));
}
/* The back of the paper: the page's own sheet, unprinted, in the shade of the turn */
.origami-unfold .back {
  transform: rotateY(180deg);
  background-color: var(--ori-paper-back, color-mix(in srgb, var(--fill) 62%, #fff));
  background-image:
    var(--ori-grain),
    linear-gradient(to bottom, var(--ori-paper-shade), rgb(0 0 0 / .22));
}
/* While a crease opens, the face comes out of shadow */
.origami-unfold.playing:not(.open) .face { filter: drop-shadow(0 0 0 rgb(0 0 0 / 0)) brightness(.55); }
@media (prefers-reduced-motion: reduce) {
  .origami-unfold .hinge { transform: none !important; visibility: visible !important; transition: none !important; }
  .origami-unfold .face { transition: none !important; }
}
</style>
