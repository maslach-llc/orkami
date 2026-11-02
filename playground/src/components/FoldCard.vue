<script setup lang="ts">
// One named fold at one shape: lying folded on the sheet, opening on hover or the button, with
// its name, its suits and its crease pattern. The block fills its stage (Unfold's own `style`
// prop is the fold's style, so the size sits on the stage).
import { computed, ref } from 'vue'
import { Unfold } from 'orkami/vue'
import type { NamedFold } from 'orkami'
import CreasePattern from './CreasePattern.vue'
import { SHAPES, tryFold, type Shape } from '../shared'

const props = defineProps<{ name: NamedFold; shape: Shape }>()
const size = computed(() => SHAPES[props.shape])
const built = computed(() => tryFold(props.name, size.value[0], size.value[1]))
const open = ref(false)
const pinned = ref(false)
const isOpen = computed(() => open.value || pinned.value)
// A lift lies folded over its top edge, onto the page above its box: room for it there
const reach = computed(() => props.name === 'lift' ? size.value[1] : 0)
const suited = computed(() => built.value.fold?.suits?.includes(props.shape) ?? false)
</script>

<template>
  <figure class="fc">
    <div class="fc-stage" :style="{ width: `${size[0]}px`, height: `${size[1]}px`, marginTop: `${reach}px` }" @mouseenter="open = true" @mouseleave="open = false">
      <Unfold v-if="built.fold" :fold="built.fold" :open="isOpen" class="fc-block pg-card">
        <span class="fc-label">{{ name }}<br><small>{{ shape }}</small></span>
      </Unfold>
      <p v-else class="fc-refused pg-muted">{{ built.error }}</p>
    </div>
    <figcaption class="fc-cap">
      <div>
        <strong>{{ name }}</strong> <span class="pg-muted">{{ shape }}</span>
        <div class="pg-muted fc-suits">suits {{ built.fold?.suits?.join(', ') ?? 'no rectangle' }}<span v-if="built.fold && !suited"> · shown off its shape</span></div>
        <button v-if="built.fold" type="button" :aria-pressed="pinned" @click="pinned = !pinned">{{ pinned ? 'fold' : 'open' }}</button>
      </div>
      <CreasePattern v-if="built.fold" :fold="built.fold" :width="96" />
    </figcaption>
  </figure>
</template>

<style>
.fc { margin: 0; display: grid; gap: 10px; justify-items: start; }
.fc-stage { display: grid; place-items: center; }
.fc-block { width: 100%; height: 100%; display: grid; place-items: center; text-align: center; border-radius: 0; }
.fc-label { font-weight: 600; }
.fc-label small { font-weight: 400; opacity: .7; }
.fc-refused { font-size: 13px; padding: 12px; border: 1px dashed var(--pg-line); width: 100%; height: 100%; margin: 0; display: grid; place-items: center; text-align: center; }
.fc-cap { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; width: 100%; max-width: 340px; font-size: 14px; }
.fc-suits { font-size: 12px; margin-bottom: 6px; }
</style>
