<script setup lang="ts">
// <Unfold3D fold="MASLACH" />: a fold unfolding as lit paper in WebGL (orkami/three), then lying
// flat as its fallback. `fold` is a `Fold`, a named fold's key (sized to the element's box) or a
// word for the glyphs (`wordFold`, whose flat fallback is the `Word` SVG unless the `flat` slot
// gives one). The canvas exists only while the unfold plays (D16): it is laid over the flat
// fallback with a bleed, the fallback hidden under it, and at the landing the canvas fades out
// over the fallback, which matches it, and the WebGL context is freed. Reduced motion, no WebGL
// and no JavaScript all show the flat fallback. three.js is imported on the first play, so a page
// that never plays never loads it. Emits `done` at the landing. `print` prints a picture across
// the fronts (D17; the play waits for it to load), and its flat fallback is that picture placed as
// the paper lands it; `still` shows the flat fallback with no motion (a visitor who has seen it).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { Fold } from '../core/fold.ts'
import { named, type NamedFold } from '../core/folds/index.ts'
import type { ImagePrint } from '../core/print.ts'
import type { Schedule } from '../core/schedule.ts'
import type { Style, StyleOverrides } from '../core/style.ts'
import { wordFold } from '../glyphs/layout.ts'
import type { Palette, PaintFn } from '../three/scene.ts'
import Word from './Word.vue'

const props = withDefaults(defineProps<{
  fold?: Fold | NamedFold | string
  palette?: Palette | PaintFn
  style?: Style | StyleOverrides
  /** ms before an autoplay starts, so the page can settle first. */
  delay?: number
  /** ms the whole unfold takes; the schedule's own length by default. */
  duration?: number
  schedule?: Schedule
  /** Plays on mount; false shows the flat fallback until `play()`. */
  autoplay?: boolean
  /** Accessible name; empty hides it from assistive tech. */
  label?: string
  /** A picture printed across the fronts, in sheet coordinates. */
  print?: ImagePrint
  /** Shows the flat fallback with no motion; `play()` still plays. */
  still?: boolean
}>(), { fold: 'MASLACH', palette: undefined, style: undefined, delay: 200, duration: undefined, schedule: undefined, autoplay: true, label: '', print: undefined, still: false })

const emit = defineEmits<{ done: [] }>()

/** The printed picture as the flat fallback: placed as the paper lands it (`printRect`'s fit and position). */
const printStyle = computed(() => {
  const p = props.print
  if (!p) return undefined
  const [x, y] = p.position ?? [0.5, 0.5]
  return { objectFit: p.fit ?? 'cover', objectPosition: `${x * 100}% ${y * 100}%` }
})

const isNamed = (f: unknown): f is NamedFold => typeof f === 'string' && Object.prototype.hasOwnProperty.call(named, f)
/** The word, when the fold is one. */
const word = computed(() => typeof props.fold === 'string' && !isNamed(props.fold) ? props.fold : '')

const box = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const playing = ref(false)
const landing = ref(false)
/** The flat fallback is showing (landed, or never played). */
const open = ref(!props.autoplay)
const frame = ref<{ left: number; top: number; width: number; height: number } | null>(null)
const canvasStyle = computed(() => frame.value && {
  left: `${frame.value.left}px`, top: `${frame.value.top}px`, width: `${frame.value.width}px`, height: `${frame.value.height}px`,
})
// Without JavaScript nothing plays: the flat fallback is forced visible
const noscript = '<style>.ori-3d .ori-3d-flat{visibility:visible!important}</style>'

type Three = typeof import('../three/index.ts')
let three: Three | undefined
const scene = shallowRef<{ stage: ReturnType<Three['stage']>; handle: ReturnType<Three['buildFold']> } | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

function resolveFold(): Fold {
  const f = props.fold
  if (typeof f !== 'string') return f
  if (isNamed(f)) return named[f](box.value?.offsetWidth || 300, box.value?.offsetHeight || 300)
  return wordFold(f)
}

function teardown() {
  scene.value?.stage.stop()
  scene.value?.handle.dispose()
  scene.value?.stage.dispose()
  scene.value = null
}

/** Shows the flat fallback with no motion. */
function show() {
  clearTimeout(timer)
  teardown()
  playing.value = false
  landing.value = false
  open.value = true
}

/** Plays the unfold from closed; falls back to the flat state when WebGL is not available. */
async function play() {
  clearTimeout(timer)
  teardown()
  landing.value = false
  open.value = false
  const el = box.value
  if (!el) return
  try {
    three ??= await import('../three/index.ts')
  } catch { show(); return }
  const fold = resolveFold()
  // The tones as the page computes them here: a host's tokens (var(), color-mix()) become numbers
  let style: Style, palette: Palette | PaintFn | undefined
  try {
    style = three.resolveStyle(props.style, el)
    palette = props.palette && typeof props.palette !== 'function' ? three.resolvePalette(props.palette, el) : props.palette
  } catch (e) { console.error(e); show(); return }
  const W = fold.sheet.width, H = fold.sheet.height
  const scale = el.clientWidth / W || 1
  const [bx, by] = three.bleedFor(fold, { style, schedule: props.schedule })
  frame.value = { left: -bx * scale, top: -by * scale, width: (W + 2 * bx) * scale, height: (H + 2 * by) * scale }
  playing.value = true
  await nextTick()
  if (!canvas.value || !playing.value) return
  try {
    const stage = three.stage(canvas.value, { width: W, height: H, bleed: [bx, by], style })
    const handle = three.buildFold(fold, { style, palette, schedule: props.schedule, ...(props.print ? { print: props.print } : {}) })
    stage.add(handle)
    // The drawing buffer at the canvas's rendered size: a box scaled by a transform (a lockup
    // growing into a hero) draws at the size it shows, not its layout size
    const shown = canvas.value.getBoundingClientRect()
    stage.resize(shown.width || frame.value.width, shown.height || frame.value.height)
    scene.value = { stage, handle }
  } catch { show(); return }
  const { stage, handle } = scene.value
  // The picture loaded before the paper moves; one that fails is reported and the flat fallback shown
  try { await handle.ready } catch (e) { console.error('Unfold3D: the print did not load', e); show(); return }
  if (scene.value?.handle !== handle) return
  stage.render()
  await stage.play(handle, props.duration ?? handle.schedule.total)
  if (scene.value?.handle !== handle) return
  // Landed: the flat fallback takes over under a short cross-fade, and the canvas goes
  open.value = true
  landing.value = true
  emit('done')
  timer = setTimeout(() => { teardown(); playing.value = false; landing.value = false }, 320)
}

onMounted(() => {
  if (props.still) { open.value = true; return }
  if (!props.autoplay) return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { open.value = true; return }
  timer = setTimeout(() => { void play() }, props.delay)
})
onBeforeUnmount(() => { clearTimeout(timer); teardown() })

defineExpose({ play, show, playing, open })
</script>

<template>
  <div
    ref="box"
    class="ori-3d"
    :class="{ playing, landing }"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  >
    <div class="ori-3d-flat" :class="{ hidden: !open }">
      <slot name="flat">
        <Word v-if="word" :text="word" :style="style" />
        <img v-else-if="print" class="ori-3d-print" :src="print.image" alt="" :style="printStyle">
      </slot>
    </div>
    <canvas v-if="playing" ref="canvas" class="ori-3d-scene" aria-hidden="true" :style="canvasStyle" />
    <noscript v-html="noscript" />
  </div>
</template>

<style>
.ori-3d { position: relative; }
.ori-3d-flat.hidden { visibility: hidden; }
.ori-3d-print { display: block; width: 100%; height: 100%; }
.ori-3d-scene { position: absolute; pointer-events: none; }
.ori-3d.landing .ori-3d-scene { opacity: 0; transition: opacity .3s ease; }
</style>
