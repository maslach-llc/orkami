# Decisions

The decision record. Numbered, never renumbered; a reversed decision gets a new entry that names
the one it reverses. Each entry: the decision, the reason, what it rules out. Started 2026-11-02
from `docs/study/`; doc 02 onward append.

## D1. The model is rigid origami

**Decision.** A fold is a set of rigid faces joined by creases. A face moves only by rotating
about a crease it shares with its parent; its shape never changes; the sheet stays joined across
every crease; nothing passes through anything; fold angles live in [-180, 180] with FOLD's sign
(valley positive). Rest states are angle 0 (flat) and +-180 (flat-folded) only. The rules are
R1 to R8 in `docs/study/01-how-paper-folds.md` section 1.

**Reason.** It is what paper does, it is what the eye reads as a fold (the owner's rounds: the
look arrived when the letters stopped flying and turned in place), and it is what a page can
afford: one transform per face, no mesh, no solver in the common case.

**Rules out.** Scaling, skewing, sliding or fading a face in place of turning it; faces that bend
(Origami Simulator's strained sheet, curved creases); a flap resting on its edge (the seed's
-90 degree lift); the seed's 0.08 pi root tilt; a schedule that moves a crease past 180.

## D2. FOLD is the interchange format, in a fixed subset

**Decision.** Import: `vertices_coords` (2D), `edges_vertices`, `edges_assignment`,
`edges_foldAngle`, `faces_vertices`, `faceOrders`, `frame_classes`, `frame_attributes`,
`frame_unit`, and `file_frames` resolved through `frame_parent` / `frame_inherit` (a
`foldedForm` child frame as the closed state). Unknown keys are kept and round-tripped. Export:
spec 1.2, the same keys with the closed state's angles and orders, one `foldedForm` frame with
the closed pose's 3D coordinates, and orkami's own data under `orkami:`-namespaced keys
(`faces_orkami:parent`, `edges_orkami:start`, `edges_orkami:duration`). The full table is in
doc 01, section 2.

**Reason.** FOLD is the format of both Origami Simulator and Rabbit Ear, so a pattern drawn in
either loads, and an orkami export can be opened in Origami Simulator to check that it folds.
The four keys Origami Simulator requires are the four orkami needs.

**Rules out.** A private pattern format; depending on the FOLD JavaScript library (the subset is
small); importing 3D-only frames as patterns; `C` and `J` edges (cuts and joins; a sheet with a
cut is not one sheet).

## D3. The runtime representation is a hinge tree rooted on the face that stays put

**Decision.** A fold at runtime is a tree of faces: the root face does not move; every other
face has one parent and one hinge (the crease it shares with the parent), and its transform is
the parent's transform composed with the rotation about that crease at the crease's current
angle. The tree is a spanning tree of the face-adjacency graph chosen by the named fold (or, for
an imported pattern, breadth-first from the root). A crease not in the tree is a closing crease:
its angle is not scheduled but solved per frame so the loop of faces around its interior vertex
closes (bisection on one scalar for the symmetric bases). This generalizes the seed's facet tree
(`seed/utils/origami.ts`: polygon, parent, hinge, lit).

**Reason.** One transform per face, computed by one walk of the tree, is what both drivers can
draw cheaply (nested elements in CSS, nested `Group`s in WebGL), and it makes R3 (continuity)
automatic. The named folds a page needs are trees; the two bases with an interior vertex need
exactly one closing crease each.

**Rules out.** A general constraint solver over all crease angles (Tachi's projection) in the
core; a face with two parents; patterns with more than one closing crease per vertex in the
first release (the fish base and the moves are catalogued, not shipped); faces that are not
reachable from the root.

## D4. A schedule is per-crease start, duration and easing over a global t

**Decision.** `angle_c(t) = closed_c * (1 - ease(clamp((t - start_c) / duration_c, 0, 1)))`
with t in [0, 1]. The named folds ship with their unfold order from doc 01 as the sequence
(`start_k = k * step`), `step` small against `duration` by default (the seed's 60 ms against
760 ms); simultaneous is every start 0; a stagger is the same starts on sibling flaps. One easing
for all paper: `cubic-bezier(.22, .75, .25, 1)`, evaluated numerically in WebGL. Duration scales
with the flap's reach: `base * clamp(sqrt(reach / 240 px), 0.6, 1.6)`, base 640 ms, to be tuned
on the playground. A landing is the easing's tail into 0, no bounce; the settle is marked by the
hairline and the contact shadow (D5).

**Reason.** It expresses the three ways a fold moves (a hand's sequence, Origami Simulator's
one slider, the seed's stagger) in one structure the drivers can map to a CSS transition delay
and duration, a `requestAnimationFrame` clock, a scroll position or a slider. The owner's approved
timings fit it.

**Rules out.** Physics in the core (springs, damping, strain); per-crease easings as a public
option in the first release; overshoot; a duration independent of size.

## D5. One Lambert light, shared by the drivers

**Decision.** One directional light, direction `(-0.346, -0.538, 0.769)` in page coordinates
(upper left, in front), fixed. A face's tone is its print color times
`k = 0.35 + 0.85 * max(0, L . N)`, which is 1.0 for a flat face; the back uses `-N`. Shadows come
from the same light: a two-layer stack under each face (contact and ambient) whose offset, blur
and opacity are functions of the face's height above the sheet, the resting values being the
logo's (`docs/study/02-paper-on-a-screen.md`, cue 3; `docs/design/02-look.md`). The WebGL driver
uses `MeshLambertMaterial` and a shadow map from the same light so a fold looks the same in
either driver.

**Reason.** The lit/shaded alternation across creases is the strongest paper cue (02, cue 1), and
it must be the same cue in both drivers or a block and a glyph next to it disagree. Lambert is the
cheapest shading that gives it, and CSS can compute it for a single hinge in `calc()`.

**Rules out.** Specular highlights, multiple lights, a light that follows the pointer or the
scroll; shading as a fixed overlay that does not follow the angle (PFold's overlays, oriDomi's
shading); `MeshStandardMaterial` in the WebGL driver; shadows that do not change with height.

## D6. Content is printed on the faces

**Decision.** A block's content is ink on its root face (and on rectangular flaps when the named
fold has them): it is laid out in the face's box, so it turns, foreshortens and takes tone with
the face, and it is hidden behind the back while the back faces the visitor. Paper is opaque;
a style's `thin: true` may show the content mirrored through the back at low opacity. Content
never fades in or out on its own.

**Reason.** Paper carries its print; the fade the seed used on quad folds (`ori-print`) is the
one thing that reads as an animation rather than a fold.

**Rules out.** Any opacity animation on content; content on a clipped polygon face when it must
stay readable (it is clipped with the face); content in the WebGL driver (a texture is not the
DOM: the WebGL driver is for lit geometry).

## D7. The first named folds and the rectangles each suits

**Decision.** The library ships, in this order of implementation: `book`, `lift`, `cupboard`,
`accordion`, `blintz`, `diagonal`, `waterbomb`, `preliminary`, `kite`; `fish` is catalogued (its
pattern and orders are fixed in doc 01) and ships when the closure solver handles two vertices.
Each has its crease pattern, closed state, fold order and unfold order in doc 01, section 3.
Which rectangles each suits, from the geometry there:

| named fold | suits | does not suit |
|---|---|---|
| `book` | any rectangle: a wide hero on a horizontal crease, a column on a vertical one | |
| `lift` | anything that arrives out of the background: sections, cards, rows | |
| `cupboard` | a wide hero (doors sideways); turned, a tall column (top and bottom flaps) | |
| `accordion` | a list of steps, a tall column, a strip of letters or cards | separate cards (use staggered lifts) |
| `blintz` | a square card, up to about 5:4 | a tall column or a wide block: the corner flaps cross (doc 01, 3.4) |
| `diagonal` | a square card, up to about 5:4 | a wide block: the closed state overhangs the box and the flap reads as a tilting slab (3.5) |
| `waterbomb` | a square that waits as a tab (triangle) at the top of its place | rectangles (the base does not close) |
| `preliminary` | a square that waits as its own top-left quarter | rectangles |
| `kite` | a square block with a pointed top | most page blocks; kept for glyphs and the fish |

The owner's three observations are confirmed with the geometry: the blintz suits squares and not
tall columns; a list of steps wants a pleat; a wide block on a diagonal reads as a slab.

**Reason.** These are the folds a page block can wait in without crossing its own flaps, plus
the two bases whose closed states (a tab, a quarter) make useful thumbnails. Fitting a fold to a
rectangle it does not suit is not forbidden (the geometry stays honest) but the catalogue says
so, and the playground shows why.

**Rules out.** Faking a blintz or a diagonal on a rectangle by moving the landing point to the
center; the seed's `lift` from -90 degrees; shipping the moves (reverse, squash, petal, rabbit
ear, sink) as named folds in the first release.

## D8. No library does this; orkami is built, on FOLD, with Rabbit Ear as a reference only

**Decision.** Build the engine. Take FOLD as the interchange format (D2), Origami Simulator as
the yardstick for a fold in motion and the place to check exports, the seed's CSS layer and
three.js scene as the two drivers' starting points, and oriDomi's API shape (named folds, a
queue, a stagger, a pointer-driven fold) as a model for the public surface. Rabbit Ear is read
for its FOLD graph vocabulary and layer solver and never imported.

**Reason.** `docs/study/03-landscape.md`: the geometry libraries exist (Rabbit Ear, GPLv3; the
FOLD library, MIT and thin), the simulators are apps, oriDomi turns parallel strips of a cloned
element with no crease patterns, no backs and no commits since 2024 beyond its readme, the
Codrops demos are jQuery of 2012, and the one paper-themed site found (lynnandtonic.com) fakes
its folds with skew. Nothing found paints the back of a flap with the page it lies on; that and
the rigid hinge tree are what orkami adds.

**Rules out.** Depending on Rabbit Ear (license and size), the FOLD library (not needed),
oriDomi (mechanism) or Origami Simulator (an app); a runtime dependency of any kind in the core;
skew as a fold.

## D9. The house look is a themable style, with the logo as the reference values

**Decision.** The look is a `Style` (`docs/design/02-look.md`): `tones` per slot (a top-to-bottom
gradient each for two lit and two shade slots), `crease` (hairline width and colors, gradient
depth and strength), `grain` (on, strength), `shadows` (the contact and ambient layers as
functions of height), `edges: 'sharp'`, `light`. The Maslach logo's values, quoted from Figma
with node ids, are the reference; the default style is the logo's "Paper light" variant (one
neutral paper, read through shade and shadow). Nothing in `src/` names the site; the brand
values live in the style a host passes in, and the wordmark glyphs are a demo of letters as
folds.

**Reason.** The engine has to fit the logo (the owner's requirement), the repo is public and
framework-agnostic, and every cue in 02 is either a style value (fixed paint) or a rule over the
pose (computed per frame), so the split is clean.

**Rules out.** Brand values in the core or the drivers; rounded corners, bevels or soft edges
(`edges` has one value); a second light or a per-style light direction in the first release
(the light is a style field so it can be themed later, but the drivers assume the default).

## D10. The coupled bases drive the mountains and solve the valleys

**Decision.** For the waterbomb and preliminary bases the schedule drives the four creases that
close at the vertex on the same side (the corner mountains of the waterbomb, the midline
mountains of the preliminary), all by one progress, and the closure solves the two valleys'
shared magnitude by bisection on the gap at the closing crease, measured along the normal of
the fold's mirror plane (`Closure.across`). The closing crease's angle is then the dihedral the
loop produces (the waterbomb's `OC` equals its mirror `OB`; the preliminary's `OC` stays 0).
A coupled base takes the simultaneous schedule only.

**Reason.** Checked numerically before the code (doc 02): with the mountains driven, the gap
changes sign once on [0, pi] at every progress and the loop closes to machine precision, the
closing crease stays consistent and every face stays rigid. Driving the valleys instead has the
trivial solution (every mountain at 0): that is the book fold through the midline, not the base.
One scalar and one sign is what bisection needs; the symmetric path the study asserted (01,
section 3.7) exists.

**Rules out.** Scheduling the valleys or the closing crease; a sequence or a stagger on a base
(the loop would open); a base on a rectangle (the pattern has no closing angle; the constructor
refuses it rather than tearing the sheet).

## D11. A schedule is built in milliseconds and normalized to t, keeping its length

**Decision.** `together`, `sequence` and `stepwise` compute each crease's duration in
milliseconds from its reach (D4), place the starts in milliseconds (`k * step`, or one after
another plus a gap), then divide by the whole motion's length so every entry is in units of t,
and keep that length as `Schedule.total` (ms). A driver maps t to the clock by `total`, to a
scroll or a slider by ignoring it.

**Reason.** D4's formula is in t, D4's duration rule is in milliseconds; both are needed, and
a fraction alone cannot recover the pace. The seed's step-by-step list ("a list of steps read one
by one", 01 section 4) is a distinct schedule from the overlapping gesture, so it has its own
builder rather than a magic step.

**Rules out.** Per-crease wall-clock values in the schedule; a per-crease easing option
(every entry takes the one `paper` curve unless code sets another).
