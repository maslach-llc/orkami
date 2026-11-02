<script setup lang="ts">
// The house-look check: the resting wordmark from each driver beside the Figma reference export,
// then a blintz card and a tall accordion in the house style at three moments of the unfold
// (lifted, mid, landed) in both drivers, so the edges can be seen staying sharp and the shadow
// tightening as the paper lands.
import { ref } from 'vue'
import { accordion, blintz, wordFold } from 'orkami'
import { Word } from 'orkami/vue'
import CssStill from '../components/CssStill.vue'
import Still3D from '../components/Still3D.vue'
import { HOUSE } from '../shared'

const word = wordFold('MASLACH')
const width = Math.min(480, (typeof document !== 'undefined' ? document.documentElement.clientWidth : 1200) - 32)
const moments = [{ t: 0.15, label: 'lifted' }, { t: 0.5, label: 'mid' }, { t: 1, label: 'landed' }]
const subjects = [
  { name: 'blintz card', fold: blintz(200, 200) },
  { name: 'tall accordion', fold: accordion(160, 280, 4, 'horizontal') },
]
const missing = ref<Record<string, boolean>>({})
const base = import.meta.env.BASE_URL
</script>

<template>
  <section>
    <h1>Look</h1>
    <p class="pg-muted">The house look: sharp facets, two tones of shade, hairline creases, a soft pair of shadows. The references are exports from the Figma lockup; the resting wordmarks from both drivers should match them.</p>

    <h2>Resting wordmark</h2>
    <div class="look-grid">
      <figure>
        <div :style="{ width: `${width}px` }"><Word text="MASLACH" :style="HOUSE" label="" /></div>
        <figcaption class="pg-muted">CSS driver at rest (the flat SVG it lands on)</figcaption>
      </figure>
      <figure>
        <Still3D :fold="word" :t="1" :style="HOUSE" :scale="width / word.sheet.width" />
        <figcaption class="pg-muted">WebGL driver at t = 1</figcaption>
      </figure>
      <figure v-for="scheme in ['light', 'dark']" :key="scheme">
        <img v-if="!missing[scheme]" :src="`${base}reference/lockup-${scheme}.png`" :alt="`Figma reference lockup, ${scheme}`" :width="width" @error="missing[scheme] = true">
        <p v-else class="look-missing pg-muted" :style="{ width: `${width}px` }">No reference yet: export Figma node {{ scheme === 'light' ? '18:152' : '18:185' }} at 2x to <code>playground/public/reference/lockup-{{ scheme }}.png</code>.</p>
        <figcaption class="pg-muted">Figma reference, {{ scheme }}</figcaption>
      </figure>
    </div>

    <template v-for="s in subjects" :key="s.name">
      <h2>{{ s.name }}</h2>
      <div class="look-moments">
        <figure v-for="m in moments" :key="m.t">
          <div class="pg-row look-pair">
            <div class="look-css"><CssStill :fold="s.fold" :t="m.t" /></div>
            <Still3D :fold="s.fold" :t="m.t" :fit="320" />
          </div>
          <figcaption class="pg-muted">{{ m.label }}, t = {{ m.t }}: CSS, then WebGL</figcaption>
        </figure>
      </div>
    </template>
  </section>
</template>

<style>
.look-grid { display: flex; flex-wrap: wrap; gap: 32px; margin-bottom: 48px; }
.look-grid figure, .look-moments figure { margin: 0; display: grid; gap: 8px; }
.look-grid img { display: block; height: auto; max-width: 100%; }
.look-missing { border: 1px dashed var(--pg-line); padding: 24px; margin: 0; font-size: 13px; }
.look-moments { display: flex; flex-wrap: wrap; gap: 40px; margin-bottom: 48px; }
.look-css { padding: 48px; }
.look-pair { align-items: center; gap: 8px; }
</style>
