<script setup lang="ts">
// The wordmark in the CSS driver: wordFold mounted on a box holding the flat Word, which shows
// once the letters land (every letter facet is a flap on the page, D13). Scaled to `width`.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { LETTER_STEP, wordFold, type StyleOverrides } from 'orkami'
import { mount, type Handle } from 'orkami/css'
import { Word } from 'orkami/vue'

const props = defineProps<{ text?: string; width: number; style?: StyleOverrides; at?: number; slow?: number }>()
const emit = defineEmits<{ done: [] }>()
const fold = computed(() => wordFold(props.text ?? 'MASLACH', props.slow && props.slow !== 1 ? { letterStep: LETTER_STEP * props.slow, base: 640 * props.slow } : {}))
const scale = computed(() => props.width / fold.value.sheet.width)
const host = ref<HTMLElement | null>(null)
let handle: Handle | undefined

function build() {
  handle?.destroy()
  handle = mount(host.value!, fold.value, { style: props.style, at: props.at ?? 0, sheet: false })
}
async function play() {
  build()
  await handle!.open()
  emit('done')
}
const set = (t: number) => handle?.set(t)
onMounted(build)
onBeforeUnmount(() => handle?.destroy())
defineExpose({ play, set, rebuild: build })
</script>

<template>
  <div class="cssword" :style="{ width: `${width}px`, height: `${fold.sheet.height * scale}px` }">
    <div ref="host" class="cssword-host" :style="{ width: `${fold.sheet.width}px`, height: `${fold.sheet.height}px`, transform: `scale(${scale})` }">
      <Word :text="text ?? 'MASLACH'" :style="style" label="" />
    </div>
  </div>
</template>

<style>
.cssword { position: relative; }
.cssword-host { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.cssword-host > svg { display: block; width: 100%; height: 100%; }
</style>
