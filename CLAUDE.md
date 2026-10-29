# CLAUDE.md — orkami conventions

Origami for the web, as a library: a fold engine that lets a block of a page lie folded in its
background as a shape of paper and unfold out of it, the way real paper does. Grown out of the
motion system built for maslach.com in October 2026 (copied verbatim into `seed/` until each
piece is ported) and meant to be open source: MIT, `github.com/el3vilen/orkami`, published to
npm as `orkami`. maslach.com is its first consumer and its proving ground, not its owner: nothing
in `src/` may know about that site.

Started 2026-10-28. The plan docs in `todos/` are the spec; this file is only the conventions.

## Layout

- `src/core/` — the engine: plane geometry (`affine.ts`), the fold model (a sheet as faces and
  creases with mountain/valley assignment, a hinge tree rooted on the face that stays put, a
  schedule that gives every crease its angle at time t), the library of named folds (book, lift,
  blintz, diagonal, cupboard, accordion, waterbomb, preliminary, ...), FOLD-format import and
  export, Lambert shading. No DOM, no framework, no runtime dependency, fully unit-tested.
- `src/css/` — the CSS driver: turns a fold into flaps (two-sided, clipped, the backs the
  reflection of the sheet under them) driven by a registered `<angle>` property, plus the sheet
  paint that makes a folded flap read as the page's own background. `orkami.css` ships beside it.
- `src/three/` — the WebGL driver: the same fold as lit facets in three.js, nested groups hinged
  on the creases, one directional light and a shadow floor. `three` is an optional peer.
- `src/vue/` — the Vue 3 adapter: the `v-unfold` directive, `<Unfold>` and `<Unfold3D>`
  components, `useFold()`. `vue` is an optional peer. Other adapters (React, Svelte, web
  component) are welcome later; they must sit on the drivers, never on each other.
- `src/glyphs/` — letters as folds (the Maslach wordmark's facet trees are the first), so a logo
  can unfold like everything else.
- `docs/` — the study (`docs/study/`), the design vocabulary and decisions (`docs/design/`), the
  API reference. Written before the code they describe, kept true after.
- `playground/` — a small Vite + Vue page showing every named fold, the wordmark and a fold
  inspector. The place to look at the paper; not shipped.
- `seed/` — the maslach.com originals, deleted piece by piece as `src/` replaces them.
- `test/` — `node --test` over `.ts` files (Node 24+ strips types natively); no test framework.

## Hard rules

- **The paper rule.** Every motion the engine produces must be one a sheet of paper can make:
  a face rotates about a crease it shares with its parent, faces never change shape, nothing
  scales, nothing flies, nothing fades in place of folding. A fold that would tear the sheet is
  a bug, not an effect. Content on a face is printed on the paper: it moves with the face and
  shows reversed through the back only if the design says the paper is thin.
- **One light.** Shade comes from the angle between a face and one light (Lambert), the same
  light in the CSS and WebGL drivers, so a fold looks the same whichever driver draws it.
- **Framework-agnostic core.** `src/core/` imports nothing outside itself and never touches
  `document`, `window` or a framework. Drivers touch the DOM or WebGL; adapters touch a
  framework. A feature that needs the DOM goes in a driver, not the core.
- **Dependencies.** Runtime: none in the core, `vue` and `three` as optional peers only.
  Approved dev dependencies: `typescript`, `vue`, `three`, `@types/three`, and for the
  playground `vite` and `@vitejs/plugin-vue`. Anything else needs the owner: file the doc to
  `todos/waiting/` with the reason rather than installing it.
- **Verification is `npm run verify`** = typecheck (`tsc --noEmit`), tests (`node --test`), build
  (`tsc` to `dist/`). It must pass before every merge. Looking at the paper in a browser is a
  manual step for the owner (file it to `waiting/` with the exact page to open) unless a browser
  tool is available in the session.
- **Public repo.** No client names, screenshots, credentials, `.env` values or maslach.com
  business copy anywhere in the repo; the wordmark glyphs are the one brand asset and they are
  here as a demo of letters as folds. Conventional commits
  (`add/improve/fix/change/remove/docs/build`), no AI attribution, never push, never publish:
  tagging, pushing, flipping the repo public and `npm publish` are the owner's steps.
- **Docs first.** A named fold is added with its crease pattern drawn in the doc (ASCII or SVG)
  and its fold and unfold order written down before the code; the API reference changes in the
  same commit as the API.
