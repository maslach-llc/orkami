# Paper on a screen

What the eye uses to read a moving face as paper, ranked by how much each cue contributes, with
the exact rendering rule for each and its cost in the CSS driver and in the WebGL driver. Written
2026-11-02 from the seed (`seed/`), the Maslach logo in Figma (`docs/design/02-look.md` quotes the
values with node ids) and the sources at the end. The drivers (docs 03 and 04) render these cues
and nothing else; a cue not listed here is not paper.

## The light

One directional light, the same in both drivers. Direction toward the light, in page coordinates
(x right, y down, z toward the visitor), unit length:

    L = (-0.346, -0.538, 0.769)

the seed's `(-0.45, 0.7, 1)` normalized (`seed/components/OrigamiUnfold3D.vue`, y flipped to page
coordinates): from the upper left, in front of the page, 40 degrees off the normal. The Figma
component's description says the same: "lit from the upper left" (node 11:60, read 2026-11-02).
The light does not move, scroll or follow the pointer: a page is a sheet on a desk under one lamp.

Lambert: the diffuse brightness of a face is `B = (L . N) * C * I` (Wikipedia, Lambertian
reflectance, read 2026-11-02), the cosine of the angle between the light and the face normal N,
times the face's color. A flat face has `L . N = 0.769`.

## The cues, ranked

Rank is the share of "this is paper" each cue carries, judged from the seed's rounds (the owner's
verdicts in the plan doc) and from what the sources render. The first three are the fold; the
rest are the material.

### 1. Lit and shaded faces across every crease (Lambert)

The alternation of a lit face and a shaded face across a crease is what reads as folded paper
whatever the colors are (the wordmark's facets alternate for that reason, `seed/utils/origami.ts`).
It is the one cue that works at any size, in a thumbnail, in monochrome.

Rule. Every face has a print color P (its own, section 5) and a dynamic brightness factor:

    k(N) = ka + kd * max(0, L . N)          ka = 0.35, kd = 0.85
    tone  = P * k(N)                        (k = 1.004 for a flat face: the print shows as printed)

So at rest the face shows exactly its print; edge-on to the light it drops to 0.35 of it; facing
the light head-on it rises to 1.2. A face's back uses `-N` and the back color (cue 2). `ka` and
`kd` are the seed's three.js ambient 0.3 and directional 1.0 rebalanced so that rest is 1.0
without a normalization step; both drivers use these two numbers and nothing else for tone.

Where the two-tone look comes from. Lambert gives the same tone to two coplanar faces, so the
logo's lit/shaded pairs at rest cannot be Lambert: they are the print. Each face carries a slot
(`lit` or `shade`) and the print is the slot's gradient (`docs/design/02-look.md`); Lambert
multiplies the print by `k(N)` as the face turns. The resting pose reproduces the four tones
exactly because `k = 1` there, and a turning face darkens and brightens the way paper does.

Cost. CSS: the normal of a face hinged once on an axis `u = (ux, uy, 0)` at angle a is
`N = (uy sin a, -ux sin a, cos a)`, so `L . N` is a `calc()` of `sin(var(--angle))` and
`cos(var(--angle))` on the registered `<angle>` property, as the seed already does for its
`sin()` shade; the tone is a `color-mix()` or an overlay's opacity driven by it. Exact for a face
hinged on the root (every page fold in doc 01, section 3); first-order for a face hinged on a
moving parent (the glyph chains), where CSS cannot compose the parent's rotation: the CSS
driver ignores the parent's tilt for tone, and nested chains are the WebGL driver's job. WebGL:
free, it is what a `MeshLambertMaterial` under one `DirectionalLight` plus an `AmbientLight`
computes per fragment.

### 2. The back of the paper

A face has two sides. The back is the other side of the sheet: unprinted (or the page's own
paper), and what the visitor sees for the first half of every 180 degree turn. Without a back, a
turning face is a card trick; with the wrong back (the content mirrored), it is a mirror.

Rule. The back of face F is painted with the sheet under F reflected across F's crease: a block
lying folded shows, on its back, the page where it lies, so it is invisible until it moves (the
seed's sheet paint, `seed/utils/sheetPaint.ts`: `--ori-sheet` placed by `--ori-sx/--ori-sy`,
mirrored for a horizontal hinge). The engine generalizes it: `back(x) = sheet(reflect_c(x))`, the
reflection across the crease line c (`src/core/affine.ts` `reflect`), composed down the hinge
tree for nested faces. The sheet is whatever the host registers as the page's paper: a solid
color by default, an image or the seed's seven-facet sheet when the host provides one. The back
takes Lambert with `-N` (cue 1) and no print. Paper is opaque: the front's content never shows
through. A style may set `thin: true` to show the content mirrored through the back at low
opacity; the default is opaque.

Cost. CSS: a second element per face (`.back`), `backface-visibility: hidden` on both, the back
rotated `rotateY(180deg) translateZ(1px)`, its clip the mirror image of the front's, its
background the sheet placed by a matrix (the seed's `paper()` in `seed/unfold.ts` builds exactly
this). One extra layer per face, repositioned on scroll (a `requestAnimationFrame` per scroll
event, as the seed does). WebGL: a second mesh with `side: BackSide` and the back material, or
one mesh with `DoubleSide` and a per-side material; the sheet as a texture with a reflected UV.

### 3. The shadow a lifted flap casts

A flap in motion is above the sheet, and a thing above a lit sheet casts a shadow that
lengthens as it lifts and shortens as it lands. The shadow is what gives the motion a height;
without it the flap turns in a vacuum.

Rule. Two shadow layers under every face, both functions of the face's height h above the sheet
(the height of its farthest point: `h = reach * sin(angle)` for a face hinged on the root; the
composed transform's z for a nested face):

    contact: offset (0, 2) px, blur 4 px, opacity 0.14 * max(0, 1 - h / 24)
    ambient: offset (0, 16) + 0.5 * h * (0.45, 0.70) px, blur 32 + 0.8 * h px, spread -6 px,
             opacity 0.22 * (1 - 0.5 * min(1, h / 300))

At h = 0 this is the logo's resting stack (Figma 18:319 and 11:63: `dy 16 blur 32 spread -6
at .22` over `dy 2 blur 4 at .14`, in Figma blur units, which export as half that in SVG
`stdDeviation`). The ambient layer drifts in the direction a point at height h projects to under
L, `(-Lx, -Ly) / Lz = (0.45, 0.70)`, halved so a hero flap at 400 px does not throw its shadow
off the page; it grows and fades as the flap rises and tightens back as it lands. The contact
layer is gone by a 24 px lift and returns at touchdown: that return is the landing the eye
registers. The Figma keyframes draw the same resting stack on every piece, lifted or not (K1 and
K2's letters carry the identical filter as the resting M, checked in the SVG exports), so the
height dependence is this document's rule, not the file's; the numbers are to be tuned on the
playground.

Cost. CSS: `filter: drop-shadow()` on the face (it follows the clip-path silhouette, which
`box-shadow` does not), two layers, driven per frame; a filter on a 3D-transformed element costs
a repaint of that layer every frame, the single most expensive cue in CSS. The driver restricts it
to faces that are moving (a resting face keeps a static shadow) and drops the ambient layer on
faces under 40 px of reach. WebGL: a shadow map from the one light onto a `ShadowMaterial` floor
at opacity 0.22 (the seed's values: 2048 map, `PCFShadowMap`, radius 4): one extra render pass,
and the shadow's size and offset follow the geometry for free; its softness is constant (the
height-dependent blur needs `PCFSoftShadowMap` or VSM; not in the first release).

### 4. Slight perspective

A sheet is looked at from arm's length. Too little perspective and a turning face just shrinks;
too much and the page becomes a room.

Rule. The perspective distance is 2.2 times the fold's width, never under 1000 px, with the
vanishing point at the fold's own center (not the viewport's, so a flap far down the page is not
skewed). The seed's values agree: `perspective(1200px)` for a lifting block, `1400px` for the
quad folds and the wordmark, and the three.js camera at `W * 2.2` with a field of view fitted to
the bled canvas.

Cost. CSS: `perspective` on the fold's container and `transform-style: preserve-3d` down to the
faces; free, but the container must not clip (`overflow` other than `visible` flattens the
context, the seed's rule in `seed/origami.css`). WebGL: the camera; free.

### 5. Content is printed on the paper

Text and images are ink on the face. They move with the face, foreshorten with it, take its
tone, and are hidden while the back faces the visitor. They do not fade in on their own; a fade
is the one thing a reader notices as not-paper.

Rule. The face's own box is the face: content is laid out in it and the transform applies to the
box, so content follows for free. The content's tone follows cue 1 through an overlay on the face
(a shade layer above the content, the seed's `::after`), not a filter on the content. The seed's
`ori-print` fade-in of a quad fold's content at landing is ruled out: the content is visible on
the front from the first frame, and is simply hidden behind the back while the back is toward
the visitor.

Cost. CSS: none beyond the face; the content is the DOM. The one constraint is that a face that
is a clipped polygon (blintz, diagonal, glyphs) clips its content with it, so content that must
stay readable belongs on the root face or on a rectangular flap. WebGL: content on a face is a
texture (`html2canvas` or a prerendered image) and loses its DOM: the WebGL driver is for lit
geometry (glyphs, decoration), not for text; a block with content uses the CSS driver.

### 6. Creases persist as hairlines

Once the paper is flat the creases stay: a faint line where each fold was. It is what tells the
visitor the block was folded rather than animated, after the motion is over.

Rule. A 1 px line along every crease, drawn on both faces: black at 0.3 opacity on a lit face,
white at 0.4 on a shaded face (the seed's `OrigamiWord.vue`; the Figma keyframes use a 1 unit
black stroke on every face edge instead, which is the Figma drawing convention, not the look).
The hairline appears over the last third of the landing (the settle) and stays. On the resting
page sheet, creases are the sheet's own lines (`seed/utils/sheet.ts`, ink at 0.06).

Cost. CSS: an SVG `<line>` per crease in a `.creases` overlay sized to the fold (the seed's
`paper()`), `vector-effect: non-scaling-stroke`; negligible. WebGL: a `LineSegments` per crease
or a 1 px band in the face texture; negligible.

### 7. Paper grain

A fine noise over every face, multiplied. It is the material: the same faces without it are
plastic.

Rule. Fractal noise, `baseFrequency 0.85, numOctaves 2`, alpha 0 to 0.16, multiplied (the seed's
`--ori-grain`; Figma: `baseFrequency 1.0, numOctaves 3`, black at 0.14 through a discrete alpha
mask, node 11:63's export). One tile, fixed to the face so it moves with it.

Cost. CSS: a tiled `background-image` layer with `background-blend-mode: multiply`; free. WebGL:
a noise texture multiplied into the material's map; free.

### 8. The crease gradient

A shaded face darkens from its crease inward: the fold's ambient occlusion. On the logo it is
the second-strongest tonal mark after the lit/shade pair, but it is a print (fixed) with a small
dynamic part.

Rule. Fixed part: on a `shade` slot face, a gradient from the hinge midpoint toward the face's
centroid, black 0.46 at the hinge to 0.1 at 60 percent to 0.18 at the far end (the seed's
`creaseGradient`, 2.2 times the hinge-to-centroid distance); Figma draws it as an inner shadow
offset away from the hinge, `dx 12 dy 4 blur 22 at .38` on the fold faces (node 11:63's export).
Dynamic part: both faces at a crease gain an extra darkening of up to 0.12 at the crease as the
fold angle approaches 180 (the faces close on each other and the crease goes into shadow), zero
at 0.

Cost. CSS: a gradient layer on the face whose angle is computed once from the hinge (the seed's
`--crease` angle), plus an opacity on it driven by the fold angle; cheap. WebGL: baked into the
face texture (fixed) plus a per-face uniform (dynamic); cheap.

## Fixed paint versus computed per frame

| cue | fixed (painted once per face) | per frame |
|---|---|---|
| 1 tone | the print: slot gradient | `k(N)` from the fold angle |
| 2 back | the sheet reflected across the crease | visibility (which side faces the visitor), `k(-N)` |
| 3 shadow | the resting stack | offset, blur, opacity from height |
| 4 perspective | distance and origin | nothing |
| 5 print | the content | nothing (it rides the face) |
| 6 hairline | the line | its fade-in over the settle |
| 7 grain | the tile | nothing |
| 8 crease gradient | the gradient | the small occlusion term |

Sharp edges (every face a hard polygon, no rounding, no bevel) are not a cue in this list because
they are a property of the faces, not of the rendering: `clip-path: polygon()` in CSS and
`ShapeGeometry` in WebGL both produce them, and a style's `edges: 'sharp'` is the only value the
first release supports (`docs/design/02-look.md`).

## Sources

Read 2026-11-02: `seed/origami.css`, `seed/unfold.ts`, `seed/utils/sheet.ts`,
`seed/utils/sheetPaint.ts`, `seed/components/OrigamiWord.vue`,
`seed/components/OrigamiUnfold.vue`, `seed/components/OrigamiUnfold3D.vue`; the Figma file
`4dCOuFddrSlSROuULc5Rl1`, page "new logo" (nodes 11:60, 11:62, 11:63, 11:95, 18:319 to 18:455,
24:293, 24:298) through the Figma MCP server, with the SVG exports of 11:63, 11:95, 24:293 and
24:298 read as text; https://en.wikipedia.org/wiki/Lambertian_reflectance;
https://lynnandtonic.com/thoughts/entries/case-study-2020-refresh/ (a paper-themed site whose
panels use skew and stepped gradient highlights, cited in `03-landscape.md`).
