<script setup lang="ts">
// <Word text="MASLACH" />: a word of glyphs drawn flat as SVG (`wordSvg`): the resting lockup,
// server rendered, for headers, cards and the fallback of an unfold. `height` sets the rendered
// height in px (the width follows); without it the SVG fills its container's width.
import { computed, useId } from 'vue'
import type { Style, StyleOverrides } from '../core/style.ts'
import { wordSvg } from '../glyphs/svg.ts'

const props = withDefaults(defineProps<{
  text?: string
  height?: number
  /** Accessible name; empty hides it from assistive tech (decorative next to visible text). */
  label?: string
  shadow?: boolean
  grain?: boolean
  style?: Style | StyleOverrides
}>(), { text: 'MASLACH', height: undefined, label: '', shadow: true, grain: undefined, style: undefined })

const uid = useId()
const svg = computed(() => wordSvg(props.text, { style: props.style, shadow: props.shadow, grain: props.grain, id: `ori${uid}` }))
const size = computed(() => props.height ? { height: `${props.height}px`, width: `${Math.round(props.height * svg.value.width / svg.value.height)}px` } : undefined)
</script>

<template>
  <svg
    class="ori-word"
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="svg.viewBox"
    :style="size"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    v-html="svg.inner"
  />
</template>

<style>
.ori-word { display: block; overflow: visible; width: 100%; height: auto; }
</style>
