# Changelog

All notable changes to orkami. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [semantic versioning](https://semver.org/) (before 1.0, a minor bump may break the API).

## [Unreleased]

## [0.1.2] - 2026-11-05

### Fixed

- A lifted block with no background of its own no longer keeps the sheet paint once it has
  landed: the paint was measured where the block lay when it mounted, so a page that moved after
  (fonts, images) showed it as a patch of misplaced sheet. It now drops `.ori-paper` at the
  landing and the page's own sheet shows through.
- `<Unfold3D>` draws at the canvas's rendered size, so a box scaled up by a transform no longer
  shows a blurred, blocky canvas.
- `wordSvg` writes a tone that is not a hex in the stop's `style` instead of its `stop-color`
  attribute, where browsers ignore a `var()`.

### Added

- Tones may be any CSS color in every driver: `resolveStyle`, `resolvePalette` and `cssColor`
  in `orkami/three` turn them into the colors they compute to at an element, `parseColor` reads
  `color(srgb ...)`, and `<Unfold3D>` resolves its style and palette at its box on each play. A
  host can give its tones as its own tokens (`var(--brand)`, `color-mix()`) and have a theme or
  a palette recolor the word in every driver.

## [0.1.1] - 2026-11-05

### Fixed

- The `waterbomb` and `preliminary` bases no longer sink below the page as they open. Their
  assignments were the ones seen from below, so every layer but the root turned under the sheet:
  the CSS driver's ground painted over them (one triangle showed) and WebGL drew a dish sunk into
  the page. They are now modelled from the side that faces the visitor, rising toward them as one
  coupled motion; the closed pose takes the folded end of the closure, so the closed base stacks
  as `stackOrder` says.
- The CSS driver no longer draws a hole where a face stays in the sheet beside the root (the
  waterbomb's T2, the preliminary's Tl): such a face gets no ground to fight its flap for depth.
- The CSS driver's cast shadows no longer run ahead of the paper on the transition drive: the
  clock that paints them now starts with the flaps' transitions (the browser's next style pass,
  which on a fresh mount can come 100 ms or more after `open()`), not with the call.

### Changed

- Shadows are contact hardening in both drivers (D15): sharp and dark where a flap meets the sheet,
  softer and paler with the gap, by the new `penumbra()`. WebGL uses percentage-closer soft
  shadows on a plain depth map in place of VSM's one radius per frame; the CSS driver casts each
  flap along the light onto its parent's plane, meeting its crease, with a contact layer and a
  penumbra layer masked along the flap. Before, a lifted flap's shadow was as soft and faint at its
  crease as at its tip.
- The accordion opens as a pleat: all creases at once, the inner ones at twice the first, so it
  stands up on its first crease and fans out along the table instead of swinging each opened run
  through the air.
- The blintz and the kite open their flaps together; `sequence(...)` still gives a hand's order.
- The wordmark unfolds from packets that lie in each letter's own place: every glyph is rooted in
  its middle facet (the M folded in half on its centre crease, the S and the C folded in onto their
  middles, the H's stems over its bar) and opens its flaps one after the other, the top of the
  packet first (`Glyph.order`), each starting most of the way into the one before (`OVERLAP`,
  `wordFold`'s `overlap`). Before, the whole folded packet swung through the air on each crease
  with the next flaps still opening on it, and pieces of the C and the H flew out of their letters.
  `step` still gives the seed's fixed 60 ms step. The resting lockup is unchanged.
- `shadowSoftness(height)` is now `penumbra(height).sigma`.

### Added

- `Entry.follow` (a crease coupled to another), `foldedAt` and `transitionable` in the schedule;
  FOLD carries a follow as `edges_orkami:follow`.
- `penumbra()` in the core; `castShadow()` in the CSS driver; `contactUniforms`,
  `contactMaterial` and `contactChunk` in the WebGL driver.
- `Face.seam`, `seamOf()` and `shadeSeams()`: the crease a shade face's gradient and hairline
  colour come from when it is not the one the face hangs on (FOLD `faces_orkami:seam`).
- `stackOrder` stacks overlapping siblings folded onto the same side, the later over the whole of
  the earlier (D12).
- `Style.shadows.on` (default true) turns shadows off in every driver: the CSS driver makes no
  shadow layers and paints none per frame, the WebGL stage has no shadow map and no floor, and
  `wordSvg` (and `<Word>`) drops the resting pair unless `shadow` is given. The playground's Word
  page has a shadows toggle.

## [0.1.0] - 2026-11-02

The first release: the engine, two drivers, the Vue adapter and the playground.

### Added

- The core (`orkami`): the fold model (faces, creases with mountain and valley assignment, a hinge
  tree rooted on the face that stays put), per-crease schedules over a global `t` (`together`,
  `sequence`, `stepwise`, `timed`), the pose at any `t` with the single-vertex closure for the two
  bases, the layer order of a closed fold, one Lambert light, a themable style, FOLD 1.2 import and
  export, and the Maekawa and Kawasaki checks. No runtime dependency, no DOM.
- Nine named folds: `book`, `lift`, `cupboard`, `accordion`, `blintz`, `diagonal`, `kite`,
  `waterbomb`, `preliminary`, each with the rectangles it suits.
- The glyphs: the wordmark's letters as folds (`wordFold`, `layout`, `wordSvg`).
- The CSS driver (`orkami/css`, `orkami/orkami.css`): two-sided clipped flaps on a registered
  `<angle>`, the sheet paint that makes a folded block read as the page's own paper, per-frame
  shadows, a CSS-transition drive and a frame drive; a word mounts with every letter facet as a flap.
- The WebGL driver (`orkami/three`): the same fold as lit facets in three.js, one directional light,
  a soft shadow floor, a camera at the CSS driver's perspective.
- The Vue adapter (`orkami/vue`): `v-unfold`, `<Unfold>`, `<Unfold3D>`, `<Word>`, `<Mark>`,
  `useFold()`.
- The playground (`npm run play`): Folds, Sequence, Page, Word and Look pages.
- The study (`docs/study/`), the vocabulary and decisions D1 to D16 (`docs/design/`), and the API
  reference (`docs/api/`).

[Unreleased]: https://github.com/maslach-llc/orkami/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/maslach-llc/orkami/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/maslach-llc/orkami/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/maslach-llc/orkami/releases/tag/v0.1.0
