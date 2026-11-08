<script setup lang="ts">
// <FoldLoader :ready="loaded" @done="hide" />: a square of paper folding itself, one real fold
// after another meeting at flat (D18), until `ready`; then the fold it is in finishes, the paper
// lands flat and `done` is emitted. The flat sheet stays: the site removes the loader or lets the
// sheet become the page's background. Rendered only on the client (a server renders nothing, so
// with no JS it never shows), and not at all when `ready` comes within `skipWithin` ms. Under
// reduced motion the square lies flat and still, and `done` follows `ready` at once.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loop as makeLoop, loopSteps, LOOP_BASES } from '../core/loop.ts'
import type { NamedFold } from '../core/folds/index.ts'
import type { StyleOverrides } from '../core/style.ts'
import { mountLoop, type LoopHandle } from '../css/loop.ts'
import { loaderPlan, LOADER_MIN_MS, LOADER_SKIP_WITHIN, type LoaderPhase } from './loader.ts'

const props = withDefaults(defineProps<{
  ready: boolean
  /** The named folds played in turn; the square bases by default. */
  steps?: NamedFold[]
  /** The square's side, px. */
  size?: number
  minMs?: number
  skipWithin?: number
  /** Held at closed, ms (`loop`'s `hold`). */
  hold?: number
  /** Flat between steps, ms (`loop`'s `gap`). */
  gap?: number
  style?: StyleOverrides
  ariaLabel?: string
}>(), {
  steps: () => [...LOOP_BASES],
  size: 96,
  minMs: LOADER_MIN_MS,
  skipWithin: LOADER_SKIP_WITHIN,
  hold: undefined,
  gap: undefined,
  style: undefined,
  ariaLabel: 'Loading',
})

const emit = defineEmits<{ done: [] }>()

const phase = ref<LoaderPhase>('wait')
const paper = ref<HTMLElement | null>(null)
const shown = computed(() => phase.value === 'loop' || phase.value === 'stop')
let start = 0
let readyAt: number | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let handle: LoopHandle | undefined
let reduced = false
let finished = false

const clock = () => performance.now() - start
const finish = () => { if (!finished) { finished = true; emit('done') } }

const update = () => {
  if (timer) clearTimeout(timer)
  timer = undefined
  const plan = loaderPlan(readyAt, clock(), { minMs: reduced ? 0 : props.minMs, skipWithin: props.skipWithin })
  phase.value = plan.phase
  if (plan.next !== undefined) timer = setTimeout(update, Math.max(0, plan.next - clock()))
  if (plan.phase === 'skip') finish()
  else if (plan.phase === 'loop' && !handle) void nextTick(begin)
  else if (plan.phase === 'stop') {
    if (!handle) void nextTick(begin)
    void nextTick(() => (handle ? handle.stop() : Promise.resolve()).then(finish))
  }
}

/** Mounts the loop on the square once it is in the DOM, and starts it. */
const begin = () => {
  if (handle || !paper.value) return
  const lp = makeLoop(loopSteps(props.size, props.steps), { hold: props.hold, gap: props.gap })
  handle = mountLoop(paper.value, lp, { style: props.style })
  if (phase.value === 'loop') handle.start()
}

onMounted(() => {
  start = performance.now()
  reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (props.ready) readyAt = 0
  update()
})
watch(() => props.ready, (v) => {
  if (!v || readyAt !== undefined || !start) return
  readyAt = clock()
  update()
})
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  handle?.destroy()
  handle = undefined
})

defineExpose({ phase, handle: () => handle })
</script>

<template>
  <div v-if="shown" class="ori-loader" role="status" :aria-label="ariaLabel">
    <div ref="paper" class="ori-loader-paper" :style="{ width: `${size}px`, height: `${size}px` }" />
  </div>
</template>
