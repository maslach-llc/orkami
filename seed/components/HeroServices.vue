<script setup lang="ts">
// The hero's three columns: Design, Development, IT, side by side on the sheet, each creased
// off the one before it, with the family's services listed under its name. Nothing folds on
// the way through them: pointing at a column colors it (name, numbers, corner), and the family
// in focus is emitted so the wordmark above can take its colors. The column head and every
// service are links; the way deeper is "Explore <family>", not a contact button (the hero has
// the page's one). No prices here: the front page sends the visitor deeper before it talks
// money.
import { families, servicesInFamily, type FamilyId } from '~/data/services'

const emit = defineEmits<{ highlight: [id: FamilyId | undefined] }>()

const groups = families.map(f => ({ ...f, services: servicesInFamily(f.id) }))
const offsets = groups.map((_, i) => groups.slice(0, i).reduce((n, g) => n + g.services.length, 0))
const pad = (n: number) => String(n + 1).padStart(2, '0')

// The family in focus: under the pointer, or the last one tapped
const focus = ref<FamilyId>()
watch(focus, id => emit('highlight', id))
function enter(e: PointerEvent, id: FamilyId) { if (e.pointerType === 'mouse') focus.value = id }
function leave(e: PointerEvent) { if (e.pointerType === 'mouse') focus.value = undefined }
function tap(e: PointerEvent, id: FamilyId) { if (e.pointerType !== 'mouse') focus.value = focus.value === id ? undefined : id }

defineExpose({ focus })
</script>

<template>
  <ol class="fams" @pointerleave="leave">
    <li
      v-for="(g, i) in groups" :key="g.id" class="fam crease" :class="{ focus: focus === g.id }" :style="{ '--fam': `var(--${g.id})` }"
      @pointerenter="enter($event, g.id)" @pointerdown="tap($event, g.id)"
    >
      <NuxtLink :to="`/services#${g.id}`" class="head" @focus="focus = g.id">
        <span class="n">{{ pad(i) }}</span>
        <span class="name">{{ g.name }}</span>
        <span class="line">{{ g.line }}</span>
        <span class="corner" aria-hidden="true" />
      </NuxtLink>
      <ul class="services">
        <li v-for="(s, j) in g.services" :key="s.slug">
          <NuxtLink :to="`/services/${s.slug}`" class="crease">
            <span class="sn">{{ pad(offsets[i]! + j) }}</span>
            <span class="sname">{{ s.name }}</span>
            <span class="short">{{ s.short }}</span>
          </NuxtLink>
        </li>
      </ul>
      <p class="more"><NuxtLink :to="`/services#${g.id}`">Explore {{ g.name }} <span aria-hidden="true">→</span></NuxtLink></p>
    </li>
  </ol>
</template>

<style scoped>
/* Three columns on one crease; each column after the first is creased off the one before it
   (a vertical crease on its left edge). Stacked on a phone. */
.fams { list-style: none; margin: 0; padding: 0; display: grid; align-items: start; }
.fam { display: grid; grid-template-rows: auto 1fr auto; }
.head {
  display: grid;
  grid-template-columns: 2.5em 1fr auto;
  grid-template-areas: 'n name corner' 'n line corner';
  column-gap: 12px;
  align-items: baseline;
  padding: 22px 12px 18px 0;
  color: inherit; text-decoration: none;
}
.head:focus-visible { outline: 2px solid var(--fam); outline-offset: -2px; border-radius: 6px; }
.n { grid-area: n; font: 500 0.8rem/1 var(--mono); color: var(--fam); letter-spacing: 0.08em; align-self: start; padding-top: .5em; }
.name {
  grid-area: name;
  font: 600 clamp(1.75rem, 2.6vw, 2.25rem)/1 var(--display);
  letter-spacing: -0.02em;
  transition: color .2s ease, transform .35s var(--ori-ease);
}
.line { grid-area: line; margin-top: 8px; font-size: 0.9375rem; line-height: 1.45; color: var(--muted); max-width: 32ch; }
/* A paper corner, the cards' dog-ear: flat (its lower half showing) at rest, it folds down
   along the diagonal and grows when the column is in focus. The angle is registered so the
   gradient can turn. */
@property --ear-a { syntax: '<angle>'; inherits: false; initial-value: 180deg; }
.corner {
  grid-area: corner; align-self: start; justify-self: end; width: 18px; height: 18px; margin-top: .4em;
  --ear-a: 180deg;
  background: linear-gradient(var(--ear-a), transparent 50%, var(--fam) 50%, color-mix(in srgb, var(--fam) 55%, var(--text)));
  opacity: .35;
  transition: --ear-a .3s var(--ori-ease), width .3s var(--ori-ease), height .3s var(--ori-ease), opacity .2s ease;
}
.focus .name { color: var(--fam); transform: translateX(4px); }
.focus .corner { opacity: 1; --ear-a: 225deg; width: 22px; height: 22px; }
@media (min-width: 760px) {
  .fams { grid-template-columns: repeat(3, 1fr); }
  .fam { border-top: 0; box-shadow: none; }
  .fam + .fam { border-left: 1px solid var(--line-strong); box-shadow: inset 1px 0 0 var(--ori-lit); }
  .fam + .fam .head, .fam + .fam .services, .fam + .fam .more { padding-left: 20px; }
}

.services { list-style: none; margin: 0; padding: 0; display: grid; }
.services a {
  display: grid; grid-template-columns: 2.5em 1fr; grid-template-areas: 'sn sname' 'sn short'; column-gap: 12px;
  padding: 10px 0; text-decoration: none;
  transition: color .15s ease;
}
.services a:hover .sname { color: var(--fam); }
.sn { grid-area: sn; font: 500 0.75rem/1 var(--mono); color: var(--fam); letter-spacing: .08em; padding-top: .35em; }
.sname { grid-area: sname; font: 600 1.0625rem/1.3 var(--display); transition: color .15s ease; }
.short { grid-area: short; font-size: 0.9375rem; color: var(--muted); line-height: 1.4; }
.more { margin: 8px 0 24px; font-size: 0.9375rem; }
.more a { font-weight: 600; text-decoration: none; color: var(--fam); }
.more a:hover { text-decoration: underline; }
@media (prefers-reduced-motion: reduce) {
  .name, .corner, .services a, .sname { transition: none; }
}
</style>
