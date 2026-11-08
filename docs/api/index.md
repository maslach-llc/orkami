# API

orkami is one package with four entries. The core is the model and the math; the drivers draw a
fold the core describes; the adapter puts a driver on a Vue page. Each layer imports only the ones
below it, and nothing below a driver touches the DOM.

| entry | doc | what it is | needs |
|---|---|---|---|
| `orkami` | [core.md](core.md) | the fold model, the named folds, schedules, the pose, light and style, FOLD, the glyphs | nothing |
| `orkami/css` + `orkami/orkami.css` | [css.md](css.md) | the CSS driver: flaps in the DOM, the page's sheet paint | a DOM |
| `orkami/three` | [three.md](three.md) | the WebGL driver: lit facets in three.js | `three` (optional peer) |
| `orkami/vue` | [vue.md](vue.md) | `v-unfold`, `<Unfold>`, `<Unfold3D>`, `<Word>`, `<Mark>`, `useFold()` | `vue` (optional peer); `three` for `<Unfold3D>` |

## How the pieces meet

- A `Fold` (core) is the only thing passed between layers: a driver takes one, or a factory
  `(width, height) => Fold` that is given the element's box.
- Time is `t` from 0 (closed) to 1 (flat). `pose(fold, t, schedule)` is the single source of every
  angle and transform; both drivers draw from it, so a fold looks the same in either.
- The look is a `Style` (core): tones, crease hairlines, grain, shadows and the one light. Pass
  overrides to any driver or component; `DEFAULT_STYLE` is the neutral paper.
- The decisions behind the model are D1 to D17 in [`../design/01-decisions.md`](../design/01-decisions.md);
  the words are defined in [`../design/00-vocabulary.md`](../design/00-vocabulary.md).

## Typing

Every entry ships its `.d.ts`. The Vue components ship as single-file source under `dist/vue/`
for the consumer's Vue tooling to compile, with `dist/vue/vue-shim.d.ts` declaring `*.vue`.
