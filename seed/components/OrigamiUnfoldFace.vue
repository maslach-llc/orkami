<script setup lang="ts">
// One facet of OrigamiUnfold: a hinge wrapper (the fold rotation, which also carries every
// facet creased to this one) around the paper face itself, front and back. Recursive; styles
// live in OrigamiUnfold.vue.
defineProps<{
  face: { key: string, f: { lit: boolean, name: string, letter: number }, children: any[] }
  hinge: (face: any) => Record<string, string>
  faceStyle: (face: any) => Record<string, string>
  backStyle: (face: any) => Record<string, string>
}>()
</script>

<template>
  <div class="hinge" :class="`l${face.f.letter}`" :style="hinge(face)">
    <div class="face" :class="[face.f.name, face.f.lit ? 'lit' : 'shade']" :style="faceStyle(face)" />
    <div class="back" :style="backStyle(face)" />
    <OrigamiUnfoldFace v-for="c in face.children" :key="c.key" :face="c" :hinge="hinge" :face-style="faceStyle" :back-style="backStyle" />
  </div>
</template>
