# API: the core

`import { ... } from 'orkami'`: everything under `src/core/` and the glyphs under `src/glyphs/`.
Pure TypeScript, no DOM, no dependency. Coordinates are page coordinates: x right, y down, origin
at the sheet's top left, z toward the visitor; angles in radians, valley positive (FOLD's sign).
The model is fixed by `docs/design/01-decisions.md` (D1 to D11) and the study in `docs/study/`.
One line per export; the file each lives in is the heading.

## affine.ts: plane maps

- `Pt`: `[x, y]`.
- `Affine`: `[a, b, c, d, e, f]` in CSS `matrix()` order; `IDENTITY`.
- `compose(p, q)`: p after q. `apply(m, pt)`. `toCss(m)`: the `matrix()` string.
- `reflect(h, u)`: reflection across the line through `h` along unit `u`: where a flap's content lands folded flat over that crease.
- `direction(a, b)`: unit direction from a to b.

## space.ts: space geometry

- `Vec3`, `Mat4` (16 numbers, column major: `matrix3d()` and `Matrix4.fromArray()` take it as is); `IDENTITY4`.
- `vec`, `add`, `sub`, `scale`, `dot`, `cross3`, `length`, `normalize`.
- `multiply(a, b)`: a after b. `transform(m, v)` a point; `transformDir(m, v)` a direction.
- `rotation(point, axis, angle)`: the rotation about the line through `point` along `axis`.
- `isIdentity(m, eps)`.

## fold.ts: the model

- `Sheet`: `{ width, height, cut? }`; `cut` says the faces need not tile the box (a glyph's strip).
- `Face`: `{ id, pts, slot?, page? }`; `slot` is the print tone class (`'lit' | 'lit2' | 'shade' | 'shade2'`); `page` marks a lift's root, the host's page outside the box.
- `Crease`: `{ id, a, b, assignment: 'M' | 'V' | 'F', parent, child, closed, closing? }`; `closed` is the angle magnitude the child sits at when fully folded (`Math.PI` for a flap lying flat over, `0` for F); the assignment gives the sign; `closing` marks a crease left out of the hinge tree (D3).
- `Closure`: `{ vertex, closing, solved, across }`: an interior vertex's loop: the closing crease, the creases whose shared magnitude is solved so it closes, and the unit direction in the sheet the gap is measured along (the mirror plane's normal) (D10).
- `Fold`: `{ name?, sheet, faces, creases, root, schedule?, closures?, suits?, extra? }`; `suits` from D7's table; `extra` holds FOLD keys the engine does not read.
- `validate(fold)`: the problems, as strings; empty when sound: unique ids, the non-closing creases a tree rooted at `root` reaching every face, every crease on an edge both its faces share, faces inside the sheet, never overlapping, tiling it unless `cut`, F creases closing at 0, closing creases backed by a closure.
- `assertValid(fold)`: `validate`, throwing on the first problem; returns the fold.
- `sign(assignment)`: +1 valley, -1 mountain, 0 flat. `face(fold, id)`, `crease(fold, id)`, `treeCreases(fold)`, `tolerance(fold)`.
- Polygon helpers: `area` (signed), `centroid`, `cross` (2D), `onSegment`, `onEdge`, `convex`, `inside`, `overlaps`.

## tree.ts: the hinge tree

- `hingeTree(fold)`: `{ order, parent, hinge, children, chain }`: faces parent first from the root, each face's parent and hinge crease, the creases hinged on each face, and the root-first chain of creases to each face. A driver nests transforms down `order` or composes `chain`.
- `flap(fold, creaseId)`: the child face and everything hinged beyond it.
- `reach(fold, creaseId)`: the flap's farthest point from the crease line, in sheet units. Sets the duration (D4) and the shadow's height (D5).

## schedule.ts: time

- `Ease`: `(x) => y` on [0, 1]. `cubicBezier(x1, y1, x2, y2)`: a CSS timing function solved numerically. `paper`: `cubic-bezier(.22, .75, .25, 1)`, the one easing for all paper (D4).
- `Entry`: `{ start, duration, ease? }` in units of t. `Schedule`: `{ creases: Record<CreaseId, Entry>, total }` with `total` the whole motion's length in milliseconds at the default pace (D11).
- `BASE` 640 ms, `REACH` 240 px, `STEP` 60 ms. `creaseDuration(reach, base)`: `base * clamp(sqrt(reach / 240), .6, 1.6)` ms.
- `together(fold)`: every crease from 0, Origami Simulator's slider; the only schedule a coupled base takes.
- `sequence(fold, order, { step, base })`: the creases in `order` (the unfold order: outermost flap first) start `step` ms apart and overlap: a hand's gesture; over sibling flaps, the seed's stagger.
- `stepwise(fold, order, { gap, base })`: each crease starts when the one before has finished plus `gap` ms: a list read one step at a time.
- `progress(entry, t)`: the eased progress. `angleAt(fold, creaseId, schedule, t)`: `sign * closed * (1 - ease(progress))`.

## pose.ts: the pose at t

- `pose(fold, t, schedule?)`: `{ t, faces, angles }`; per face a `FacePose` `{ id, matrix, chain, pts, normal }`: the rigid transform (`Mat4`), the hinges from the root down as `Hinge3` `{ axisPoint, axisDir, angle }` in the parent's flat frame, the posed vertices and the unit normal (`(0, 0, 1)` flat). Closures are solved first (D10). `t = 1` is the identity for every face; `t = 0` the closed state.
- `closedPose(fold)`: `pose(fold, 0)`.
- `poseAngles(fold, angles)`: the pose for explicit signed angles by crease id (closing creases' angles are measured, not taken).
- `hingeAxis(fold, crease)`: the crease's axis through `a`, oriented so a positive angle lifts the child toward the visitor.
- `dihedral(fold, crease, faces)`: the signed angle between a crease's two faces in a pose.
- `flatBack(fold, creaseId)`: the `Affine` that says where the child's content lands folded flat over that crease, composed down the tree: the CSS driver paints the back with the sheet under this map (02, cue 2).

## light.ts: the one light

- `LIGHT`: `[-0.346, -0.538, 0.769]`, toward the light, page coordinates (D5). `AMBIENT` .35, `DIFFUSE` .85.
- `lambert(normal, light?)`: `max(0, L . N)`. `shade(normal, light?, ambient?, diffuse?)`: `k = ambient + diffuse * lambert`: 1.0035 for a flat face (the print within one 8-bit step), .35 edge-on, 1.2 facing the light; the back of a face uses `-N`.
- `faceNormal(pts, matrix?)`: the unit normal after a transform, `(0, 0, 1)` when flat whatever the winding.

## vertex.ts: flat-foldability

- `interiorVertices(fold)`: crease endpoints not on the sheet's outline (works on cut sheets).
- `maekawa(fold, v)`: `{ mountains, valleys, ok }`, ok iff `|M - V| = 2` over the non-flat creases at v.
- `kawasaki(fold, v)`: `{ sectors, odd, even, ok }`, ok iff the degree is even and the alternating sector sums are 180.
- `flatFoldable(fold)`: the problems at every interior vertex; empty for every named fold.

## style.ts: the look (D9, `docs/design/02-look.md`)

- `Tone`: `{ top, bottom }` colors; `flat(c)` the same color twice.
- `Style`: `tones`, `crease`, `grain`, `shadows`, `edges: 'sharp'`, `light`, `thin`, field for field as 02-look.md. `DEFAULT_STYLE`: the "Paper light" neutral paper with the logo's effects. `style(overrides)`: a deep merge over the default (a host passes its four slot tones).
- `StyleOverrides`: a deep partial of `Style`, what `style()` takes.
- `slotTone(style, slot?)`: the slot's Tone (`lit` for a face without one).
- `brightness(face, pose, style?)`: the Lambert factor k of the face in the pose.
- `tone(face, pose, style?)`: the print times k, per channel, as hex. At rest it is the print (within one 8-bit step). `backTone(face, pose, style?)`: the back tone times k of `-N`.
- `creaseGradient(face, crease, style?)`: `{ from, to, stops }`: from the hinge midpoint to 2.2 times the way to the centroid, stops at 0, `depth` and 1 scaled from `strength` so the seed's `.46 / .1 / .18` come back for strength .46.
- `occlusion(angle, style?)`: the per-frame darkening at a crease, `occlusion * |angle| / pi` (02, cue 8).
- `shadowAt(height, style?)`: `{ contact: { offset, blur, opacity }, ambient: { offset, blur, spread, opacity } }` by 02 cue 3: the logo's resting stack at 0, drifting, softening and fading with height; the contact layer gone by `fade` px.
- `faceHeight(fold, pose, faceId)`: the face's highest point above the sheet plane, 0 when flat or behind.
- `parseHex`, `hex`, `scaleColor`: the color arithmetic.

## fold-format.ts: FOLD import and export (D2)

- `FOLD`: the file's shape (the spec's keys plus an index signature for the rest). `FOLDClosure`: a closure as the file carries it (edge indices). `FromFOLDOptions`: `{ root? }`, a face index or id; given, it forces the breadth-first tree over `faces_orkami:parent`.
- `toFOLD(fold)`: spec 1.2, `file_creator: "orkami"`, `creasePattern` 2D frame with `vertices_coords`, `edges_vertices`, `edges_assignment` (M, V, F, B, U), `edges_foldAngle` (degrees, signed), `faces_vertices`, `faceOrders` (the closed state's parent-child stacking), one `foldedForm` child frame with the closed pose's 3D coordinates, and orkami's own data under `faces_orkami:id/parent/slot/page`, `edges_orkami:id/closing/start/duration`, `frame_orkami:total/sheet/suits/closures`. `fold.extra` is spread under it. A crease endpoint inside another face's edge is inserted as a vertex (T-junctions, the glyphs' strips).
- `fromFOLD(json, { root? })`: resolves `file_frames` inheritance, takes the first `creasePattern` frame, builds faces and creases (assignment from `edges_assignment`, else the sign of `edges_foldAngle`; `closed` from the angle, else pi), the tree from `faces_orkami:parent` or breadth first from `root` (face 0 by default), non-tree creases as closing creases, closures from the orkami key (else a solver-less closure that only reports the dihedral), the schedule and sheet from the orkami keys (else the vertices' extent). Unknown keys land in `extra`. Throws on `C`/`J` edges, an unassigned interior edge, or a 3D frame that is not a crease pattern. A `foldedForm` child frame is not read: the closed state is the angles.
- `fromFOLD(toFOLD(fold))` equals `fold` for every named fold.

## folds/: the named folds (D7)

Each takes a rectangle and returns a validated `Fold` with `name`, `suits` and its default schedule; the crease pattern, closed state, fold and unfold order are drawn in each file's header from `docs/study/01-how-paper-folds.md` section 3.

| function | pattern | suits | schedule |
|---|---|---|---|
| `book(w, h, side = 'left')` | one midline crease; `side` is the half that stays (`a`), `b` folds over it | wide, tall, square | together |
| `lift(w, h, edge = 'top')` | the block (`block`) hinged on one of its own edges to the page (`page`, the root, outside the box); waits mirrored across the edge, back up | wide, square, tall, list | together |
| `cupboard(w, h, axis = 'vertical')` | quarter-line creases `c1`, `c2`; doors `l`/`r` (or `t`/`b`) onto the middle `c` | vertical: wide; horizontal: tall | sequence c2, c1 |
| `accordion(w, h, n = 3, axis = 'horizontal')` | n creases alternating V, M; panels `p0..pn` as a chain | horizontal: list, tall; vertical: wide | sequence cn .. c1 |
| `blintz(w, h)` | the four corners `tl tr br bl` to the center on `c1..c4`; on a rectangle the corner lands where the reflection puts it | square (to about 5:4) | sequence c4 .. c1, step 30 |
| `diagonal(w, h, corner = 'tr')` | one corner-to-corner crease; the triangle with `corner` (`b`) over the other (`a`) | square (to about 5:4) | together |
| `waterbomb(w, h = w)` | square only (throws otherwise); eight eighths `T1 T2 Tl Tl2 T7 T8 Tr Tr2`, rays `OA OB OC OD Om1..Om4`; `OC` closing | square | together |
| `preliminary(w, h = w)` | square only; the same faces with the inverse assignment; `OC` closing, flat | square | together |
| `kite(w, h)` | two valleys `c1`, `c2` from the top-left corner bringing the left and top edges onto the diagonal; `left`, `right` over `kite` | square | sequence c2, c1 |

- `Side` (`book`), `Edge` (`lift`), `CupboardAxis`, `AccordionAxis`, `Corner` (`diagonal`): the option types.
- `NamedFold`: the nine names. `named`: `Record<NamedFold, (w, h) => Fold>` with each function's defaults, for an adapter picking a fold by a block's shape and `suits`.
- `fish` is catalogued (01, 3.10) and not shipped: it needs two closures.

## glyphs/: letters as folds

- `Glyph`: `{ char, width, fold, hinge }`: a letter's facets as the faces of a `Fold` on a cut sheet 270 tall, its hinges as creases (alternating V and M by depth, closed pi), and the root's own hinge (the letter's left edge, how it hangs in the word).
- `GLYPHS`, `glyph(char)`: M, A, S, L, C, H. `HEIGHT` 270, `STRIP` 72, `GAP` 40, `MARK_GAP` 52, `KERN` (`LA: -18`).
- `layout(text = 'MASLACH')`: `Word` `{ text, width, height, letters, faces }` placing the glyphs in a line as the seed did; each `PlacedFace` carries the face, its crease, the absolute polygon and hinge, and the slot.
- `points(pts)`: an SVG `points` string.
