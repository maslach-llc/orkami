# Changelog

All notable changes to orkami. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [semantic versioning](https://semver.org/) (before 1.0, a minor bump may break the API).

## [Unreleased]

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
- `shadowSoftness(height)` is now `penumbra(height).sigma`.

### Added

- `Entry.follow` (a crease coupled to another), `foldedAt` and `transitionable` in the schedule;
  FOLD carries a follow as `edges_orkami:follow`.
- `penumbra()` in the core; `castShadow()` in the CSS driver; `contactUniforms`,
  `contactMaterial` and `contactChunk` in the WebGL driver.

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

[Unreleased]: https://github.com/maslach-llc/orkami/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/maslach-llc/orkami/releases/tag/v0.1.0
