<script setup lang="ts">
// The page is a sheet of folded paper: the fold pattern in utils/sheet.ts, large facets behind
// everything, creases along their shared edges, grain over the lot. Fixed and static, so
// scrolling never repaints it; the v-unfold blocks fold out of it (origami.css). Once mounted,
// the same sheet is rendered with the live colors into --ori-sheet (sheetPaint.ts), the paint
// a folding block's paper back wears so it is the background until it moves.
import { creases, polys, SHEET_H, SHEET_W, toneColor } from '~/utils/sheet'
import { paintSheet } from '~/utils/sheetPaint'

const route = useRoute()
onMounted(() => {
  paintSheet()
  // The mark's colors follow the project in view (useOrigamiPalette sets them on <html>)
  watch(() => route.path, () => nextTick(paintSheet))
})
</script>

<template>
  <div class="sheet">
    <svg :viewBox="`0 0 ${SHEET_W} ${SHEET_H}`" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <polygon v-for="f in polys" :key="f.name" :style="{ fill: toneColor(f.tone) }" :points="f.points" />
      <path class="crease" :d="creases" />
    </svg>
  </div>
</template>

<style scoped>
.sheet { position: fixed; inset: 0; z-index: -1; pointer-events: none; contain: strict; will-change: transform; }
svg { display: block; width: 100%; height: 100%; }
.crease { fill: none; stroke: color-mix(in srgb, var(--text) 6%, transparent); stroke-width: 1px; vector-effect: non-scaling-stroke; }
/* Paper grain, multiplied over the facets (the same grain .ori-paper wears, --ori-grain-soft) */
.sheet::after { content: ''; position: absolute; inset: 0; background: var(--ori-grain); mix-blend-mode: multiply; opacity: .35; }
</style>
