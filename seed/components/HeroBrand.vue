<script setup lang="ts">
// The home page's room for the wordmark. The wordmark itself lives in the header
// (SiteHeader); this box only keeps its place in the hero and tells the header where that
// place is (`hero-dock`: x = center, y = top, both in page coordinates, w = width) and how far
// the visitor has scrolled toward docking it (`p`, 0 = big in the hero, 1 = locked in the bar).
import { layout } from '~/utils/origami'

interface HeroDock { p: number, x: number, y: number, w: number }

const word = layout()
const dock = useState<HeroDock>('hero-dock', () => ({ p: 1, x: 0, y: 0, w: 0 }))
const el = ref<HTMLElement>()

// Where the header's slot sits; measured from the header's own brand box (never transformed)
function slotTop() {
  const slot = document.querySelector<HTMLElement>('.site-header .brand')
  return slot ? slot.getBoundingClientRect().top : 0
}

function measure() {
  const r = el.value!.getBoundingClientRect()
  dock.value = { ...dock.value, x: r.left + r.width / 2 + window.scrollX, y: r.top + window.scrollY, w: r.width }
  update()
}
// The brand rises a little slower than the page, so the rows slide under it before it locks
function update() {
  const d = Math.max(260, 1.4 * (dock.value.y - slotTop()))
  const p = Math.min(1, Math.max(0, window.scrollY / d))
  if (p !== dock.value.p) dock.value = { ...dock.value, p }
}

let frame = 0
function onScroll() {
  if (frame) return
  frame = requestAnimationFrame(() => { frame = 0; update() })
}
let ro: ResizeObserver | undefined
onMounted(() => {
  measure()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', measure)
  // The box can move without a resize (fonts loading, the page settling)
  ro = new ResizeObserver(() => measure())
  ro.observe(document.body)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', measure)
  ro?.disconnect()
  dock.value = { ...dock.value, p: 1 }
})
</script>

<template>
  <div ref="el" class="hero-brand" aria-hidden="true" :style="{ 'aspect-ratio': `${word.width} / ${word.height}` }" />
</template>

<style scoped>
.hero-brand { width: min(100%, 720px); }
</style>
