# API: the Vue adapter

`import { ... } from 'orkami/vue'`: the Vue 3 adapter on the CSS driver (`docs/api/css.md`) and
the WebGL driver (`docs/api/three.md`), with `orkami/orkami.css` imported once by the app. `vue` is an optional peer dependency (`^3.5`);
the single-file components ship as source under `dist/vue/` for the consumer's Vue tooling to
compile (`dist/vue/vue-shim.d.ts` declares the module; the build points their relative imports at
the emitted `.js`). `three` is an optional peer too, loaded only by `<Unfold3D>`'s first play. Everything is client only: the directive
is a no-op on the server (`getSSRProps`), the composable mounts in `onMounted`, so server HTML
is flat and the fold is applied at hydration. A bound element must not clip (orkami.css).

## unfold.ts: the directive

- `vUnfold`: `v-unfold` on a block: it lies folded in the page and unfolds when it scrolls into view (an `IntersectionObserver`, 5 percent in, 8 percent above the fold). A block already on screen at hydration is left flat unless `.always`. Under reduced motion the directive does nothing.
  - `v-unfold` (no value): a lift on the top edge. `v-unfold="'left'"` (`top`, `bottom`, `right`): a lift on that edge, folded over, paper back first. `v-unfold="'blintz'"`: any `NamedFold` by name. `v-unfold="{ hinge: fold }"`: a `Fold` or a factory `(w, h) => Fold`.
  - `.stagger`: each child is its own fold, `step` ms apart (90 by default). `.refold`: folds back (instantly) once more than a screen away and unfolds again on the way back. `.always`: folds even a block on screen at hydration.
  - `UnfoldOptions`: `hinge`, `step`, `delay` (ms before the first starts), `open` (given, opens on it turning true instead of on scroll), `style` (`StyleOverrides`), `mount` (the driver's other `MountOptions`).
- `Hinge`: `'lift' | Edge | NamedFold`. `FoldSpec`: `Hinge | Fold | ((w, h) => Fold)`. `UnfoldValue`: `Hinge | UnfoldOptions | undefined`.
- `foldFor(spec)`: the factory `mount` takes for a hinge name, a `Fold` or a factory; throws on an unknown name. `unfoldOptions(value)`: the value normalized to `UnfoldOptions`.
- `handlesOf(el)`: the driver `Handle`s behind a bound element (one per staggered child), for a test or an inspector.

## useFold.ts: the composable

- `useFold(el, fold, options?)`: `el` a template ref or element, `fold` a `FoldSpec` (or a ref to one), `options` the driver's `MountOptions`. Mounts on `onMounted`, destroys on unmount.
- `UseFold`: `handle` (a shallow ref to the `Handle`, null before mount and after unmount), `t`, `state`, `landed` (refs kept in step with the handle), `open()`, `close()`, `set(t)`.

## Unfold.vue: the component

- `<Unfold fold="blintz" :open="ready"><Card/></Unfold>`: a wrapper that lies folded as `fold` (a `FoldSpec`; `'lift'` by default) with the slot as the content printed on the root face. `open` given: opens on true and closes on false; unset: opens when scrolled into view. `tag` is the wrapper element (`div`), `style` the style overrides, `options` the driver's `MountOptions`. Emits `landed` once the paper lies flat. Exposes `handle`, `t`, `state`, `landed`, `open`, `close`, `set`.

## Unfold3D.vue: the WebGL component

- `<Unfold3D fold="MASLACH" />`: the fold unfolding as lit paper (`orkami/three`), then lying flat as its fallback. `fold` is a `Fold`, a `NamedFold` key (sized to the component's box) or a word for the glyphs (`wordFold`). Props: `palette` (the driver's `Palette` or `PaintFn`), `style`, `delay` (ms before an autoplay, 200), `duration` (ms, the schedule's length by default), `schedule`, `autoplay` (true), `label` (the accessible name; empty hides it). Emits `done` at the landing. Exposes `play()`, `show()` (flat, no motion), `playing`, `open`.
- `<template #flat>`: the flat fallback, the `<Word>` of the word when `fold` is one. The canvas exists only while the unfold plays (D16): it lies over the fallback with the bleed `bleedFor` gives, the fallback hidden under it, and at the landing it fades out over the fallback in 300 ms and the WebGL context is freed. Reduced motion, no WebGL (the renderer throws) and no JavaScript (a `<noscript>` style) show the fallback. three.js is imported on the first play.

## Word.vue and Mark.vue: the flat glyphs

- `<Word text="MASLACH" />`: `wordSvg` as an inline `<svg>`, server rendered. Props `text`, `height` (px; the width follows, else it fills its container's width), `label`, `shadow` (true), `grain` (the style's), `style`.
- `<Mark />`: a one-letter `Word` (`text` `'M'`), `height` 28, no shadow, for a header.

## index.ts

- `plugin` (also the default export): `app.use(plugin)` registers `v-unfold`, `<Unfold>`, `<Unfold3D>`, `<Word>` and `<Mark>`.
- Re-exports `vUnfold`, `foldFor`, `handlesOf`, `unfoldOptions`, `useFold`, `Unfold`, `Unfold3D`, `Word`, `Mark` and the types above.
