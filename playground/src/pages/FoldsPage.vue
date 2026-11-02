<script setup lang="ts">
// Every named fold at three shapes, each lying folded as paper on the sheet and opening on hover
// or its button, with its suits and its crease pattern drawn flat beside it.
import { ref } from 'vue'
import FoldCard from '../components/FoldCard.vue'
import { FOLDS, type Shape } from '../shared'

const shapes: Shape[] = ['wide', 'square', 'tall']
const only = ref<Shape | 'all'>('all')
</script>

<template>
  <section>
    <h1>Folds</h1>
    <p class="pg-muted">Every named fold at three shapes. Hover a card (or press its button) to unfold it. Beside it is the crease pattern: mountains solid red, valleys dashed blue, flat creases dotted. The two bases need a square and refuse a rectangle rather than tear it.</p>
    <div class="pg-row" role="group" aria-label="Shape">
      <button v-for="s in (['all', ...shapes] as const)" :key="s" type="button" :aria-pressed="only === s" @click="only = s">{{ s }}</button>
    </div>
    <div v-for="name in FOLDS" :key="name" class="folds-row">
      <FoldCard v-for="s in shapes.filter(x => only === 'all' || only === x)" :key="s" :name="name" :shape="s" />
    </div>
  </section>
</template>

<style>
.folds-row { display: flex; flex-wrap: wrap; gap: 40px 48px; padding: 36px 0; border-bottom: 1px solid var(--pg-line); align-items: flex-end; }
</style>
