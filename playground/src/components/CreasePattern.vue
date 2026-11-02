<script setup lang="ts">
// A fold's crease pattern drawn flat from the core's faces and creases: mountains solid,
// valleys dashed, flat creases dotted, a closing crease (D3) thinner.
import { computed } from 'vue'
import type { Fold } from 'orkami'

const props = defineProps<{ fold: Fold; width?: number }>()
const view = computed(() => `-2 -2 ${props.fold.sheet.width + 4} ${props.fold.sheet.height + 4}`)
const faces = computed(() => props.fold.faces.filter(f => !f.page))
const dash = (a: string) => a === 'V' ? '8 5' : a === 'F' ? '2 4' : undefined
</script>

<template>
  <svg class="cp" :viewBox="view" :width="width ?? 120" role="img" :aria-label="`crease pattern of ${fold.name ?? 'the fold'}`">
    <polygon v-for="f in faces" :key="f.id" :points="f.pts.map(p => p.join(',')).join(' ')" class="cp-face" />
    <line
      v-for="c in fold.creases" :key="c.id"
      :x1="c.a[0]" :y1="c.a[1]" :x2="c.b[0]" :y2="c.b[1]"
      :class="['cp-crease', c.assignment]" :stroke-dasharray="dash(c.assignment)"
      :stroke-width="c.closing ? 1 : 2" vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<style>
.cp { display: block; height: auto; }
.cp-face { fill: var(--pg-card); stroke: var(--pg-line); stroke-width: 1; vector-effect: non-scaling-stroke; }
.cp-crease.M { stroke: #d1495b; }
.cp-crease.V { stroke: var(--pg-accent); }
.cp-crease.F { stroke: var(--pg-muted); }
</style>
