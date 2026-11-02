<script setup lang="ts">
// A fold drawn by the WebGL driver at one moment and left on its canvas (the Look page's
// stills): stage, buildFold at t, one render. three.js loads on mount.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Fold, StyleOverrides } from 'orkami'

// `scale` px per sheet unit, or `fit`: the widest the canvas (sheet plus bleed) may be
const props = defineProps<{ fold: Fold; t: number; style?: StyleOverrides; scale?: number; fit?: number }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const failed = ref('')
let dispose = () => {}
let set: ((t: number) => void) | undefined

onMounted(async () => {
  try {
    const three = await import('orkami/three')
    const f = props.fold
    const bleed = three.bleedFor(f, { style: props.style })
    const k = props.scale ?? (props.fit ? Math.min(1, props.fit / (f.sheet.width + 2 * bleed[0])) : 1)
    const stage = three.stage(canvas.value!, { width: f.sheet.width, height: f.sheet.height, bleed, style: props.style })
    const handle = three.buildFold(f, { style: props.style, at: props.t })
    stage.add(handle)
    stage.resize((f.sheet.width + 2 * bleed[0]) * k, (f.sheet.height + 2 * bleed[1]) * k)
    stage.render()
    set = (t: number) => { handle.set(t); stage.render() }
    dispose = () => { handle.dispose(); stage.dispose() }
  } catch (e) {
    failed.value = e instanceof Error ? e.message : String(e)
  }
})
watch(() => props.t, t => set?.(t))
onBeforeUnmount(() => dispose())
</script>

<template>
  <div class="still3d">
    <canvas ref="canvas" />
    <p v-if="failed" class="pg-muted">WebGL unavailable: {{ failed }}</p>
  </div>
</template>

<style>
.still3d canvas { display: block; max-width: 100%; height: auto; }
</style>
