<script setup lang="ts">
// Hash tabs, no router: #folds, #sequence, #page, #word, #look.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import FoldsPage from './pages/FoldsPage.vue'
import SequencePage from './pages/SequencePage.vue'
import PagePage from './pages/PagePage.vue'
import WordPage from './pages/WordPage.vue'
import LookPage from './pages/LookPage.vue'

const PAGES = { folds: FoldsPage, sequence: SequencePage, page: PagePage, word: WordPage, look: LookPage } as const
type Key = keyof typeof PAGES
const LABELS: Record<Key, string> = { folds: 'Folds', sequence: 'Sequence', page: 'Page', word: 'Word', look: 'Look' }

const read = (): Key => { const k = location.hash.slice(1); return k in PAGES ? k as Key : 'folds' }
const current = ref<Key>(read())
const onHash = () => { current.value = read(); window.scrollTo(0, 0) }
onMounted(() => window.addEventListener('hashchange', onHash))
onBeforeUnmount(() => window.removeEventListener('hashchange', onHash))
const page = computed(() => PAGES[current.value])
</script>

<template>
  <header class="pg-head">
    <div class="pg-wrap pg-row">
      <strong class="pg-brand">orkami</strong>
      <nav class="pg-row" aria-label="Playground pages">
        <a v-for="(label, key) in LABELS" :key="key" :href="`#${key}`" :aria-current="current === key ? 'page' : undefined">{{ label }}</a>
      </nav>
      <a class="pg-muted pg-src" href="https://github.com/maslach-llc/orkami">source</a>
    </div>
  </header>
  <main class="pg-wrap">
    <component :is="page" :key="current" />
  </main>
</template>

<style>
.pg-head { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--ori-bg) 88%, transparent); backdrop-filter: blur(6px); border-bottom: 1px solid var(--pg-line); margin-bottom: 24px; }
.pg-head .pg-wrap { padding-top: 10px; padding-bottom: 10px; }
.pg-brand { font-size: 17px; letter-spacing: .02em; }
.pg-head nav a { text-decoration: none; color: var(--pg-muted); padding: 2px 0; border-bottom: 2px solid transparent; }
.pg-head nav a[aria-current='page'] { color: var(--pg-ink); border-color: var(--pg-accent); }
.pg-src { margin-left: auto; font-size: 13px; }
</style>
