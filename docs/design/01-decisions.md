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
(the seed's `origami.ts`: polygon, parent, hinge, lit).

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

**Amended in 0.1.1: a crease may follow another.** `Entry.follow = { crease, ratio }` couples a
crease to one that keeps its own time: its folded fraction (|angle| / closed) is `ratio` times the
leader's, capped at fully folded, and its own start, duration and ease are not read. A chain of
follows is refused. It exists for the pleat (D7): with the first crease at a fraction f and every
inner one at 2f, the panels zigzag with their low creases on the table, which a per-crease clock
cannot express (the ease breaks any fixed ratio between two clocks). A schedule with a follow (or
a custom ease) is not `transitionable`: the CSS driver plays it on the frame clock, not on
per-flap transitions. FOLD carries it as `edges_orkami:follow`.
**Reason.** On a real table a pleat opens all at once and stays on the table; played crease by
crease, each crease swung everything beyond it through the air as one flat board, which the owner
saw on a real GPU (2026-11-02, "accordion close is odd, even open is off").
**Rules out.** Coupling by a shared clock with tuned durations; a solver for the pleat (it has no
interior vertex: the coupling is exact).

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

**Amended in 0.1.1: the default motions.** The owner's look on a real GPU (2026-11-02) found the
blintz "overcomplicated" and the kite in need of work: four (two) corners each starting a beat
after the last read as busy, not as a hand. Their flaps never meet on the way (each turns about
its own side of the diamond, or of the kite, and stays on its side of the mirror between them), so
they now open together; a hand's order stays one `sequence(...)` call away. The accordion opens as
a pleat (D4's follow): the stack stands up on c1, fans out along the table in a zigzag whose low
creases rest on it, and lies flat; folding is the same read back.

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

**Amended 2026-11-03 (0.1.1).** The bases' assignments are now written as the visitor
sees them with the root layer (T1 + T2, T1 + Tl) lying on the page: the textbook bases seen from
their back. Seen from the front and held by their top layer, every other layer turned behind the
root and passed below the page (z < 0 through the whole unfold), which the CSS ground painted
over and WebGL drew as a dish sunk into the sheet. Inverting the assignments is the same paper
viewed from the other side, so nothing above changes but the names: the driven creases (the
waterbomb's corners, the preliminary's midlines) are now valleys and the solved pair mountains,
and every face stays at z >= 0. The closure also takes the folded end of the bisection when both
ends close the loop (at t = 0, where flat and fully folded solved creases both close it), chosen
by how far the driven creases are folded; before, the closed pose took flat and mis-stacked the
base. Tests: no face of any named fold below the page at any sampled t; the closed pose turns
every face the way `stackOrder` says. The CSS driver draws no ground under a face joined to the root by
flat creases only (the waterbomb's T2, the preliminary's Tl): it never leaves the sheet, and a
ground there tied with its flap for depth and drew a hole.

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

## D12. Coplanar faces are separated by their flat-state layer

**Decision.** `stackOrder(fold)` gives every face an integer layer in the closed state: the root
is 0, a child closing at pi lies one layer over its parent for a valley and one under for a
mountain (over meaning the side of the parent's normal, so a pleat's panels come out 0, 1, 2, ...
as they stack), composed down the hinge tree from the same rule `toFOLD` writes as `faceOrders`.
A crease that does not close flat steps 0. Siblings folded onto the same side of their parent
that overlap there stack in the fold's order, a later one past the whole flap of an earlier one
(amended in 0.1.1, for the glyphs folded onto their middle). The CSS driver lifts each flap by its crease's step
times a fixed epsilon (`--ori-layer`, half a pixel) along its parent's normal, before the hinge
rotation, so at t = 0 the stacked faces sit at distinct depths in the order the paper has them,
and at t = 1 the tiling faces are offset by less than a pixel of depth, below what perspective
can show. The back of every face sits a ply (`--ori-ply`, a quarter pixel) behind its front.

**Reason.** Rigid paper has no thickness, so at the two rest states every stacked face is
coplanar with the one it lies on, and a compositor that sorts 3D layers by depth has nothing to
go on: it draws whichever it likes, and the visitor sees the wrong face flicker through. The
epsilon has to come from the stacking, not from the fold: a per-fold tweak would be wrong the
moment a pattern is imported, and the sign matters (a mountain child goes under its parent).

**Rules out.** Per-fold or per-driver z nudges; a thickness in the model (faces stay in the
sheet plane, the epsilon is the driver's); an epsilon large enough to show as a seam at t = 1
(the layer step stays under a pixel, so a six-layer pleat is still within three pixels of depth).

## D13. A word is one fold: its letters hang on the page by their own edges, lifted as a packet

**Decision.** `wordFold(text)` builds a word as one `Fold` whose root is a `page` face (the word's
box) and whose letters each hang on it by their glyph's own hinge (`Glyph.hinge`, the letter's
left or top edge) on a valley that closes at `PACKET` (0.08 pi), the letter's facets being its
glyph's fold below that root. A crease whose parent is a page face need only lie inside or on the
page (`validate`), not on its outline: the page is the ground, and paper can be held to it along
any line. The schedule is built in milliseconds by `timed`: letter i starts at `i * 70` ms, and
its creases open in its glyph's `order`, the top of the folded packet first, each starting 0.8 of
the way into the one before, each running for its reach (D4). Amended in 0.1.1: the seed's step
(the k-th crease `k * 60` ms after, root first, each glyph rooted at its first facet) swung whole
packets that lay outside the letter (the C's arms folded out along its top, the M's legs below the
baseline, the H's bar out to its left) through the air with the flaps still opening on them, and
the owner judged the motion off. Each glyph is now rooted in its middle facet, so the closed packet
lies in the letter's own place and every flap opens off it on its own crease; the overlap keeps
the flaps from passing through each other (a test samples the word for it). This
narrows D1 for this one case: a letter's root does not rest at 0 or 180 degrees in the closed
state but starts lifted by the packet angle on its own edge and settles flat while its facets open
out of it. `packet: 0` is the strict D1 form, the packet lying flat in its place.

**Reason.** The owner's verdict on the seed's WebGL wordmark ("definitely works better") was on
exactly this motion, and the doc that ports it (04) asks for it. The two rejected alternatives
both fly: hinging each letter on a crease in the gap before it (the accordion of letters in
doc 01, 3.6, and K1) swings every later letter with it, and folding each letter 180 degrees over
its own edge throws the S and the C over their top edges, above the word. A small lift on the
letter's own edge is a rotation about a hinge (R1 holds), keeps each letter over its own place,
and gives the packet the height a shadow needs before it lands. Making the word one fold, rather
than a list of glyph folds, lets every driver, schedule and test treat it like any other fold.

**Rules out.** Hinging a letter on its neighbour; a letter's root at any angle but the packet's
and 0; a packet angle on any other named fold (it is the word's, not a general option); a crease
on a page face that leaves the page. `toFOLD` of a word does not round-trip yet: the page face
overlaps the letters, which a FOLD crease pattern cannot hold.

## D14. The WebGL camera: perspective, at the CSS driver's distance, framing the sheet plus a computed bleed

**Decision.** One `PerspectiveCamera` on the sheet's center at 2.2 times the sheet's width and
never under 1000 (the CSS driver's `perspective`, 02 cue 4), its vertical field of view fitted so
the sheet plane fills the canvas exactly, sheet plus bleed. The bleed is computed from the core
(`bleedFor`: the poses through the motion projected from that distance, and their shadows under
the light), not guessed.

**Reason.** A fold must look the same in either driver (D5), and the perspective is the larger part
of how a turning face reads; an orthographic camera turns a lifted flap into a shrinking one. A
fixed bleed (the seed's 20 and 75 percent) clips a tall flap and wastes pixels on a wide word.

**Rules out.** A camera that orbits, follows the pointer or the scroll; an orthographic default; a
vanishing point other than the fold's own center.

## D15. The WebGL light: Lambert in the print's own color space, a contact-hardening shadow from the same light

**Decision.** `MeshLambertMaterial` with flat shading under one `DirectionalLight` from the
style's direction at intensity `kd * pi` and an `AmbientLight` at `ka * pi`, the print carried as
raw sRGB vertex colors and the canvas drawn with no output encoding, so the drawn face is the
core's `tone()` (print times k, per channel, clamped) and matches the CSS driver tone for tone.
The light casts a variance shadow map (VSM) onto a `ShadowMaterial` floor half a unit under the
sheet; only faces lifted off the sheet cast (a face lying in it is part of the page, as in the CSS
driver) and only the root face and the floor receive (a blurred map shades a moving face with its
own neighbours, VSM's light bleeding, which the browser check showed on the waterbomb); the map's blur radius follows the highest face's height from `shadowAt()` (the contact
layer's softness at touchdown, the ambient layer's as it rises); the floor's opacity is the
resting pair's combined opacity over the shadow's intensity (0.5), so a full shadow on the floor
is the logo's resting stack and a shadow on a face darkens it by the same amount. PCF stays
available (`shadowFilter: 'pcf'`).

**Reason.** three's color management would light the print in linear space and encode it back, so
a turned face would darken differently from the CSS overlay and from `tone()`. The study named
`PCFShadowMap`, but three's PCF filter is a five-tap Vogel disk: at the radii the ambient layer
needs (16 px and more) it dithers into visible noise, which the browser check showed; VSM blurs
the map instead and reads as paper's soft shadow. One radius per frame from the highest face is
the cheapest way to make shadows long and soft in the air and tight on landing without a
per-face shadow pass (PCSS).

**Rules out.** `MeshStandardMaterial`, specular, tone mapping, environment light; a resting shadow
under a fold lying in the page; per-face shadow softness in the first release.

**Amended in 0.1.1: contact hardening, in both drivers.** One radius per frame from the highest
face made a lifted flap's shadow as soft and faint at its crease as at its tip, and the CSS
driver's stack, offset and blurred by the face's highest point, did the same and drifted off the
crease: the owner saw it on a real GPU as shadows that "fade the wrong way" (2026-11-02). Paper's
shadow is sharp and dark where the flap meets the sheet and softens and pales with the gap. Now
both follow one law, `penumbra(gap)`: a standard deviation of `contact.blur / 2` at contact
growing by `ambient.lift.blur / 4` per px of gap, the strength losing `ambient.lift.opacity` over
300 px. WebGL: percentage-closer soft shadows (Fernando 2005, as three's `webgl_shadowmap_pcss`
example) in the receivers' shader (the floor and the root), on a plain depth map
(`BasicShadowMap`): a blocker search finds the gap per fragment and the filter radius follows it;
VSM is gone (it has one radius for the whole map). CSS: each flap's outline cast along the light
onto its parent's plane (so it meets the crease), in its own box, a contact layer at the resting
blur masked out over the first `2 * contact.fade` px of gap and an ambient layer at the penumbra of
the flap's middle, masked paler toward the far edge. `shadowFilter: 'pcf'` keeps the one-radius
filter.
**Reason.** It is what makes a hinged flap read as attached to the sheet. Per-fragment softness is
the only way the WebGL map can be sharp and soft at once; PCSS's cost (48 depth taps per receiving
fragment) is on the floor and the root only.
**Rules out.** A per-face shadow pass; a shadow that does not meet its crease; the CSS stack's
fixed 16 px drop under a hinged flap (it stays for a resting glyph, `shadowAt(0)`).

## D16. The WebGL canvas exists only while the unfold plays

**Decision.** `<Unfold3D>` renders its flat fallback (the `Word` SVG for a word, the `flat` slot
otherwise) on the server and at rest; on play it imports three.js, lays a canvas over the
fallback with the bleed, hides the fallback under it, plays, and at the landing fades the canvas
out over the fallback in 300 ms and frees the WebGL context. Reduced motion, a renderer that
cannot be created and no JavaScript show the fallback.

**Reason.** The landed paper is flat, and the flat SVG draws the resting lockup better than a
canvas (crisp at every size, selectable, server rendered, no context held), so the canvas is only
worth its cost while something moves. A page has a small budget of WebGL contexts; holding one
per resting logo exhausts it. The seed did the same and the owner approved the result.

**Rules out.** A canvas left mounted at rest; three.js in the server bundle or loaded before the
first play; a fallback that differs from the landed pose (the fallback is what the paper lands on).

## D17. A picture is printed on the faces in sheet coordinates; text stays 'landed' by default

**Decision.** A fold carries a print mode. `'landed'`, the default, is D6's text block: the fronts
show the host's background and the content shows once the paper lies flat. An image prints on
every front in sheet coordinates: each face carries exactly the part of the picture lying under it
when flat (the core's `facePrint` for the CSS driver's backgrounds, `printUv` for the WebGL
driver's UVs), so the faces join into the whole picture at t = 1 with no seam, and at t = 0 the
picture is folded inside the paper; the backs stay the sheet paint (the picture is on one side),
and the tone, the grain and the crease darkening lie over the print as over plain paper. The
CSS driver also prints `'content'`: an `aria-hidden` clone of the element on every front, at most
12 faces (`CONTENT_FACES`), never on a lift; past that it prints `'landed'`. A picture is decoded
before the paper moves (`ready`), and a still mount (`still: true`) lands at once with no
transition and builds no flap until it is asked to fold.

**Reason.** An illustration has to look drawn on the paper, so it must be on the faces the whole
way; a picture faded in at the landing breaks the paper rule. Text is different: printed on a
folded block, it shows half-read, mirrored by the folds and clipped at the creases, and a folded
text block reads best as the page's own background that opens into a card, so `'landed'` stays
the default. Clones of the content cost one copy of the element's DOM per face and are a snapshot
(nothing reactive in them), so they are opt-in and capped where the copies would cost more than
they show. A returning visitor should get the page flat, and a directive that can say `still`
lets a site keep one template for both visits. This amends D6's "no content in the WebGL driver":
a picture is a texture, not the DOM, so both drivers print it; DOM content stays the CSS
driver's.

**Rules out.** A picture that fades in or appears at the landing; a picture on the backs; a
print placed by a driver's own arithmetic (it is the core's); a fold that starts before its
picture is decoded; content cloned onto an unbounded number of faces.

## D18. A loop is a sequence of real folds that meet at flat; stop lands flat

**Decision.** A loop (`loop()` in `src/core/loop.ts`) is a list of steps, each a valid fold on
one sheet (the same width and height, checked), each played whole: fold-in (its unfold schedule
from t = 1 to t = 0, so the first crease undone is the last one made), `hold` at closed (240 ms),
unfold (t = 0 to 1), `gap` at flat (160 ms), then the next step. The core is pure: `at(ms)` gives
the step, its t and its phase, `nextFlat(ms)` the first flat moment at or after `ms`, never more
than one step away. The default steps are the square bases, waterbomb, preliminary and blintz
(`LOOP_BASES`). Drivers run a loop on `requestAnimationFrame` with `set(t)` from their own clock:
the CSS driver's `mountLoop` mounts one step at a time (`mount` at flat, `drive: 'frame'`) and
swaps the mounted step's flaps for the next step's when the clock crosses into it, which happens
only after the gap's flat frames; the WebGL stage's `loop()` removes and disposes the old step's
handle and builds the next step's groups at the same flat swap. `stop()` lets the playing step run
to `nextFlat`, lands it flat and resolves there. Under reduced motion the loader shows the flat
square, still, and reports done as soon as it is ready.

**Reason.** Real paper cannot morph from one base into another (study section 5): going from the
waterbomb to the preliminary base is an unfold to flat and a fold on the other assignment, so every
frame between two steps that is not flat would be a sheet that stretches or tears. Every step's
flat state is the same sheet, so swapping its crease pattern there is invisible, and every step
passes through it, so a stop always has a flat moment within one step to land on and never needs
to fade or cut mid-fold. A loop has no end state for a CSS transition to aim at, and a transition
retargeted at each phase would restart its easing at every turn; one clock driving `set(t)` keeps
every frame on the schedule and paints the shadow from the pose each frame, so it breathes as the
paper rises and lands. Under reduced motion the flat square, not nothing: the status stays visible
(the element keeps its `role="status"` and label, and a sighted visitor still sees that something
is loading), nothing moves, and the flat square is what the loader would have landed on anyway.

**Rules out.** A morph or crossfade between two bases; a step that starts from anything but flat;
a stop that fades the paper out, cuts it away or freezes it mid-fold; CSS transitions or keyframes
for a loop; a loop over sheets of different sizes; under reduced motion, a loader that moves or
one that renders nothing while the page is not ready.

## Drafts for models in steps (D19 to D23)

Drafted 2026-11-08 from `docs/study/04-models-in-steps.md` (doc 08), each to be confirmed or
replaced by the doc named in it. Doc 08's plan called them D17 to D21; those numbers were taken by
then (D17 printed faces, D18 loops), and this record is never renumbered, so they are D19 to D23.

## D19 (draft, doc 09 confirms). A model is one crease pattern; a step names the creases it moves

**Decision.** A model is one sheet with one crease pattern holding every crease the model ever
makes (the union over its steps, pre-creases included), and an ordered list of steps. A step names
the creases it moves and each one's target angle; every crease it does not name holds the angle
the previous step left; its start is the previous step's end, so unfolding a model is its steps
played backwards. A step's end is a keyframe: a flat-folded state, or, for a finishing step (the
crane's wings), creases held at a stated angle. View steps (turn over, rotate) move no crease. The
FOLD export is one `creasePattern` key frame and one `foldedForm` child frame per step
(`frame_parent` the previous step, `frame_inherit: true`, `file_classes: ["diagrams"]`), the
step's move and script under `frame_orkami:` keys.

**Reason.** The faces never change identity, so a driver builds its elements or groups once and a
step only changes angles (study 04, section 3); a chain of re-cut patterns would rebuild at every
step boundary, and a model's boundaries are folded, not flat, so the swap would show. FOLD's
`frame_inherit` is made for exactly this, and `fold-format.ts` already resolves it. The crane
compiles to it (`docs/study/scripts/crane.ts`: every step's creases are segments of one sheet).

**Rules out.** A chain of crease patterns cut per step; faces split or merged at runtime as a
different model (a driver may merge faces joined at 0 as an optimization only); a step whose start
is not the previous step's end; a finishing angle on a page block's named fold (D1's rest states
stay for those; the held angle is a model's, and D1's owner confirms it in doc 09).

## D20 (draft, doc 10 confirms). The general closure: Tachi's loop constraint, followed along its null space

**Decision.** A step's pose is solved over the step's moving creases only, every other crease held.
Each interior vertex the step touches contributes the loop constraint (the product of the rotations
about its creases, axes in the flat sheet's frame, in counterclockwise order, is the identity; the
residual is all nine entries of the product minus the identity, since a rotation by 180 has no skew
part). The solver is Newton on the Jacobian (small dense linear algebra written in the core, no
dependency) and the path is followed by pseudo-arclength continuation along the Jacobian's null
space, starting each step on the null direction that points toward the step's targets and never
crossing +-180. A step with one degree of freedom (N moving creases - 3 per touched vertex) is
driven by the schedule's progress; one with more walks toward its targets. D10's bases keep their
exact bisection, and a test checks that the general solver agrees with it.

**Reason.** The study's scripts do exactly this and close to 7.1e-15 or better on every branch
traced (degree-4 vertices, the petal fold), with steps of a quarter to half a degree; starting
from the last frame's angles a few Newton iterations per frame suffice. The flat and flat-folded
states are singular (two null directions at the petal's start, one per branch), so the start needs
a rule, and the targets give one. Bisection is exact for the symmetric bases; keeping it means the
general solver cannot regress them.

**Rules out.** A strain or spring model; random restarts per frame; a solver that crosses +-180
(the mirror petal branch runs a crease to 360); the skew part alone as the residual; a dependency
for linear algebra.

## D21 (draft, docs 10 and 11 confirm). A step that is not rigid plays a rigid path through a relaxed crease set

**Decision.** When the closure has no rigid path from a step's start to its end with only the
step's creases free, the step is played over a relaxed set: the step's creases plus the creases of
the flap the move acts on (its spine and the creases where it joins the model), which may open
during the step and must return to their angles by its end. The solver widens the relaxed set one
flap at a time toward the root and takes the smallest that has a rigid path; a step that would
have to open the whole model fails loudly. For an inside or outside reverse fold the path opens
the flap's spine through the move's flat vertex and folds the reverse branch (the two branches of a
degree-4 vertex meet only there). Every frame is a rigid state of the sheet.

**Reason.** A reverse fold on a flap held by the model is locked (`reverse.ts`: the spine-in held,
the walk cannot start); real paper does it by bending, which D1 rules out. Auxiliary creases were
measured and fail: one per layer adds no freedom (a degree-4 vertex adds 3 creases and 3
equations); fans of two to four per layer lock with the spine still 57 to 116 degrees from flat and
the hidden hinges already at 90; the one fan that reached flat folded a hinge to 179, a crease the
paper would keep. A strain solver is D1's and D8's rejection again. The relaxed path keeps D1
whole, and the flap opening and closing is a motion paper really makes.

**Rules out.** Bending a face; strain; auxiliary hinges hidden in a face (unless D1 is amended,
with a budget, should doc 10 find the relaxed path reads badly on the crane's neck); a morph or a
crossfade between two keyframes; tearing the sheet when no path exists.

## D22 (draft, doc 11 confirms). A crease made through layers is the fold line mapped back through each layer

**Decision.** `throughFold` takes a step's fold line in the folded image (the flat-folded state the
step starts from), the layers it acts on and the side that moves. For each selected face whose image
the line crosses, the face splits; the crease segment is the chord mapped back to the sheet through
that face's own isometry; its assignment is V where the face shows its front and its part turns
toward the viewer (or shows its back and turns away), M otherwise; the moving part's isometry is
composed with the reflection in the line. The selection must contain every face joined beyond the
line to a moving face (checked: a fold that would tear refuses). After the step the moving faces
are restacked (on top for a fold toward the viewer, under for away, between the flap's layers for
an inside reverse) and `stackOrder` (D12) is recomputed from the step's flat-folded state, not from
the hinge tree.

**Reason.** One line in the image is a different segment on every layer of the sheet (the crane's
narrowing is one line and four segments in four directions in the front stack, `crane.ts`), so the
segments cannot be typed by hand. Rabbit Ear's `flatFold` folds through all layers this way (read,
not copied, D8); a model needs it restricted to named layers. The tear check is what makes "the
front layer" honest: the crane's leg front is one face with the paper under the petal, so its
narrowing crease must run on under the petal. In a model a face has layers above and below it that
are not its tree neighbours, so the tree's stacking rule (D12) does not hold there.

**Rules out.** Hand-typed sheet segments for a fold made through layers; an implicit "every layer"
when the step names a flap; a selection that tears the sheet; the hinge tree's stacking for a
model.

## D23 (draft, doc 12 confirms). A model is written as a script of moves on landmarks

**Decision.** A model's source is a JSON script: the sheet; named landmarks (corners, edge
midpoints, the centre, intersections of creases, points where a crease meets an edge, flaps named by
the corner at their tip, layers named as the front n or a flap's own); and steps, each a move from
the Yoshizawa-Randlett vocabulary (valley, mountain, fold-and-unfold, turn over, rotate, inside and
outside reverse, squash, petal, rabbit ear, pleat, crimp), its fold line defined by a Huzita-Hatori
axiom over landmarks (or, for a step of taste, a line through a landmark at a stated angle to
another line), the layers it acts on, and an optional caption in our own words. Landmarks resolve in
the folded image of the step that uses them. The script compiles to D19's model through D22, every
step is reversible (the unfold is the script played back), and the FOLD export is D19's.

**Reason.** No existing format encodes moves through layers on named landmarks (study 04, section
8: FOLD has frames and no moves; Rabbit Ear's diagrams keys describe pictures; the one landmark
language found has single folds on a square only). Diagrams speak in moves on landmarks and axioms,
so a script in those terms reads like one and survives a change of proportions; raw coordinates
would freeze one drawing and are what a copied crease pattern would look like.

**Rules out.** Raw coordinates as the encoding of a traditional model (an escape hatch, flagged, for
imported patterns only); a sink (refused by name); copied diagram text as captions; Rabbit Ear's
`re:` keys as orkami's schema.
