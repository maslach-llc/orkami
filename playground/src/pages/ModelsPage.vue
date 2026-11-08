<script setup lang="ts">
// A model folded in steps (D19) under a step scrubber: s = 0 is the flat sheet, k the end of
// step k. The step list plays to a step from wherever the paper is (backwards is the unfold),
// the slow toggle stretches every step four times, and the crease pattern beside it shows the
// creases made so far with the layer order of the nearest rest state. The CSS driver draws it,
// through the Vue adapter's <FoldModel>.
import { computed, ref } from 'vue'
import { creasesMade, keyAt, keyFold, models, modelAngles, type NamedModel } from 'orkami'
import { FoldModel } from 'orkami/vue'
import CreasePattern from '../components/CreasePattern.vue'
import { deg } from '../shared'

const NAMES = Object.keys(models) as NamedModel[]
const name = ref<NamedModel>('preliminaryKite')
const SIZE = 240
const slow = ref(false)
const built = computed(() => models[name.value](SIZE))
const n = computed(() => built.value.steps.length)

const fm = ref<{ s: number; playing: boolean; play: (to?: number) => Promise<void>; set: (s: number) => void } | null>(null)
const s = computed(() => fm.value?.s ?? 0)
const scrub = ref(0)
const onScrub = () => fm.value?.set(scrub.value)
const playTo = async (k: number) => { await fm.value?.play(k); scrub.value = fm.value?.s ?? k }

const key = computed(() => keyAt(built.value, s.value))
const made = computed(() => creasesMade(built.value, Math.ceil(s.value - 1e-9)))
/** The pattern as it stands: the creases made so far, each with the assignment it has at the nearest rest state. */
const pattern = computed(() => {
  const f = keyFold(built.value, key.value)
  return { ...f, creases: f.creases.filter(c => made.value.has(c.id)) }
})
const angles = computed(() => {
  const a = modelAngles(built.value, s.value)
  return built.value.creases.map(c => ({ id: c.id, closing: !!c.closing, angle: a[c.id], layer: built.value.stacks[key.value]!.step[c.id] }))
})
</script>

<template>
  <section>
    <h1>Models</h1>
    <p class="pg-muted">A model is one crease pattern and a list of steps; each step starts where the last one stopped. Scrub s from the flat sheet (0) to the finished model, or pick a step to play to it (backwards is the unfold).</p>
    <div class="pg-row mod-controls">
      <label>model <select v-model="name"><option v-for="m in NAMES" :key="m" :value="m">{{ m }}</option></select></label>
      <label>s <input v-model.number="scrub" type="range" min="0" :max="n" step="0.001" @input="onScrub"> <code>{{ s.toFixed(3) }}</code></label>
      <button type="button" :aria-pressed="slow" @click="slow = !slow">slow</button>
      <button type="button" @click="playTo(s < n / 2 ? n : 0)">{{ s < n / 2 ? 'fold' : 'unfold' }}</button>
    </div>
    <div class="mod-body">
      <div class="mod-stage">
        <FoldModel ref="fm" :key="name" :model="name" :size="SIZE" :pace="slow ? 4 : 1" class="pg-card" />
      </div>
      <div class="mod-side">
        <ol class="mod-steps" start="0">
          <li><button type="button" :aria-current="key === 0 ? 'step' : undefined" @click="playTo(0)">the flat sheet</button></li>
          <li v-for="(st, i) in built.steps" :key="i"><button type="button" :aria-current="key === i + 1 ? 'step' : undefined" @click="playTo(i + 1)">{{ st.name }}</button> <span class="pg-muted">{{ Math.round(st.duration) }} ms</span></li>
        </ol>
        <CreasePattern :fold="pattern" :width="160" />
        <table class="mod-angles">
          <thead><tr><th>crease</th><th>angle</th><th>layer step</th></tr></thead>
          <tbody>
            <tr v-for="a in angles" :key="a.id"><td><code>{{ a.id }}</code>{{ a.closing ? ' (closing)' : '' }}</td><td><code>{{ deg(a.angle ?? 0) }}°</code></td><td><code>{{ a.layer ?? '' }}</code></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style>
.mod-controls { margin: 16px 0 24px; }
.mod-controls input[type='range'] { width: min(320px, 60vw); }
.mod-body { display: flex; flex-wrap: wrap; gap: 32px; align-items: flex-start; }
.mod-stage { flex: 1 1 360px; min-height: 360px; display: grid; place-items: center; padding: 40px 0; }
.mod-side { flex: 0 1 300px; }
.mod-steps { padding-left: 0; list-style: none; margin: 0 0 16px; }
.mod-steps li { margin: 4px 0; }
.mod-steps button[aria-current='step'] { border-color: var(--pg-accent); }
.mod-angles { border-collapse: collapse; margin: 12px 0; font-size: 13px; }
.mod-angles th, .mod-angles td { text-align: left; padding: 2px 12px 2px 0; }
</style>
