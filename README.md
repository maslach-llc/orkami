# orikami

Origami for the web. A block of a page lies folded in its background as a shape of paper and
unfolds out of it when it is needed, the way real paper does: faces turn on the creases they
share, the backs show the sheet they were folded over, one light shades every face.

Early. The engine is being built in the open from the motion system of
[maslach.com](https://www.maslach.com); the plan is in the commit history and the study of how
paper folds, and what reads as paper on a screen, lands in `docs/study/` first.

## What it will be

- `orikami` — the core: a fold model (faces, creases, a hinge tree), a library of named folds
  (book, lift, blintz, diagonal, cupboard, accordion, waterbomb, preliminary, ...), FOLD-format
  import and export, and a schedule that gives every crease its angle at any time. No runtime
  dependency, no DOM.
- `orikami/css` — the CSS driver: two-sided clipped flaps driven by a registered `<angle>`
  property, and the sheet paint that makes a folded flap read as the page's own background.
- `orikami/three` — the WebGL driver: the same fold as lit facets in three.js.
- `orikami/vue` — the Vue 3 adapter: `v-unfold`, `<Unfold>`, `<Unfold3D>`, `useFold()`.

## Development

```bash
npm install
npm run verify   # typecheck, tests, build
```

Node 24 or newer (tests are TypeScript run by `node --test`).

MIT, Maslach LLC.
