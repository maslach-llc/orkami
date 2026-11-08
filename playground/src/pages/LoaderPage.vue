<script setup lang="ts">
// A looping fold (D18): real folds on one square played in turn, meeting at flat. The first demo
// drives `mountLoop` directly (step picker, hold, slow clock, a stop that lands flat); the second
// is the <FoldLoader> component under a simulated load, so skipWithin and minMs can be seen.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loop, loopSteps, LOOP_BASES, LOOP_GAP, LOOP_HOLD, type Loop, type LoopAt, type NamedFold } from 'orkami'
import { mountLoop, type LoopHandle } from 'orkami/css'
import { FoldLoader, LOADER_MIN_MS, LOADER_SKIP_WITHIN } from 'orkami/vue'
import { FOLDS, tryFold } from '../shared'

const SIZE = 200
// The named folds that take a square: the picker's choices
const CHOICES = FOLDS.filter(n => !!tryFold(n, SIZE, SIZE).fold)

const picked = ref<NamedFold[]>([...LOOP_BASES])
const hold = ref(LOOP_HOLD)
const slow = ref(false)
function toggle(n: NamedFold) {
  const i = picked.value.indexOf(n)
  if (i >= 0) { if (picked.value.length > 1) picked.value = picked.value.filter(x => x !== n) }
  else picked.value = [...picked.value, n]
}

const stage = ref<HTMLElement | null>(null)
const status = ref('')
const error = ref('')
const live = ref<{ step: number; name: string; phase: string; t: number } | null>(null)
let handle: LoopHandle | undefined
let lp: Loop | undefined
let t0 = 0
const clock = () => performance.now() * (slow.value ? 0.25 : 1)

function start() {
  if (!handle || handle.running) return
  handle.start()
  t0 = clock()
  status.value = handle.running ? 'looping' : 'reduced motion: lying flat'
}

function rebuild() {
  handle?.destroy()
  handle = undefined
  lp = undefined
  error.value = ''
  if (!stage.value) return
  try {
    lp = loop(loopSteps(SIZE, picked.value), { hold: hold.value, gap: LOOP_GAP })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    return
  }
  // The handle captures this clock: a slow toggle rebuilds, so t0 and the clock always agree
  const k = slow.value ? 0.25 : 1
  handle = mountLoop(stage.value, lp, { now: () => performance.now() * k })
  start()
}

async function ready() {
  if (!handle?.running) return
  const h = handle
  status.value = 'landing...'
  await h.stop()
  if (h === handle) status.value = `landed flat at step ${h.step + 1} (${picked.value[h.step]})`
}

let raf = 0
function readout() {
  if (handle && lp) {
    const a: LoopAt | undefined = handle.running ? lp.at(clock() - t0) : undefined
    live.value = {
      step: handle.step,
      name: picked.value[handle.step] ?? '',
      phase: a ? a.phase : 'flat, still',
      t: handle.t,
    }
  } else live.value = null
  raf = requestAnimationFrame(readout)
}

onMounted(() => { rebuild(); raf = requestAnimationFrame(readout) })
watch([picked, hold, slow], rebuild)

// The component under a simulated load
const DELAYS = [0, 100, 1500, 4000]
const delay = ref(1500)
const loaderKey = ref(0)
const loaded = ref(false)
const log = ref<string[]>([])
let began = 0
let loadTimer: ReturnType<typeof setTimeout> | undefined
function loadAgain() {
  if (loadTimer) clearTimeout(loadTimer)
  loaded.value = false
  loaderKey.value++
  began = performance.now()
  const d = delay.value
  loadTimer = setTimeout(() => { loaded.value = true; note(`ready after ${d} ms`) }, d)
}
function note(s: string) { log.value = [`${Math.round(performance.now() - began)} ms: ${s}`, ...log.value].slice(0, 12) }
const onDone = () => note('done fired')
onMounted(loadAgain)

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  if (loadTimer) clearTimeout(loadTimer)
  handle?.destroy()
  handle = undefined
})

const holdLabel = computed(() => `${hold.value} ms`)
</script>

<template>
  <section>
    <h1>Loader</h1>
    <p class="pg-muted">A loop is real folds on one square, played whole one after another: each folds in, holds closed, unfolds, and rests flat before the next. Paper cannot morph from one base into another, so every step meets the next at the flat sheet, and that is where the flaps are swapped. Ready does not cut the motion: the fold that is playing finishes and the paper lands flat, never mid-fold.</p>

    <div class="pg-row loader-controls" role="group" aria-label="Steps">
      <span class="pg-muted">steps</span>
      <label v-for="n in CHOICES" :key="n" class="loader-step">
        <input type="checkbox" :checked="picked.includes(n)" @change="toggle(n)">
        {{ n }}<sup v-if="picked.includes(n)">{{ picked.indexOf(n) + 1 }}</sup>
      </label>
    </div>
    <div class="pg-row loader-controls">
      <label>hold <input v-model.number="hold" type="range" min="0" max="1000" step="10"> <code>{{ holdLabel }}</code></label>
      <button type="button" :aria-pressed="slow" @click="slow = !slow">slow</button>
      <button type="button" @click="ready">ready</button>
      <button type="button" @click="start">restart</button>
    </div>

    <div class="loader-stage">
      <div ref="stage" class="ori-loader-paper" :style="{ width: `${SIZE}px`, height: `${SIZE}px` }" />
    </div>
    <p v-if="error" class="pg-muted">{{ error }}</p>
    <p class="loader-readout">
      <template v-if="live">step <code>{{ live.step + 1 }}/{{ picked.length }}</code> <strong>{{ live.name }}</strong> · <code>{{ live.phase }}</code> · t <code>{{ live.t.toFixed(3) }}</code></template>
      <span class="pg-muted"> {{ status }}</span>
    </p>

    <h2>&lt;FoldLoader&gt;</h2>
    <p class="pg-muted">The component under a simulated load. Ready within {{ LOADER_SKIP_WITHIN }} ms (skipWithin) and nothing renders at all; once shown it stays at least {{ LOADER_MIN_MS }} ms (minMs) so it never flashes, then lands flat and emits done.</p>
    <div class="pg-row loader-controls">
      <label>load takes <select v-model.number="delay"><option v-for="d in DELAYS" :key="d" :value="d">{{ d }} ms</option></select></label>
      <button type="button" @click="loadAgain">load again</button>
      <code>ready = {{ loaded }}</code>
    </div>
    <div class="loader-stage loader-stage-small">
      <FoldLoader :key="loaderKey" :ready="loaded" @done="onDone" />
    </div>
    <ul class="loader-log">
      <li v-for="(l, i) in log" :key="i"><code>{{ l }}</code></li>
    </ul>
  </section>
</template>

<style>
.loader-controls { margin: 12px 0; }
.loader-step { white-space: nowrap; }
.loader-step sup { color: var(--pg-accent); margin-left: 2px; }
.loader-stage { min-height: 320px; display: grid; place-items: center; padding: 40px 0; }
.loader-stage-small { min-height: 180px; padding: 20px 0; }
.loader-readout { text-align: center; min-height: 1.5em; }
.loader-log { list-style: none; padding: 0; margin: 0; font-size: 13px; }
</style>
