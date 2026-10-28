<script setup lang="ts">
// The origami wordmark (or the mark alone with text="M"), drawn flat as SVG. Each facet is a
// polygon in one of the four facet colors (--ori-1..4, set per project by useOrigamiPalette),
// with a light-to-shade gradient, a crease shadow on the folds, a lit hairline on the creases
// that face the light, paper grain over the lot and two drop shadows underneath. The same
// geometry unfolds in 3D in OrigamiUnfold.vue; this one is for headers, cards and anywhere
// that only needs the resting lockup.
import { layout, points, type PlacedFacet, type Pt } from '~/utils/origami'

const props = withDefaults(defineProps<{
  text?: string
  /** Rendered height in px; without it the SVG fills its container's width. */
  height?: number
  /** Accessible name; empty hides it from assistive tech (decorative next to visible text). */
  label?: string
  /** Soft shadow under the paper. Off in tight spaces such as the header. */
  shadow?: boolean
  /** Paper grain over the facets. */
  grain?: boolean
}>(), { text: 'MASLACH', label: 'Maslach', shadow: true, grain: true })

const word = computed(() => layout(props.text))
const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
const id = (s: string) => `${uid}-${s}`

// A shaded facet darkens from its crease inward; the gradient runs from the hinge midpoint
// toward the facet's centroid, in user space, so it sits right whatever the letter.
function creaseGradient(fc: PlacedFacet) {
  const [a, b] = fc.hingeAbs
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const c = fc.abs.reduce<Pt>((s, p) => [s[0] + p[0] / fc.abs.length, s[1] + p[1] / fc.abs.length], [0, 0])
  const far: Pt = [mid[0] + (c[0] - mid[0]) * 2.2, mid[1] + (c[1] - mid[1]) * 2.2]
  return { x1: mid[0], y1: mid[1], x2: far[0], y2: far[1] }
}
const shaded = computed(() => word.value.facets.filter(f => !f.lit).map(f => ({ key: `${f.letter}-${f.index}`, f, g: creaseGradient(f) })))
const silhouette = computed(() => word.value.facets.map(f => `M${f.abs.map(p => p.join(' ')).join('L')}Z`).join(''))
const size = computed(() => props.height ? { height: `${props.height}px`, width: `${Math.round(props.height * word.value.width / word.value.height)}px` } : undefined)
</script>

<template>
  <svg
    class="origami-word"
    :viewBox="`0 0 ${word.width} ${word.height}`"
    :style="size"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    :role="label ? 'img' : undefined"
  >
    <defs>
      <linearGradient :id="id('lit')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".22" />
        <stop offset=".5" stop-color="#fff" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity=".12" />
      </linearGradient>
      <linearGradient v-for="s in shaded" :id="id(`crease-${s.key}`)" :key="s.key" gradientUnits="userSpaceOnUse" :x1="s.g.x1" :y1="s.g.y1" :x2="s.g.x2" :y2="s.g.y2">
        <stop offset="0" stop-color="#000" stop-opacity=".46" />
        <stop offset=".6" stop-color="#000" stop-opacity=".1" />
        <stop offset="1" stop-color="#000" stop-opacity=".18" />
      </linearGradient>
      <filter v-if="shadow" :id="id('shadow')" x="-10%" y="-20%" width="120%" height="160%">
        <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity=".2" />
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".16" />
      </filter>
      <filter v-if="grain" :id="id('grain')" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" result="n" />
        <feColorMatrix type="saturate" values="0" in="n" result="g" />
        <feComponentTransfer in="g" result="a"><feFuncA type="table" tableValues="0 .16" /></feComponentTransfer>
        <feComposite in="a" in2="SourceAlpha" operator="in" />
      </filter>
      <clipPath :id="id('clip')"><path :d="silhouette" /></clipPath>
    </defs>
    <g :filter="shadow ? `url(#${id('shadow')})` : undefined">
      <polygon v-for="f in word.facets" :key="`${f.letter}-${f.index}`" :class="f.name" :points="points(f.abs)" :fill="`var(--ori-${f.slot})`" />
    </g>
    <g class="light">
      <template v-for="f in word.facets" :key="`${f.letter}-${f.index}`">
        <polygon v-if="f.lit" :points="points(f.abs)" :fill="`url(#${id('lit')})`" />
        <polygon v-else :points="points(f.abs)" :fill="`url(#${id(`crease-${f.letter}-${f.index}`)})`" />
      </template>
    </g>
    <g class="creases" fill="none" stroke-width="1.5">
      <template v-for="f in word.facets" :key="`${f.letter}-${f.index}`">
        <line
          v-if="f.parent >= 0"
          :x1="f.hingeAbs[0][0]" :y1="f.hingeAbs[0][1]" :x2="f.hingeAbs[1][0]" :y2="f.hingeAbs[1][1]"
          :stroke="f.lit ? '#000' : '#fff'" :stroke-opacity="f.lit ? .3 : .4"
        />
      </template>
    </g>
    <rect v-if="grain" width="100%" height="100%" :clip-path="`url(#${id('clip')})`" :filter="`url(#${id('grain')})`" style="mix-blend-mode: multiply" />
  </svg>
</template>

<style scoped>
.origami-word { display: block; overflow: visible; width: 100%; height: auto; }
/* A project's colors arrive as a color change on every facet */
.origami-word polygon { transition: fill .45s ease; }
</style>
