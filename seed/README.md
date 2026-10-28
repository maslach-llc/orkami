# seed/ — the backbone this engine grows out of

Verbatim copies of the origami motion system built for maslach.com (Nuxt 4, October 2026),
here so the first plan docs can port it without reading another repo. Nothing in this folder
is imported by `src/`; each file is deleted once its replacement lands in `src/` (docs 02 to
04 in the planning tree), and the folder goes with the last one.

- `utils/origami.ts` — the wordmark's glyphs as facet trees (polygon, parent, hinge, lit) and
  `layout()`: the model the WebGL unfold hangs off.
- `utils/sheet.ts`, `utils/sheetPaint.ts` — the page's sheet (seven large facets) and the paint
  that puts the sheet under any element so a folded flap is the background until it moves.
- `unfold.ts` — the `v-unfold` directive: hinges `lift`, `top|bottom|left|right`, `blintz`,
  `diagonal`; stagger, refold and `open` signal; the two-sided flaps with reflected backs.
- `origami.css` — the tokens, the registered `--ori-a` angle, and the fold rules the directive
  relies on (sections 2, 2b, 2c, 2d).
- `components/` — the Vue side: the CSS unfold (`OrigamiUnfold.vue`, per-facet
  `OrigamiUnfoldFace.vue`), the three.js unfold (`OrigamiUnfold3D.vue`), the flat SVG wordmark
  and mark, the sheet, and the two hero components that drive them on the home page.
