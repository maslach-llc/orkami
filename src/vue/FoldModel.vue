<script setup lang="ts">
// <FoldModel model="preliminaryKite" :step="k" />: a model folded in steps (D19), drawn by the
// CSS driver. The square of paper plays to `step` whenever it changes, from wherever it is, at
// the steps' own pace (forward folds, backward unfolds: the same steps played back); with `step`
// unset it stays where `at` put it until `play()` is called. `size` is the square's side in px;
// `pace` stretches every step (the playground's slow toggle passes 4). Emits `step` with s on
// every arrival and `done` when the model is finished (s at its last step). `model` is a named
// model, a `Model`, or a factory from the side; it, `size` and `style` rebuild the paper.
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Model } from '../core/model.ts'
import { models, type NamedModel } from '../core/models/index.ts'
import type { StyleOverrides } from '../core/style.ts'
import { mountModel, type ModelHandle } from '../css/model.ts'

const props = withDefaults(defineProps<{
  model?: NamedModel | Model | ((size: number) => Model)
  /** The s to play to: 0 the flat sheet, k the end of step k. */
  step?: number
  /** The s to mount at. */
  at?: number
  /** The square's side, px. */
  size?: number
  style?: StyleOverrides
  /** A multiplier on every step's duration. */
  pace?: number
  tag?: string
}>(), { model: 'preliminaryKite', step: undefined, at: 0, size: 240, style: undefined, pace: 1, tag: 'div' })

const emit = defineEmits<{ step: [s: number]; done: [] }>()

const el = ref<HTMLElement | null>(null)
const handle = shallowRef<ModelHandle>()
const s = ref(props.at)
const playing = ref(false)

const build = (): Model => {
  const m = props.model
  if (typeof m === 'string') return models[m](props.size)
  if (typeof m === 'function') return m(props.size)
  return m
}

function mountIt(at: number) {
  handle.value?.destroy()
  handle.value = undefined
  if (!el.value) return
  handle.value = mountModel(el.value, build(), { at, style: props.style, pace: props.pace, onFrame: (v) => { s.value = v } })
  s.value = handle.value.s
}

/** Plays from where the paper is to `to` (the model's end by default); resolves on arrival. */
async function play(to?: number): Promise<void> {
  const h = handle.value
  if (!h) return
  const target = to ?? h.model.steps.length
  playing.value = true
  try { await h.play(h.s, target) } finally { playing.value = h.playing }
  if (handle.value !== h || Math.abs(h.s - target) > 1e-9) return
  s.value = h.s
  emit('step', h.s)
  if (h.s >= h.model.steps.length && h.model.steps.length > 0) emit('done')
}

/** Puts the paper at s with no motion. */
function set(v: number) {
  handle.value?.set(v)
  if (handle.value) s.value = handle.value.s
}

onMounted(() => {
  mountIt(props.at)
  if (props.step !== undefined && props.step !== props.at) void play(props.step)
})
onBeforeUnmount(() => { handle.value?.destroy(); handle.value = undefined })

watch(() => props.step, (v) => { if (v !== undefined) void play(v) }, { flush: 'post' })
watch(() => [props.model, props.size, props.style, props.pace] as const, () => mountIt(s.value), { flush: 'post' })

defineExpose({ handle, s, playing, play, set })
</script>

<template>
  <component :is="tag" ref="el" class="ori-fold-model" :style="{ width: `${size}px`, height: `${size}px` }" />
</template>
