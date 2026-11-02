# The landscape

What exists, what to take from each, what to avoid, and the plain answer to the question the
plan asks: is there a library that already does what orkami wants (rigid folding of page blocks
with painted backs, driven by CSS or WebGL, usable from a framework)? Surveyed 2026-11-02; every
entry names what was read and when. Activity dates come from the GitHub API (`gh api`) on that
day; stars are the same day's count.

## The plain answer

No. The geometry exists twice over (Rabbit Ear, the FOLD library) and the simulators exist as
apps (Origami Simulator, Tachi's), but nothing folds a block of a page as paper. The only "DOM as
paper" library, oriDomi, slices an element into parallel strips and turns them; it has no crease
patterns, no painted backs, no FOLD, and its last commits (2024) are readme edits. The page-fold
demos on Codrops are jQuery of 2012 with linear easing. The seed's own CSS layer (registered
`<angle>` property, two-sided clipped flaps, sheet paint) is already further along than any of
them for the page-block case. So orkami is built, on FOLD as its interchange format, with Rabbit
Ear as a reference it cannot vendor (GPL) and Origami Simulator as the yardstick for "looks like
paper" in motion. The owner decides; this is the expectation the seed held, confirmed.

## The survey

### oriDomi

- https://github.com/dmotz/oridomi and https://oxism.com/oriDomi/ (read 2026-11-02). "Fold up
  DOM elements like paper", Dan Motzenbecker. MIT. `package.json` 1.1.5; 2413 stars; last push
  2024-08-13, the last five commits all readme and URL updates; the oldest visible commit
  2014-06-24. CoffeeScript source, zero dependencies, about 20 KB minified, "IE 10 and below lack
  this" (needs `preserve-3d`).
- How it works: the element is split into `vPanels` / `hPanels` strips that are transformed in
  3D (freefrontend.com/oridomi-js/, read 2026-11-02: "splitting an element into panels and
  transforming those panels in 3D space"); options `perspective`, `shading` / `shadingIntensity`,
  `speed`, `ripple` (a stagger, forward or backward), `maxAngle`, `touchEnabled`; methods
  `accordion`, `curl`, `ramp`, `reveal`, `stairs`, `fracture`, `collapse`, `foldUp`, `unfold`,
  plus a queue ("you can call asynchronous methods synchronously and the operations will
  intelligently queue themselves"), `map` for pointer-driven folding, `modifyContent`. That the
  panels are clones of the content rather than the live DOM is *unverified, from memory* (the
  annotated source was not read).
- Take: the API shape (a fold as a named method with a queue; `ripple` as the stagger), pointer
  dragging a fold (`map`), the accordion as the base case.
- Avoid: parallel strips only (no crease pattern, no blintz, no interior vertex), shading as a
  flat overlay with no light, no back face (a strip's back is its front), no FOLD, no framework
  adapter, a decade without feature work.
- Verdict: the closest predecessor in intent; nothing to reuse as code.

### Origami Simulator

- https://origamisimulator.org/ and https://github.com/amandaghassaei/OrigamiSimulator (README,
  `js/globals.js`, `index.html`; read 2026-11-02). Amanda Ghassaei, with Erik Demaine and others;
  MIT; 1407 stars; last push 2026-10-13 ("Fix segment indexing in circle and ellipse; assign zero
  fold angles"). Paper: Ghassaei, Demaine, Gershenfeld, "Fast, Interactive Origami Simulation
  using GPU Computation", Origami7 (2018), https://erikdemaine.org/papers/OrigamiSimulator_Origami7/.
- How it works: "attempts to fold every crease simultaneously" by "iteratively solving for small
  displacements in the geometry of an initially flat sheet"; a compliant dynamic model (axial
  springs, crease springs toward a target angle, face-flatness constraints) run "in parallel in
  several GPU fragment shaders"; one Fold Percent scales every target angle. Imports SVG (mountain
  red, valley blue, boundary black, cut green, undriven magenta, facet yellow; fold angle by the
  line's opacity, 1.0 = 180 degrees) and FOLD (needs `vertices_coords`, `edges_vertices`,
  `edges_assignment`, `faces_vertices`; targets from `edges_foldAngle`); exports FOLD, STL, OBJ.
  three.js for rendering; FOLD as the internal structure.
- Take: FOLD as the interchange format and the four required keys; the SVG color convention for
  a later SVG import; the one-parameter fold as the default schedule; the look of a damped settle.
- Avoid: it is an app with global state, not a library; the solver is non-rigid and GPU-bound; no
  DOM.
- Verdict: the yardstick for motion, the test bed for orkami's FOLD exports; not a dependency.

### Rabbit Ear

- https://github.com/rabbit-ear/rabbit-ear (readme, `package.json`, `src/` tree via the GitHub
  API; read 2026-11-02). "A Javascript library for modeling origami", Amber Kraft. **GNU GPLv3**.
  0.9.41 alpha, released 2026-10-16; 655 stars; last push 2026-10-21. The docs site
  https://rabbitear.org/ was unreachable this session (its TLS certificate is GitHub's, so both
  WebFetch and Chromium refused it); the readme points to it.
- What it has (from `src/`): `axioms`, `convert`, `diagrams`, `fold`, `graph` (flaps, pleat,
  planarize, triangulate, validate, trees, ...), `layer` (a layer solver: `solver.js`,
  `tacosTortillas.js`, `constraints3D*.js`), `singleVertex`, `svg`, `webgl` (`creasePattern`,
  `foldedForm`), `math`. "Rabbit Ear contains methods for modifying FOLD graphs, a math library,
  an SVG and WebGL rendering library, and various methods for making origami-related
  calculations" (readme). Nothing about animating a fold or folding DOM elements.
- Take: the vocabulary of FOLD graph operations as a reference when doc 02 writes the model; the
  existence of a layer solver (for `faceOrders` of a flat-folded state) as the way to go if orkami
  ever needs stacking beyond what its named folds fix by hand; the single-vertex module as a
  check on the closure solver.
- Avoid: vendoring or depending on it: GPLv3 is incompatible with orkami's MIT distribution, and
  the library is far larger than the engine. Alpha API.
- Verdict: the reference implementation of origami math in JavaScript; read, never imported.

### FOLD (the spec and its library)

- https://github.com/edemaine/fold and the spec
  https://raw.githubusercontent.com/edemaine/fold/main/doc/spec.md (version 1.2; read
  2026-11-02). Erik Demaine, Jason Ku, Robert Lang. MIT; 424 stars; last push 2024-01-04. The
  format "for describing origami models" plus "web software tools and JavaScript libraries to aid
  in manipulation of FOLD files": a `FOLD.filter`, `convert`, `geom` API, a `fold-convert` CLI
  (ORIPA `.opx` to `.fold`, flat folding) and a FOLD viewer that "loads and display a given .fold
  file, useful for visualization and testing".
- Take: the spec, in the subset `01-how-paper-folds.md` section 2 fixes; the viewer and
  https://foldfile.com/ (linked from the Rabbit Ear readme, not visited) for checking exports.
- Avoid: the library itself as a dependency (orkami's core has none; the subset it needs is a
  few hundred lines).
- Verdict: the interchange format. Settled.

### Tachi's Rigid Origami Simulator and Freeform Origami

- https://tsg.ne.jp/TT/software/ and https://origami.c.u-tokyo.ac.jp/~tachi/cg/ (read
  2026-11-02); Tachi, "Simulation of Rigid Origami", Origami4, 2009 (draft PDF, sections 1 and 2
  read). Rigid Origami Simulator 0.09 (2010-09-19, Windows), Freeform Origami 1.1 (2020-06-16);
  "proprietary software", free for non-commercial use with attribution.
- The method: the configuration is the vector of crease angles; each interior vertex gives the
  constraint that the product of the rotations about its creases is the identity; the motion is
  found by "projecting angles motion to the constrained space" (the Jacobian's generalized
  inverse), so all creases drive at once and the panels stay rigid.
- Take: the model (angles as the state, faces as rigid plates) and the single-vertex constraint,
  which is what orkami's closure solver enforces for the waterbomb and preliminary bases.
- Avoid: nothing to reuse (binary, Windows, proprietary).
- Verdict: the academic reference for rigid folding; its math is in doc 01.

### Lang's TreeMaker

- https://langorigami.com/article/treemaker/ (read 2026-11-02). Robert J. Lang. GPL, source
  available; 5.0.1; macOS to Mojave, Linux, Windows; "no plans for further updates" (page dated
  2015-09-19, a 2025-01-30 note about Sonoma). Designs an origami base from a stick figure by
  circle/river packing and generates the full crease pattern with mountain/valley assignment.
- Take: nothing for the engine; a pointer for the future glyph work (a letter as a tree of flaps
  is TreeMaker's input exactly).
- Verdict: reference only.

### The seed's `@property` CSS approach

- `seed/origami.css`, `seed/unfold.ts`, `seed/components/OrigamiUnfold.vue` (read 2026-11-02).
  A registered `--ori-a: <angle>` with a CSS transition on it, so the shade follows the angle
  through `calc(sin(var(--ori-a)))`; `rotate3d(ux, uy, 0, angle)` about a crease given by a
  transform origin and an axis; two-sided flaps (`.front` / `.back`, `backface-visibility`), the
  back clipped to the mirror polygon and painted with the sheet reflected across the crease
  (`compose(mirror, reflect(hinge, axis))` as a `matrix()`); the sheet paint kept pointed at the
  paper under the element on scroll; a recursive hinge component for nested facets; reduced
  motion and no-JS fallbacks to the flat state.
- Take: all of it. It is the CSS driver's base and the only approach in this survey that already
  does the painted back.
- Avoid: the `-90 degree` lift start, the content fade at landing, the `0.08 pi` root tilt, the
  seed's `v-unfold` being one Nuxt plugin that knows the site (sheet tones, palette).
- Verdict: port, generalize, keep.

### three.js and the WebGL route

- `seed/components/OrigamiUnfold3D.vue` (read 2026-11-02): nested `Group`s hinged on the creases
  (a quaternion from the crease axis and the angle), `ShapeGeometry` faces, a front
  `MeshStandardMaterial` and a `BackSide` back, one `DirectionalLight` from the upper left with a
  2048 shadow map onto a `ShadowMaterial` floor at 0.22, an `AmbientLight` 0.3, a camera 2.2
  widths away, three.js imported on first play.
- Take: the hinge groups and the shadow floor; switch the material to `MeshLambertMaterial` so the
  tone is the same Lambert the CSS driver computes (`02-paper-on-a-screen.md`, cue 1).
- Avoid: WebGL for blocks with content (the content would be a texture); WebGL for everything
  (three.js is an optional peer, the CSS driver is the default).
- Verdict: the driver for lit geometry (glyphs, the hero's loop), beside the CSS driver.

### Codrops and Awwwards: the page-fold and paper sites

- PFold, https://tympanus.net/codrops/2012/10/17/pfold-paper-like-unfolding-effect/ (Manoela
  Ilic, 2012-10-17; read 2026-11-02 in Chromium, the site refuses plain fetches). "The idea is to
  have several levels of folding, where each step of opening will double the element size, hence
  imitating a folded paper being opened"; options `perspective 1200`, `speed 450`, `easing
  'linear'`, `folds 2`, `folddirection ['right', 'top']`, `overlays: true` ("to simulate a
  shadow for each folding step"). jQuery. What is right: the doubling per step is the accordion
  and book unfold of doc 01, and the overlays are cue 1 in its crudest form. What is wrong: linear
  easing, no back, no light. The Codrops tag page https://tympanus.net/codrops/tag/folding/ lists
  only PFold (read 2026-11-02); the 2013 "3D Folding Panel" demo remembered from the same site is
  *unverified, from memory*, and its URL now returns 404.
- Awwwards: https://www.awwwards.com/inspiration/unfolding-effect ("Unfolding effect from B&O
  PLAY Spring/Summer 2017", Michael Vestergaard; tags landing page, photography, animation) and
  https://www.awwwards.com/inspiration/paper-effect (Florent Biffi, portfolio 2018; tags effect,
  animation, paper, font); both read 2026-11-02; both are listings with a thumbnail and no
  description of the mechanism, and the sites themselves were not reached. A web search for
  Awwwards sites of the day with origami or paper-fold motion found none that could be named.
- lynnandtonic.com, https://lynnandtonic.com/thoughts/entries/case-study-2020-refresh/ (Lynn
  Fisher, 2020-12-14; read 2026-11-02). A home page built as folding paper: "I liked the idea of
  treating page elements like paper: light but rigid, foldable, and layered"; panels of images
  whose widths squash with the viewport, "skewed using `transform: skewY()`" with the fold's
  dimension coming from `:after` gradient highlights and shadows whose opacity steps through
  stacked media queries "to mimic changing light as the panels fold". Why it reads as paper: hard
  panel edges, light that changes across the fold line, a shadow at the crease, the three top
  cues of doc 02. Why it is not a fold: skew is not a rotation (chosen because it "avoids shifting
  during resize"), so the panel changes shape; the paper rule rules it out, and the cues it
  confirms are already in the list.

## What the survey settles

- FOLD is the interchange format; the subset is in doc 01, section 2.
- Rabbit Ear is read, never imported (GPL); the FOLD library is not needed (the subset is small).
- Origami Simulator is where an orkami export is opened to check that it folds, and the look to
  match for a damped landing.
- oriDomi's API shape (named folds, a queue, a stagger, a pointer-driven fold) is worth
  echoing; its mechanism is not.
- The seed's CSS layer and three.js scene are the two drivers' starting points.
- Nothing found does the painted back. That, with the rigid hinge tree, is the thing orkami adds.
