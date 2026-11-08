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
  - `UnfoldOptions`: `hinge`, `step`, `delay` (ms before the first starts), `open` (given, opens on it turning true instead of on scroll), `style` (`StyleOverrides`), `print` (the driver's `Print`: `'landed'`, `'content'` or `{ image }`, D17), `still` (mounted flat with no motion and never opened: a block already seen, keeping the directive in the template), `mount` (the driver's other `MountOptions`).
  - Printing: the opening waits for every handle's `ready` (the picture decoded); a picture that fails is reported with `console.error` and the paper opens without it. A printed picture is the driver's to paint, so where the directive would otherwise leave the block untouched (reduced motion, on screen at hydration without `.always`) it mounts it `still` instead.
- `openWhenReady(handles)`: opens the handles once their prints are ready, as the directive does.
- `Hinge`: `'lift' | Edge | NamedFold`. `FoldSpec`: `Hinge | Fold | ((w, h) => Fold)`. `UnfoldValue`: `Hinge | UnfoldOptions | undefined`.
- `foldFor(spec)`: the factory `mount` takes for a hinge name, a `Fold` or a factory; throws on an unknown name. `unfoldOptions(value)`: the value normalized to `UnfoldOptions`.
- `handlesOf(el)`: the driver `Handle`s behind a bound element (one per staggered child), for a test or an inspector.

## useFold.ts: the composable

- `useFold(el, fold, options?)`: `el` a template ref or element, `fold` a `FoldSpec` (or a ref to one), `options` the driver's `MountOptions`. Mounts on `onMounted`, destroys on unmount.
- `UseFold`: `handle` (a shallow ref to the `Handle`, null before mount and after unmount), `t`, `state`, `landed` (refs kept in step with the handle), `open()` (waits for the handle's `ready` first), `close()`, `set(t)`.

## Unfold.vue: the component

- `<Unfold fold="blintz" :open="ready"><Card/></Unfold>`: a wrapper that lies folded as `fold` (a `FoldSpec`; `'lift'` by default) with the slot as the content printed on the root face. `open` given: opens on true and closes on false; unset: opens when scrolled into view. `tag` is the wrapper element (`div`), `style` the style overrides, `print` the driver's `Print` ('landed' by default), `still` (mounted flat with no motion; `open` and scrolling are ignored), `options` the driver's `MountOptions`; `print` and `still` are read at mount (key the component to change them). Emits `landed` once the paper lies flat. Exposes `handle`, `t`, `state`, `landed`, `open`, `close`, `set`.

## Unfold3D.vue: the WebGL component

- `<Unfold3D fold="MASLACH" />`: the fold unfolding as lit paper (`orkami/three`), then lying flat as its fallback. `fold` is a `Fold`, a `NamedFold` key (sized to the component's box) or a word for the glyphs (`wordFold`). Props: `palette` (the driver's `Palette` or `PaintFn`), `style`, `delay` (ms before an autoplay, 200), `duration` (ms, the schedule's length by default), `schedule`, `autoplay` (true), `label` (the accessible name; empty hides it), `print` (an `ImagePrint`: the picture across the fronts, the play waiting for it to load; its flat fallback is an `<img>` of it fitted as the paper lands it, unless the `flat` slot gives one), `still` (the flat fallback with no motion; `play()` still plays). Emits `done` at the landing. Exposes `play()`, `show()` (flat, no motion), `playing`, `open`.
- `<template #flat>`: the flat fallback, the `<Word>` of the word when `fold` is one. The canvas exists only while the unfold plays (D16): it lies over the fallback with the bleed `bleedFor` gives, the fallback hidden under it, and at the landing it fades out over the fallback in 300 ms and the WebGL context is freed. Reduced motion, no WebGL (the renderer throws) and no JavaScript (a `<noscript>` style) show the fallback. three.js is imported on the first play. The style's and palette's colors are resolved at the box when it plays (`resolveStyle`), so tones given as CSS tokens paint the lit paper as they compute then; the drawing buffer is the canvas's rendered size, so a box scaled by a transform (a lockup growing into a hero) draws sharp.

## Word.vue and Mark.vue: the flat glyphs

- `<Word text="MASLACH" />`: `wordSvg` as an inline `<svg>`, server rendered. Props `text`, `height` (px; the width follows, else it fills its container's width), `label`, `shadow` (the style's `shadows.on`), `grain` (the style's), `style`. Tones may be any CSS color: a hex is the gradient stop's attribute, anything else its `style`, so a `var()` follows the page's tokens (a theme, a palette) with no new markup.
- `<Mark />`: a one-letter `Word` (`text` `'M'`), `height` 28, no shadow, for a header.

## FoldLoader.vue: the loader

- `<FoldLoader :ready="ready" @done="reveal" />`: a centered square of paper (`div.ori-loader`, `role="status"` with the `aria-label`, holding the `size` x `size` square `div.ori-loader-paper`, which wears the sheet paint as `.ori-paper` does and which the driver mounts the loop on) looping the core's `loop` on the CSS driver's `mountLoop` until `ready`, then stopping: it finishes the move it is in and lands flat (D18). Rendered only on the client: the server renders nothing for it, so with no JavaScript it never shows.
- Props: `ready` (boolean, required), `steps` (`NamedFold[]`, `['waterbomb', 'preliminary', 'blintz']`), `size` (px, 96), `minMs` (600: once shown it shows at least this long, so it never flashes), `skipWithin` (150: if `ready` is true within this many ms of mounting it renders nothing at all; nothing is rendered before then either), `hold`, `gap` (passed to `loop`), `style` (`StyleOverrides`), `ariaLabel` (`'Loading'`).
- Emits `done` once the paper lies flat after `ready`; at once when skipped or under reduced motion.
- Reduced motion: the flat square, still, and `done` as soon as `ready` (D18). The flat sheet stays after `done`: the site removes the component or lets the flat sheet become the page's background.

## FoldModel.vue: a model folded in steps (D19)

- `<FoldModel model="preliminaryKite" :step="k" />`: a `size` x `size` square of paper drawn by the CSS driver's `mountModel`, playing to `step` (an s: 0 the flat sheet, k the end of step k) whenever it changes, from wherever the paper is, at the steps' own pace: forward folds, backward unfolds.
- Props: `model` (a `NamedModel`, a `Model`, or a factory from the side; `'preliminaryKite'`), `step` (unset: stays where `at` put it until `play()`), `at` (the s to mount at, 0), `size` (px, 240), `style` (`StyleOverrides`), `pace` (a multiplier on every step's duration, 1; the playground's slow toggle passes 4), `tag` (`'div'`). `model`, `size`, `style` and `pace` rebuild the paper at the current s.
- Emits `step` with s on every arrival, `done` when it arrives at the finished model.
- Exposes `handle` (the `ModelHandle`), `s`, `playing`, `play(to?)` (to the end by default; resolves on arrival) and `set(s)` (no motion).

## loader.ts: the loader's timing

- `loaderPlan(readyAt, now, { minMs, skipWithin })`: pure, what `<FoldLoader>` shows at `now`; times in ms since mount, `readyAt` undefined until ready. Returns `{ phase, next? }`: `'skip'` when `readyAt <= skipWithin`; `'wait'` (render nothing yet, `next` = `skipWithin`) while `now < skipWithin`; `'loop'` while not ready, or ready but before `max(readyAt, skipWithin + minMs)` (`next` = that moment); `'stop'` after.

## index.ts

- `plugin` (also the default export): `app.use(plugin)` registers `v-unfold`, `<Unfold>`, `<Unfold3D>`, `<Word>`, `<Mark>`, `<FoldLoader>` and `<FoldModel>`.
- Re-exports `vUnfold`, `foldFor`, `handlesOf`, `openWhenReady`, `unfoldOptions`, `useFold`, `Unfold`, `Unfold3D`, `Word`, `Mark`, `FoldLoader`, `FoldModel`, `loaderPlan` and the types above.
