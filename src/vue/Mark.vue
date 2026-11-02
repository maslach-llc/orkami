<script setup lang="ts">
// <Mark />: the first glyph alone (the folded M), for a header or anywhere a small square-ish
// signal is needed. A `Word` of one letter, without the shadow by default.
import type { Style, StyleOverrides } from '../core/style.ts'
import Word from './Word.vue'

withDefaults(defineProps<{
  text?: string
  height?: number
  label?: string
  shadow?: boolean
  style?: Style | StyleOverrides
}>(), { text: 'M', height: 28, label: '', shadow: false, style: undefined })
</script>

<template>
  <Word class="ori-mark" :text="text" :height="height" :label="label" :shadow="shadow" :style="style" />
</template>
