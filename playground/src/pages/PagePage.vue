<script setup lang="ts">
// A mock page whose blocks each lie folded as the fold their shape suits and unfold as they
// scroll into view (v-unfold): the proof that the engine composes into an organized page that
// still reads as one sheet of paper. No two neighbouring blocks share a fold.
import { accordion, book, cupboard } from 'orkami'

const hero = (w: number, h: number) => cupboard(w, h, 'vertical')
const columns = [
  { title: 'Crease', fold: (w: number, h: number) => cupboard(w, h, 'horizontal'), name: 'cupboard (horizontal)' },
  { title: 'Fold', fold: (w: number, h: number) => accordion(w, h, 3, 'horizontal'), name: 'accordion' },
  { title: 'Open', fold: (w: number, h: number) => book(w, h, 'left'), name: 'book' },
]
const steps = ['Score the line you will fold along.', 'Bring the edge over and line up the corners.', 'Press the crease flat from the middle out.', 'Unfold, turn the sheet, and fold the next line.']
const cards = [
  { title: 'Blintz', fold: 'blintz' },
  { title: 'Diagonal', fold: 'diagonal' },
  { title: 'Waterbomb', fold: 'waterbomb' },
  { title: 'Preliminary', fold: 'preliminary' },
] as const
</script>

<template>
  <section class="mock">
    <h1>Page</h1>
    <p class="pg-muted">A page laid out in blocks, each folded the way its shape suits: the wide hero a cupboard, the three tall columns a cupboard, an accordion and a book, the list of steps an accordion, the square cards the four square folds. Scroll down; each block unfolds as it comes into view.</p>

    <header v-unfold.always="{ hinge: hero, delay: 200 }" class="pg-card mock-hero">
      <h2>Paper on a page</h2>
      <p>Each block of this page lies folded in the sheet and opens out of it as you reach it.</p>
    </header>

    <div class="mock-cols">
      <article v-for="(c, i) in columns" :key="c.title" v-unfold.always="{ hinge: c.fold, delay: 500 + i * 120 }" class="pg-card mock-col">
        <h3>{{ c.title }}</h3>
        <p>A tall column, folded as {{ c.name }}.</p>
      </article>
    </div>

    <ol v-unfold="{ hinge: (w: number, h: number) => accordion(w, h, steps.length, 'horizontal') }" class="pg-card mock-steps">
      <li v-for="s in steps" :key="s">{{ s }}</li>
    </ol>

    <div class="mock-grid">
      <article v-for="c in cards" :key="c.title" v-unfold="c.fold" class="pg-card mock-square">
        <h3>{{ c.title }}</h3>
        <p>A square card.</p>
      </article>
    </div>
  </section>
</template>

<style>
.mock { display: grid; gap: 48px; }
.mock > p { margin: 0; }
.mock-hero { min-height: 280px; padding: 48px; display: grid; align-content: center; }
.mock-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 32px; }
.mock-col { min-height: 380px; padding: 28px; }
.mock-steps { margin: 0; padding: 32px 32px 32px 56px; display: grid; gap: 0; }
.mock-steps li { min-height: 64px; display: flex; align-items: center; }
.mock-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 32px; margin-bottom: 40vh; }
.mock-square { aspect-ratio: 1; padding: 24px; }
</style>
