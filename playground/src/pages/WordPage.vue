<script setup lang="ts">
// The wordmark in both drivers side by side (the CSS driver's flaps, the WebGL driver's lit
// paper), with a slow toggle and a replay, and the flat SVG word and mark under them.
import { computed, ref } from 'vue'
import { wordFold } from 'orkami'
import { Mark, Unfold3D, Word } from 'orkami/vue'
import CssWord from '../components/CssWord.vue'
import { HOUSE } from '../shared'

const slow = ref(false)
const shadows = ref(true)
const look = computed(() => ({ ...HOUSE, shadows: { on: shadows.value } }))
const k = computed(() => slow.value ? 4 : 1)
const total = computed(() => wordFold('MASLACH').schedule!.total * k.value)
const css = ref<InstanceType<typeof CssWord> | null>(null)
const gl = ref<InstanceType<typeof Unfold3D> | null>(null)
const width = Math.min(560, (typeof document !== 'undefined' ? document.documentElement.clientWidth : 1200) - 32)
function replay() {
  void css.value?.play()
  void gl.value?.play()
}
</script>

<template>
  <section>
    <h1>Word</h1>
    <p class="pg-muted">The wordmark is one fold (D13): every letter hangs on the page by its own edge and its facets open out of it. Left, the CSS driver; right, the WebGL driver. Both play together.</p>
    <div class="pg-row">
      <button type="button" @click="replay">replay</button>
      <button type="button" :aria-pressed="slow" @click="slow = !slow">slow ×4</button>
      <button type="button" :aria-pressed="shadows" @click="shadows = !shadows">shadows</button>
      <span class="pg-muted">{{ Math.round(total) }} ms</span>
    </div>
    <div class="word-pair">
      <figure>
        <CssWord :key="`css-${k}-${shadows}`" ref="css" :width="width" :style="look" :slow="k" />
        <figcaption class="pg-muted">CSS driver</figcaption>
      </figure>
      <figure>
        <div :style="{ width: `${width}px` }">
          <Unfold3D :key="`gl-${k}-${shadows}`" ref="gl" fold="MASLACH" :style="look" :duration="total" :autoplay="false" label="MASLACH" />
        </div>
        <figcaption class="pg-muted">WebGL driver</figcaption>
      </figure>
    </div>
    <h2>Flat</h2>
    <div class="pg-row word-flat">
      <div :style="{ width: `${width}px` }"><Word text="MASLACH" :style="look" label="MASLACH" /></div>
      <Mark :height="56" :style="HOUSE" label="M" />
    </div>
  </section>
</template>

<style>
.word-pair { display: flex; flex-wrap: wrap; gap: 48px; margin: 40px 0; }
.word-pair figure { margin: 0; display: grid; gap: 12px; }
.word-flat { gap: 40px; margin-top: 16px; }
</style>
