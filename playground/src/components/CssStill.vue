<script setup lang="ts">
// A fold drawn by the CSS driver at one moment (the Look page's stills): mounted at t, no motion.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Fold, StyleOverrides } from 'orkami'
import { mount, type Handle } from 'orkami/css'

const props = defineProps<{ fold: Fold; t: number; style?: StyleOverrides }>()
const host = ref<HTMLElement | null>(null)
let handle: Handle | undefined
onMounted(() => { handle = mount(host.value!, props.fold, { at: props.t, style: props.style, drive: 'frame' }) })
watch(() => props.t, t => handle?.set(t))
onBeforeUnmount(() => handle?.destroy())
</script>

<template>
  <div ref="host" class="pg-card css-still" :style="{ width: `${fold.sheet.width}px`, height: `${fold.sheet.height}px` }"><slot /></div>
</template>

<style>
.css-still { display: grid; place-items: center; }
</style>
