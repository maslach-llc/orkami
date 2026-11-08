<script setup lang="ts">
// Every named fold at three shapes, each lying folded as paper on the sheet and opening on hover
// or its button, with its suits and its crease pattern drawn flat beside it.
import { ref } from 'vue'
import FoldCard from '../components/FoldCard.vue'
import { FOLDS, type Shape } from '../shared'

const shapes: Shape[] = ['wide', 'square', 'tall']
const only = ref<Shape | 'all'>('all')
// What the faces carry: the landing (the default), the sample picture, or the card's own label
const prints = ['landed', 'image', 'content'] as const
const print = ref<(typeof prints)[number]>('landed')
const still = ref(false)
</script>

<template>
  <section>
    <h1>Folds</h1>
    <p class="pg-muted">Every named fold at three shapes. Hover a card (or press its button) to unfold it. Beside it is the crease pattern: mountains solid red, valleys dashed blue, flat creases dotted. The two bases need a square and refuse a rectangle rather than tear it. The print switch says what is printed on the paper: landed is the plain sheet, image prints the sample picture across every face, so it is folded inside the paper and joins without a seam when the card lies flat, and content prints the card's label on every face. Still mounts each card flat and landed, with no motion.</p>
    <div class="pg-row" role="group" aria-label="Shape">
      <button v-for="s in (['all', ...shapes] as const)" :key="s" type="button" :aria-pressed="only === s" @click="only = s">{{ s }}</button>
    </div>
    <div class="pg-row folds-print">
      <div class="pg-row" role="group" aria-label="Print">
        <button v-for="p in prints" :key="p" type="button" :aria-pressed="print === p" @click="print = p">{{ p }}</button>
      </div>
      <button type="button" :aria-pressed="still" @click="still = !still">still</button>
    </div>
    <div v-for="name in FOLDS" :key="name" class="folds-row">
      <!-- Unfold reads its mount options once, so the key remounts a card when print or still changes -->
      <FoldCard v-for="s in shapes.filter(x => only === 'all' || only === x)" :key="`${s}-${print}-${still}`" :name="name" :shape="s" :print="print" :still="still" />
    </div>
  </section>
</template>

<style>
.folds-row { display: flex; flex-wrap: wrap; gap: 40px 48px; padding: 36px 0; border-bottom: 1px solid var(--pg-line); align-items: flex-end; }
.folds-print { margin-top: 12px; }
</style>
