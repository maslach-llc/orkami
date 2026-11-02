<script setup lang="ts">
// One fold under a t slider (the Origami Simulator idea), with a schedule switch and every
// crease's angle printed, so a fold can be inspected at any moment. The CSS driver draws it.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { pose, sequence, together, treeCreases, type NamedFold, type Schedule } from 'orkami'
import { mount, type Handle } from 'orkami/css'
import CreasePattern from '../components/CreasePattern.vue'
import { deg, FOLDS, SHAPES, tryFold, type Shape } from '../shared'

const name = ref<NamedFold>('blintz')
const shape = ref<Shape>('square')
const mode = ref<'own' | 'together' | 'sequence'>('own')
const t = ref(0.5)
const S = 1.5
const size = computed(() => SHAPES[shape.value].map(v => v * S) as [number, number])
const built = computed(() => tryFold(name.value, ...size.value))
const coupled = computed(() => (built.value.fold?.closures?.length ?? 0) > 0)
const schedule = computed<Schedule | undefined>(() => {
  const f = built.value.fold
  if (!f) return undefined
  if (mode.value === 'together' || (mode.value === 'sequence' && coupled.value)) return together(f)
  if (mode.value === 'sequence') return sequence(f, treeCreases(f).map(c => c.id))
  return f.schedule ?? together(f)
})
const angles = computed(() => {
  const f = built.value.fold
  if (!f || !schedule.value) return []
  const p = pose(f, t.value, schedule.value)
  return f.creases.map(c => ({ id: c.id, assignment: c.assignment, closing: !!c.closing, angle: p.angles[c.id] ?? 0 }))
})

const host = ref<HTMLElement | null>(null)
let handle: Handle | undefined
function remount() {
  handle?.destroy()
  handle = undefined
  const f = built.value.fold
  if (!f || !host.value) return
  handle = mount(host.value, f, { schedule: schedule.value, at: t.value, drive: 'frame' })
}
onMounted(remount)
onBeforeUnmount(() => handle?.destroy())
watch([built, schedule], () => requestAnimationFrame(remount))
watch(t, v => handle?.set(v))
watch(name, n => { if (n === 'waterbomb' || n === 'preliminary' || n === 'kite' || n === 'blintz' || n === 'diagonal') shape.value = 'square' })

let raf = 0
function play() {
  cancelAnimationFrame(raf)
  const from = t.value, to = from < 0.5 ? 1 : 0
  const total = schedule.value?.total ?? 640
  const t0 = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / total)
    t.value = from + (to - from) * k
    if (k < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <section>
    <h1>Sequence</h1>
    <p class="pg-muted">One fold at any moment: t = 0 is closed, t = 1 lies flat. "Own" is the fold's built-in schedule; "sequence" opens the creases one after another (a coupled base always takes them together, D10).</p>
    <div class="pg-row seq-controls">
      <label>fold <select v-model="name"><option v-for="f in FOLDS" :key="f" :value="f">{{ f }}</option></select></label>
      <label>shape <select v-model="shape"><option v-for="(_, s) in SHAPES" :key="s" :value="s">{{ s }}</option></select></label>
      <div class="pg-row" role="group" aria-label="Schedule">
        <button v-for="m in (['own', 'together', 'sequence'] as const)" :key="m" type="button" :aria-pressed="mode === m" :disabled="m === 'sequence' && coupled" @click="mode = m">{{ m }}</button>
      </div>
      <label>t <input v-model.number="t" type="range" min="0" max="1" step="0.001"> <code>{{ t.toFixed(3) }}</code></label>
      <button type="button" @click="play">{{ t < 0.5 ? 'unfold' : 'fold' }}</button>
    </div>
    <div class="seq-body">
      <div class="seq-stage">
        <div v-if="built.fold" :key="`${name}-${shape}`" ref="host" class="pg-card seq-block" :style="{ width: `${size[0]}px`, height: `${size[1]}px` }" />
        <p v-else class="pg-muted">{{ built.error }}</p>
      </div>
      <div v-if="built.fold" class="seq-side">
        <CreasePattern :fold="built.fold" :width="160" />
        <table class="seq-angles">
          <thead><tr><th>crease</th><th>type</th><th>angle</th></tr></thead>
          <tbody>
            <tr v-for="a in angles" :key="a.id"><td><code>{{ a.id }}</code></td><td>{{ a.assignment }}{{ a.closing ? ' (closing)' : '' }}</td><td><code>{{ deg(a.angle) }}°</code></td></tr>
          </tbody>
        </table>
        <p class="pg-muted">schedule {{ Math.round(schedule?.total ?? 0) }} ms</p>
      </div>
    </div>
  </section>
</template>

<style>
.seq-controls { margin: 16px 0 24px; }
.seq-body { display: flex; flex-wrap: wrap; gap: 32px; align-items: flex-start; }
.seq-stage { flex: 1 1 360px; min-height: 360px; display: grid; place-items: center; padding: 40px 0; }
.seq-side { flex: 0 1 280px; }
.seq-angles { border-collapse: collapse; margin: 12px 0; font-size: 13px; }
.seq-angles th, .seq-angles td { text-align: left; padding: 2px 12px 2px 0; }
</style>
