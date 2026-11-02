# seed/ — the backbone this engine grows out of

Verbatim copies of the origami motion system built for maslach.com (Nuxt 4, October 2026),
here so the first plan docs can port it without reading another repo. Nothing in this folder
is imported by `src/`; each file is deleted once its replacement lands in `src/` (docs 02 to
04 in the planning tree), and the folder goes with the last one.

- `utils/origami.ts` — ported: the wordmark's facet trees and `layout()` now live in `src/glyphs/` (doc 02).
- `utils/sheet.ts`, `utils/sheetPaint.ts`, `unfold.ts`, `origami.css`, `components/OrigamiUnfold.vue`,
  `OrigamiUnfoldFace.vue`, `OrigamiSheet.vue`, `HeroServices.vue` — ported: the CSS driver, the
  sheet paint and the Vue adapter now live in `src/css/` and `src/vue/` (doc 03).
- `components/` — what remains for doc 04: the three.js unfold (`OrigamiUnfold3D.vue`), the flat
  SVG wordmark and mark (`OrigamiWord.vue`, `OrigamiMark.vue`), and the hero that drives them on
  the home page (`HeroBrand.vue`).
