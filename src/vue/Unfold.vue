<script setup lang="ts">
// <Unfold fold="blintz" :open="ready"><Card/></Unfold>: a wrapper that lies folded as the
// named fold (or a Fold, or a factory) and opens on `open` turning true, or, with `open` left
// unset, when it scrolls into view. The slot is the content printed on the paper's root face.
// Emits `landed` when the paper lies flat. `tag` is the wrapper element (div by default).
// `print` is what the faces carry (D17: 'landed', 'content' or `{ image }`); `still` mounts it
// flat with no motion and ignores `open` (a block already seen). Both are read at mount.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { StyleOverrides } from '../core/style.ts'
import type { MountOptions, Print } from '../css/driver.ts'
import { useFold } from './useFold.ts'
import type { FoldSpec } from './unfold.ts'

const props = withDefaults(defineProps<{
  fold?: FoldSpec
  /** Opens on true; unset, opens when scrolled into view. */
  open?: boolean
  tag?: string
  style?: StyleOverrides
  /** What is printed on the faces; 'landed' by default. */
  print?: Print
  /** Mounted flat with no motion; `open` is ignored. */
  still?: boolean
  /** Passed to the driver's `mount`. */
  options?: MountOptions
}>(), { fold: 'lift', open: undefined, tag: 'div', style: undefined, print: undefined, still: false, options: undefined })

const emit = defineEmits<{ landed: [] }>()

const el = ref<HTMLElement | null>(null)
const fold = useFold(el, () => props.fold as FoldSpec, {
  ...props.options,
  style: props.style,
  ...(props.print !== undefined ? { print: props.print } : {}),
  ...(props.still ? { still: true } : {}),
})

let io: IntersectionObserver | undefined
onMounted(() => {
  const target = el.value
  if (!target || props.open !== undefined || props.still) return
  io = new IntersectionObserver((entries) => {
    if (!entries.some(e => e.isIntersecting)) return
    io?.disconnect()
    void fold.open()
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
  io.observe(target)
})
onBeforeUnmount(() => io?.disconnect())

watch(() => props.open, (v) => {
  if (v === undefined || props.still) return
  void (v ? fold.open() : fold.close())
}, { immediate: true, flush: 'post' })
watch(fold.landed, (v) => { if (v) emit('landed') })

defineExpose({ handle: fold.handle, t: fold.t, state: fold.state, landed: fold.landed, open: fold.open, close: fold.close, set: fold.set })
</script>

<template>
  <component :is="tag" ref="el" class="ori-unfold">
    <slot />
  </component>
</template>
