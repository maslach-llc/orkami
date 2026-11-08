# How paper folds

The physical facts a motion must obey to read as a fold, the crease-pattern grammar the engine
speaks (FOLD), the catalogue of named folds with their crease patterns and fold and unfold
orders, and the schedule that moves a fold in time. Written 2026-11-02 before the code; doc 02
implements the model fixed here, `docs/design/01-decisions.md` records the choices.

Sources are listed at the end. A claim with no source note is derived here (geometry) or taken
from the seed code (removed by doc 04, kept in git history); a claim marked *unverified, from memory* has no source read this
session.

## 1. The physics of a fold

A sheet of paper is thin, stiff and inextensible. It bends along a line and nowhere else; the two
sides of that line turn about it as rigid plates. This is the rigid-origami model: "folding
structures using flat rigid sheets joined by hinges" (Wikipedia, Rigid origami, read 2026-11-02),
the model of Tachi's Rigid Origami Simulator, where "an origami configuration is represented by
folding angles of edges" and faces are "plates connected by hinges constrained around vertices"
(Tachi 2009, read 2026-11-02). It is exactly what a web page can afford: every face is one rigid
transform.

The rules. A motion is a fold only if all of them hold at every instant:

- **R1 Rigid faces.** A face never changes shape. Its transform is a rigid motion (rotation plus
  translation); no scale, no skew, no non-affine warp.
- **R2 One hinge per face.** A face moves only by rotating about a crease it shares with its
  parent face. The axis is the crease line, the parameter is the fold angle.
- **R3 Continuity.** The sheet stays joined across every crease: both faces keep the crease's two
  endpoints in common at every angle. In a hinge tree that is automatic: the child's transform is
  the parent's transform composed with a rotation about the crease expressed in the parent's
  frame, so whatever the parent does, the child's hinge moves with it.
- **R4 Mountain and valley are one hinge.** They are the two signs of the same fold angle. FOLD
  fixes the sign: positive is valley, negative is mountain (FOLD spec 1.2, read 2026-11-02). The
  engine keeps that sign.
- **R5 Range.** A fold angle runs from -180 to 180 degrees. At 0 the two faces are coplanar (flat
  sheet); at +-180 they lie on each other (flat-folded). Nothing goes past 180: the face would pass
  through its neighbour.
- **R6 Nothing passes through anything.** Faces that lie on each other have an order (FOLD
  `faceOrders`), and a face in motion must not sweep through a face it is not hinged to. In the
  drivers, stacked faces are separated by a paper thickness (a translateZ of a pixel) in that
  order, and the named folds in section 3 are chosen so their flaps never collide.
- **R7 Creases are remembered.** A crease, once made, stays in the sheet: it is visible as a
  hairline when the paper is flat again, and a flap that lands settles onto the surface rather
  than stopping dead (section 4 gives the settle; doc 02 gives the hairline). The engine never
  deletes a crease when its angle reaches 0.
- **R8 Interior vertices are constrained.** Where creases meet inside the sheet their angles are
  not independent: around the vertex, the product of the rotations about each crease must be the
  identity (Belcastro and Hull's single-vertex condition, used as the constraint in Tachi 2009).
  A hinge tree cannot express that on its own, because a vertex is a loop of faces and a tree
  has no loops. Section 3 says which named folds have interior vertices (waterbomb, preliminary,
  fish) and how the engine handles them (one closing crease solved, not scheduled).

Two consequences the seed got wrong and the engine will not:

- A flap standing on its edge (the seed's `lift` starts at -90 degrees) is not a rest state. Paper
  rests at 0 or at +-180. A block waits folded flat, back up, and opens from there.
- A motion that scales, fades or slides a face in place of turning it on a crease is not a fold.
  Nothing in `src/` may produce one (CLAUDE.md, the paper rule).

Flat-foldability, the tests for a hand-written pattern. At a vertex of a flat-folded sheet:

- **Maekawa.** "At any vertex the number of valley and mountain folds always differ by two"
  (Wikipedia, Mathematics of paper folding, read 2026-11-02). So the degree of a flat-foldable
  vertex is even, and M - V = +-2.
- **Kawasaki.** "At any vertex, the sum of all the odd angles adds up to 180 degrees, as do the
  even" (same source): the alternating sector angles around the vertex sum to 180.

These are necessary conditions for flat folding, not for rigid folding: "some patterns that can
be folded flat in conventional origami cannot be folded flat rigidly" (Wikipedia, Rigid origami),
and deciding rigid foldability in general is NP-hard (same source). The engine does not solve
that problem. Its named folds are either trees (no interior vertex, always rigidly foldable one
crease at a time) or the two symmetric single-vertex bases whose rigid path is known to exist.
A test in doc 02 runs Maekawa and Kawasaki on every named fold's pattern.

## 2. The crease pattern and its grammar: FOLD

FOLD (Flexible Origami List Datastructure) is a JSON file format "for describing origami models"
(github.com/edemaine/fold, MIT, read 2026-11-02; spec version 1.2 at `doc/spec.md`, read
2026-11-02). It is the interchange format of Origami Simulator (its internal data structure) and
of Rabbit Ear (its mesh format), so a pattern drawn in either loads into orkami through it.

What the spec defines (all keys optional; parallel arrays indexed by id):

| key | meaning (spec 1.2) |
|---|---|
| `file_spec`, `file_creator`, `file_author`, `file_title`, `file_description`, `file_classes` | file metadata; classes `singleModel`, `multiModel`, `animation`, `diagrams` |
| `frame_title`, `frame_classes`, `frame_attributes`, `frame_unit` | frame metadata; classes `creasePattern`, `foldedForm`, `graph`, `linkage`; attributes `2D`/`3D`, `manifold`, `orientable`, `selfTouching`, `convexFaces`, ... |
| `vertices_coords` | `[x, y]` or `[x, y, z]` per vertex |
| `vertices_vertices`, `vertices_edges`, `vertices_faces` | adjacency, counterclockwise |
| `edges_vertices` | `[u, v]` per edge; the pair orients the edge |
| `edges_faces` | the one or two faces on an edge |
| `edges_assignment` | `B` boundary, `M` mountain, `V` valley, `F` flat, `U` unassigned; 1.2 adds `C` cut and `J` join |
| `edges_foldAngle` | degrees in [-180, 180], "positive means valley and negative means mountain", zero for flat, unassigned or border |
| `edges_length` | for abstract frames |
| `faces_vertices` | vertex ids counterclockwise |
| `faces_edges`, `faces_faces` | aligned edge list, neighbours across edges |
| `faceOrders` | triples `[f, g, s]`: `+1` f lies above g on the side g's normal points to, `-1` below, `0` unknown |
| `edgeOrders` | the same for edges, 2D only |
| `file_frames` | further frames; frame 0 is the top level; `frame_parent`, `frame_inherit` build a tree of frames that inherit unlisted keys |

Custom keys must carry a colon-prefixed namespace (`"edges_orkami:..."`); keys without a colon are
reserved for the spec.

**The subset orkami imports.** `vertices_coords` (2D; a 3D frame is projected by dropping z only
when the frame is a `creasePattern`), `edges_vertices`, `edges_assignment`, `edges_foldAngle`,
`faces_vertices`, `faceOrders`, `frame_classes`, `frame_attributes`, `frame_unit`,
`file_frames` with `frame_parent`/`frame_inherit` resolved (the key frame as the pattern, a child
frame of class `foldedForm` as the closed state when present). Everything else is read and kept
on the model untouched so it round-trips. An import without `edges_assignment` takes the sign of
`edges_foldAngle`; without either, every non-boundary edge is `U` and the fold cannot be posed.
Origami Simulator requires exactly `vertices_coords`, `edges_vertices`, `edges_assignment` and
`faces_vertices` and reads targets from `edges_foldAngle` (origamisimulator.org, read
2026-11-02); the same four are enough for orkami.

**The subset orkami exports.** `file_spec: 1.2`, `file_creator: "orkami"`, `file_classes:
["singleModel"]`, `frame_classes: ["creasePattern"]`, `frame_attributes: ["2D"]`, `frame_unit:
"unit"` (page pixels have no physical meaning), `vertices_coords`, `edges_vertices`,
`edges_assignment`, `edges_foldAngle` (the closed state's angles), `faces_vertices`,
`faceOrders` (the closed state's stacking), and one entry in `file_frames` of class `foldedForm`
with `frame_inherit: true` holding the closed pose's 3D `vertices_coords`. Custom data (the hinge
tree root, the schedule) goes under `orkami:` keys: `faces_orkami:parent`, `edges_orkami:start`,
`edges_orkami:duration`, so a file opened in Origami Simulator or Rabbit Ear ignores them and
still folds.

What FOLD does not carry and orkami adds on top: the root face (which face stays put), the hinge
tree (derived from faces_faces plus the root; a spanning tree, see `docs/design/01-decisions.md`
D3), the schedule, and the page rectangle the pattern is fitted to.

## 3. The bases and the named folds

Conventions for the patterns below. The sheet is the block's rectangle, W wide and H tall, origin
top left, y down (page coordinates). The **root** is the face that stays put. The **closed state**
is how the block lies before it opens; "visible closed" lists what the visitor sees then. Fold
order is how a hand makes it from the flat sheet; unfold order is the hand's order reversed: the
last crease made is the first undone, the outermost flap moves first. Angles are the closed
state's; every unfold runs them to 0.

Legend in the drawings: `+ - |` the sheet's border (B), `V` valley, `M` mountain, `F` a crease
that is flat in the closed state (pre-creased, visible as a hairline, angle 0), `o` an edge
midpoint, `O` the sheet's center. A line's letter is given beside the drawing, not by its style.

### 3.1 Book fold (`book`)

One crease across the sheet; one half turns over onto the other. The simplest fold and the
seed's `top | bottom | left | right` hinges.

```
 +-----------+-----------+
 |           |           |
 |     A     |     B     |     c1 (V): x = W/2, (W/2, 0) to (W/2, H)
 |   root    |           |     B folds over A: angle 180
 |           |           |
 +-----------+-----------+
```

- Flat: W x H. Closed: W/2 x H (the left half), two layers.
- Visible closed: the back of B lying on A. A is hidden under it. With the sheet paint
  (`docs/study/02-paper-on-a-screen.md`), the back of B is the page where B lies: the block is
  invisible until it moves.
- Fold order: c1. Unfold order: c1. One crease, one motion.
- Suits: every rectangle. A wide hero on a horizontal crease (it waits as a strip, half its
  height); a column or sidebar on a vertical crease (it waits over its neighbour); any block that
  opens out of the thing beside it.
- Variants by crease position: the crease may sit on any edge of the block instead of the middle:
  then A is not part of the block but the sheet itself (the page), and the whole block is B. That
  is the lift.

### 3.2 Lift (`lift`)

A book fold whose root is the page. The block is a flap of the sheet hinged on one of its own
edges, lying folded back over the page with its back up; opening it turns it 180 degrees onto its
place.

```
 ===========================   the page (root; the sheet paint is this)
 +-------------------------+   c1 (V): the block's top edge, (0, 0) to (W, 0)
 |                         |
 |         block           |   closed: lying above its place, back up, over the page
 |                         |   (y from -H to 0), angle 180
 +-------------------------+
```

- Flat: W x H in place. Closed: W x H, mirrored across the hinge edge, back up.
- Visible closed: the back of the block, painted with the sheet at the spot it lies on: nothing.
- Fold order: c1. Unfold order: c1.
- Suits: everything that should arrive out of the background: sections, cards, rows. The hinge
  edge is the one nearest the content it belongs to (top for a section under a heading, left for
  a panel beside its label).
- Ruled out: the seed's -90 degree start (the flap standing on its edge). Paper rests flat.
  Content on the flap is printed on it and is invisible while the back faces the visitor (02,
  cue 5), so there is no fade.

### 3.3 Cupboard (`cupboard`)

Two parallel valleys at the quarter lines; both outer quarters fold in to meet at the center, two
doors.

```
 +-----+-----------+-----+
 |     |           |     |     c1 (V): x = W/4      c2 (V): x = 3W/4
 |  L  |     C     |  R  |     L folds over the left half of C, R over the right half
 |     |   root    |     |     both angle 180
 +-----+-----------+-----+
```

- Flat: W x H. Closed: W/2 x H (the middle), two layers, the doors' backs meeting on the
  center line.
- Visible closed: the backs of L and R, edge to edge; C hidden under them.
- Fold order: c1 then c2 (or together; they are independent children of C). Unfold order: c2
  then c1, or both at once; a stagger of one step between them reads as a hand opening one door
  then the other.
- Suits: a wide hero (it waits as a half-width panel and opens to full width, the doors swinging
  out sideways); turned 90 degrees (creases at y = H/4 and 3H/4), a tall column that opens top
  and bottom: this is the right fold for a tall block, where the blintz is not (3.4).

### 3.4 Blintz (`blintz`)

The four corners folded to the center on the creases joining the edge midpoints. "A blintz base
is made by folding the corners of a square into the center" (Wikipedia, Origami techniques, read
2026-11-02).

```
 +-----------o-----------+
 |         /   \         |     c1 (V): (W/2, 0) to (0, H/2)      TL
 |  TL   /       \  TR   |     c2 (V): (W/2, 0) to (W, H/2)      TR
 |     /           \     |     c3 (V): (W, H/2) to (W/2, H)      BR
 o   /       C       \   o     c4 (V): (0, H/2) to (W/2, H)      BL
 |     \   root     /     |     every corner angle 180
 |  BL   \       /  BR   |
 |         \   /         |
 +-----------o-----------+
```

- Flat: W x H. Closed, on a square: the diamond between the edge midpoints, half the area, two
  layers; the four corner tips meet at O.
- Visible closed: the backs of the four corner triangles, meeting at the center point; C hidden.
- Fold order: c1, c2, c3, c4 (any order; on a square the flaps touch only along their edges). The
  engine's order is clockwise from top left, each a third of a step after the last (the seed's
  30 ms at a 90 ms step). Unfold order: the reverse, c4 first; or all four together.
- Suits: a square card, the thumbnail that opens into the card. Not a tall column and not a wide
  block, for a geometric reason, not a taste:

**The owner's observation, confirmed with the geometry.** Folding corner (0, 0) on the crease from
(W/2, 0) to (0, H/2) lands it at

    P = ( W H^2 / (W^2 + H^2),  W^2 H / (W^2 + H^2) )

which is the center only when W = H. For a 1:3 column (W = 100, H = 300) the top-left corner
lands at (90, 30): near the right edge, outside the diamond (the diamond test |x - W/2|/(W/2) +
|y - H/2|/(H/2) <= 1 gives 1.6), and on top of where the top-right corner lands, (10, 30). The two
flaps cross; the closed state is not a diamond, and nothing meets at the center. The overlap
appears as soon as H != W (the corner's x passes W/2 exactly when H > W) and grows with the
aspect ratio. So: the blintz is a square's fold. The engine folds a rectangle's blintz exactly
as the geometry says (the corner lands at P, the later flap layered over the earlier), never
faked to the center, and the catalogue recommends it only up to about 5:4, where the crossing is
a sliver. A tall column takes the cupboard turned (3.3) or the accordion (3.6).

### 3.5 Diagonal (`diagonal`)

One crease corner to corner; one triangle turns over onto the other.

```
 +-----------------------+
 |  \                    |
 |     \        B        |     c1 (V): (0, 0) to (W, H)
 |        \              |     B (the triangle with corner (W, 0)) folds over A: angle 180
 |    A      \           |
 |   root       \        |
 |                 \     |
 +-----------------------+
```

- Flat: W x H. Closed, on a square: the triangle A, two layers.
- Visible closed: the back of B on A.
- Fold order: c1. Unfold order: c1.
- Suits: a square or near-square card. **The owner's second observation, confirmed:** on a wide
  block the crease is nearly horizontal (a 3:1 block puts it 18 degrees from the horizontal), the
  moving corner (W, 0) reflected across it lands outside the block (at (W(W^2 - H^2)/(W^2 + H^2),
  2W^2H/(W^2 + H^2)) for the crease through the origin; for W = 300, H = 100 that is (240, 180),
  below the block's bottom edge), so the closed state overhangs the block's box, and the flap sweeps a volume
  wider than the block as it turns, seen almost edge-on. That reads as a slab tilting, not as a
  fold. The engine keeps the geometry honest (the flap lands where the reflection puts it) and the
  catalogue limits the diagonal to aspect ratios under about 5:4. A wide block takes the book or
  the cupboard.

### 3.6 Accordion, or pleat (`accordion`)

n parallel creases, alternately valley and mountain; n + 1 panels zigzag onto each other. "Pleat
fold, also called an accordion fold" (Wikipedia, Origami techniques, read 2026-11-02). Each panel
is hinged to the panel before it: a chain.

```
 +-----------------------+
 |          P0  root     |
 +-----------------------+   c1 (V), y = H/4
 |          P1           |
 +-----------------------+   c2 (M), y = H/2
 |          P2           |
 +-----------------------+   c3 (V), y = 3H/4
 |          P3           |
 +-----------------------+
```

- Flat: W x H. Closed: W x H/(n+1), n + 1 layers, P1 on P0, P2 under P1 (it folds the other way),
  and so on.
- Visible closed: the top of the stack. With the pattern above, P1's back lies on P0 (valley),
  P2 folds behind P1 so P2's front faces down, P3's back faces up on top: the visible face is the
  back of the last panel when n is odd, its front when n is even. The engine computes this from
  the signs rather than assuming.
- Fold order: c1, c2, c3: the hand pleats from the fixed end, each panel onto the stack. Unfold
  order: c3, c2, c1: the outermost panel swings out first and lands beside the stack, then the
  next swings out carrying the one already open, and so on. The open length doubles at each
  step; the far end travels at every step, the way a carpet unrolls. Opening c1 first would
  swing the whole stack as one packet: that is the "flying" the owner rejected.
- **Revised 2026-11-02 (0.1.1), after the owner's look on a real GPU:** played crease by crease,
  the carpet still swings each opened run through the air as one flat board, and a real pleat on
  a table does not move that way. It opens all at once: with c1 at angle a and every other crease
  at 2a, P1 rises at a, P2 comes back down at -a, P3 rises again, so the even creases are the
  ridges and the odd ones (c3, c5, ...) rest on the table and slide toward c1. Unfolding from
  closed, the inner creases stay shut until c1 reaches 90 degrees (the stack stands up on c1),
  then the zigzag fans out to flat. Checked in `test/pleat.test.ts`: no face goes below the sheet
  at any t, and while c1 is under 90 degrees the low creases are at z = 0. It is the schedule's
  follow (D4 amended).
- Suits: a list of steps (one panel per step) on horizontal creases: **the owner's third
  observation, confirmed**: a list wants a pleat; a tall column likewise; a strip of letters or
  cards side by side on vertical creases (the wordmark is an accordion of letters, each letter's
  root hinged on the gap before it, the seed's `OrigamiUnfold.vue`). Items that are separate
  cards, not one strip, want independent lifts with a stagger instead (3.2, scheduled by the
  stagger in section 4); the engine offers both and names them differently.

### 3.7 Waterbomb base (`waterbomb`)

A square pre-creased on both diagonals and both midlines, collapsed into a triangle with four
flaps. Wikipedia (Yoshizawa-Randlett system, read 2026-11-02): "two perpendicular valley folds
down the diagonals of the square" plus two mountain folds down the center, "collapsed into a
triangle with four flaps", and "the waterbomb base is an inside-out preliminary fold". That is the
pre-crease. The closed state's assignment, derived here by walking its layers and checked with
Maekawa, is different: only six of the eight rays at the center are folded.

```
 A        m1        B                 rays from O         closed angle
 +--------+---------+                 O-A  O-B  O-C  O-D   M, 180
 |\   T1  .   T2   /|                 O-m2 O-m4            V, 180
 |  \     .      /  |                 O-m1 O-m3            F, 0  (pre-creased, flat)
 |    \   .    /    |
 | Tl   \ . /   Tr  |                 faces: eight eighths, T1 = O A m1, T2 = O m1 B,
 m4 - - - O - - - - m2                Tl = O A m4, Tl' = O m4 D, T7 = O D m3,
 | Tl'  / . \   Tr' |                 T8 = O m3 C, Tr' = O m2 C, Tr = O m2 B
 |    /   .    \    |
 |  /     .      \  |                 face cycle around O:
 |/   T7  .   T8   \|                 T1 -OA- Tl -Om4- Tl' -OD- T7 -Om3- T8 -OC- Tr' -Om2- Tr -OB- T2 -Om1- T1
 +--------+---------+
 D        m3        C
```

*Corrected 2026-11-03:* the walk below is the base seen from the front, held by its front layer,
which puts every other layer behind the root and so below the page. The engine models the same
paper seen from its back, with T1 + T2 lying on the page and the rest rising toward the visitor:
every assignment below is inverted in `src/core/folds/waterbomb.ts` (diagonals V, midlines M,
Maekawa V = 4, M = 2), and the visitor sees the backs of T7 + T8 on top when closed (D10, amended).

Why six: the closed triangle is O A B (base on the top edge, apex at the center), four layers of
two eighths each. The front layer is T1 + T2, coplanar across O-m1, so O-m1 is flat; O-A and O-B
turn Tl and Tr behind it (mountain); O-m4 and O-m2 turn Tl' and Tr' behind those (the next fold
of an accordion, so valley); O-D and O-C turn T7 and T8 behind those (mountain); T7 + T8 are
coplanar across O-m3. Each side of the cycle is a three-crease accordion M V M between the two
flat 90 degree wedges. Maekawa at O over the six folded rays: M = 4, V = 2, difference 2.
Kawasaki: sectors 90, 45, 45, 90, 45, 45, alternating sums 180 and 180.

- Flat: W x W (a square; a rectangle makes the diagonals miss the corners and the base does not
  close). Closed: the triangle O A B, W x W/2, four layers.
- Visible closed: the front of T1 + T2 (the top-center triangle of the content, with a flat
  crease down its middle); the rest behind.
- Fold order, by hand: the midline O-m4/O-m2 as a book fold through the whole sheet, then the
  sides pushed in (the diagonals through both layers). The second step is one coupled motion.
  Unfold order: one coupled motion back, all six creases at once, the two flat ones staying at 0.
  There is no sequence here: pulling the front and back layers apart opens every crease together
  (the layer analysis shows why a sequence cannot exist: T7 + T8 would have to turn about two
  different axes at once).
- The engine: the hinge tree roots on T1 + T2 (one face, O-m1 flat), runs the two chains Tl, Tl',
  T7 and Tr, Tr', T8 outward, and leaves one closing crease (O-C) out of the tree. The schedule
  drives the chain's angles by one parameter through the symmetric motion; the closing crease's
  angle is whatever brings T8 to where Tr' would hinge it, solved numerically per frame
  (bisection on one scalar) so R8 holds. This is doc 02's one piece of non-trivial geometry,
  and it is the same machinery the preliminary needs.
- Suits: a square card that waits as a tab at the top of its place (the triangle) and drops open
  into the square.

### 3.8 Preliminary, or square base (`preliminary`)

The inverse assignment of the waterbomb, collapsing into a square. Pre-crease per Wikipedia (read
2026-11-02): "two perpendicular diagonal mountain folds that bisect the corners of the square"
plus two valley folds that bisect the edges, collapsing "into a square with four triangular
flaps". The closed assignment, by the same layer walk:

```
 same figure as 3.7              rays from O              closed angle
                                 O-m1 O-m2 O-m3 O-m4      M, 180
                                 O-B  O-D                 V, 180
                                 O-A  O-C                 F, 0
```

- Flat: W x W. Closed: the quarter A m1 O m4, W/2 x W/2, four layers (the front layer is
  T1 + Tl, coplanar across the flat O-A; the diamond of the textbook drawing is this square seen
  with O at the top).
- Visible closed: the front of the top-left quarter of the content, with a flat crease on its
  diagonal; the rest behind.
- Fold and unfold order: as the waterbomb, one coupled motion; the tree roots on T1 + Tl, the
  chains run T2, Tr, Tr' and Tl', T7, T8, and the closing crease is O-C. Maekawa: M = 4, V = 2.
- *Corrected 2026-11-03:* as for the waterbomb, the engine models this paper from its back, T1 +
  Tl on the page and the layers rising toward the visitor: assignments inverted in
  `src/core/folds/preliminary.ts` (midlines V, O-B and O-D M), the visitor sees the backs of
  Tr' + T8 on top when closed (D10, amended).
- Suits: a square card that waits as its own top-left quarter (a thumbnail at a quarter of the
  size) and opens to four times the area.

### 3.9 Kite base (`kite`)

Two valleys bringing two adjacent edges onto the diagonal: "Two valley folds that bring two
adjacent edges of the square together" to lie on the diagonal (Wikipedia, Yoshizawa-Randlett,
read 2026-11-02). Drawn with the square on its corner, A at the top, the reference diagonal A-C
vertical.

```
          A
         /|\
        / | \
       /  |  \        c1 (V): A to p, where p is on D-C and angle(p A C) = 22.5 degrees
      /   |   \       c2 (V): A to q, where q is on B-C, mirror of p
     /    |    \      A-C: a reference line, not a crease (F or absent)
  D /     |     \ B   the flaps (A D p) and (A B q) fold over the kite (A p C q), angle 180
    \  ,--+--.  /
     \/   |   \/
     p\   |   /q
       \  |  /
        \ | /
         \|/
          C
```

- Flat: the square. Closed: the kite A p C q, two layers on its upper half.
- Visible closed: the backs of the two flaps over the top of the kite; the lower part of the kite
  (toward C) shows its front.
- Fold order: c1, c2 (independent children of the kite). Unfold order: c2, c1, or together.
- Suits: a square block with a pointed top (an arrow, a tag). Rare on a page; kept because the
  fish base and the bird base start from it and the letter glyphs use its 22.5 degree wedges.

### 3.10 Fish base (`fish`)

The kite with its two side corners rabbit-eared: on each flap, the three angle bisectors of the
triangle beyond the kite crease meet at its incenter, and the flap's corner folds down into a
point. Wikipedia (read 2026-11-02): two radial folds against a diagonal reference crease on
opposite corners, the other two flaps "folded downward in the same direction, forming two
side-by-side rabbit ears".

```
          A
         /|\
        / | \
       /  |  \        on each side: c1 (V) A-p as in the kite, plus the rabbit ear of
      /   |   \       triangle (D p A): bisectors from D, p and A meeting at incenter i,
     /    |    \      D-i (V), p-i (V), and the ear A-i (M) that lays the point down.
  D /--i  |  i'-\ B   i and i' are interior vertices of degree 4.
    \  `. | .'  /
     \/   |   \/
     p\   |   /q
       \  |  /
        \ | /
         \|/
          C
```

- Flat: the square. Closed: a narrow kite with two small flaps (the ears) lying on it, up to four
  layers at the ears.
- Visible closed: the backs of the two rabbit ears over the kite's upper half.
- Fold order: c1, c2 (the kite), then each rabbit ear (three creases at once, a coupled motion
  about its interior vertex). Unfold order: the ears first (each one coupled motion), then the
  kite flaps.
- The engine: two interior vertices of degree 4, each with one degree of freedom (a flat-foldable
  degree-4 vertex folds rigidly along one path; *unverified, from memory*). Needs the closure
  solver of 3.7 twice. Not in the first release's playground; catalogued so the pattern and the
  order are fixed.
- Suits: nothing on a page yet; a glyph base.

### 3.11 Moves, not bases

A move is a change applied to a flap that already exists in a folded pose: it adds creases
through several layers and usually an interior vertex. The engine represents a move as a
sub-pattern on an existing pose with its own closure, scheduled as one coupled motion; none ships
as a named fold in the first release, and the definitions are here so the words mean one thing.

| move | what happens | geometry |
|---|---|---|
| inside reverse fold | a flap's tip is pushed in between its own layers; the spine crease reverses sign over the pushed segment and two new creases run from the push point to the tip. "Reverse folds of a corner are typically used to produce feet or birds heads" (Wikipedia, read 2026-11-02) | one degree-4 vertex on the spine; one coupled motion |
| outside reverse fold | the same, the tip wrapped around the outside instead of in | the same vertex, opposite sign |
| squash fold | a standing flap is opened and pressed flat symmetrically about its spine ("Squash fold applied to one flap of a waterbomb base", same source) | the spine's two layers open to 180 while the flap's base crease closes: a symmetric 1-DOF motion |
| petal fold | "starts with two connected flaps, each of which has at least two layers"; the point is lifted and the edges meet on the center line; "equivalent to two side-by-side rabbit ears joined along a reference crease" (same source) | two degree-4 vertices, mirrored; one parameter by symmetry |
| rabbit ear | the three bisectors of a triangle meet at its incenter and the corner lies down as a point (same source) | one degree-4 vertex |
| sink | a closed point pushed inside the model, reversing the creases around it; "considered an intermediary to high skill" (same source) | many vertices; out of scope |

## 4. How a fold moves in time

**Two ways to fold.** Origami Simulator "attempts to fold every crease simultaneously" by
"iteratively solving for small displacements in the geometry of an initially flat sheet due to
forces exerted by creases" (github.com/amandaghassaei/OrigamiSimulator README, read 2026-11-02).
Every crease has a target angle and one slider sets them all: in the solver's shader the target
is `creaseMeta[2] * u_creasePercent` (index.html, read 2026-11-02), the fold angle times the
global fold percent, "100% is fully folded, 0% is unfolded, and -100% is fully folded with the
opposite mountain/valley assignments" (origamisimulator.org, read 2026-11-02). Each crease is a
rotational spring toward its target (`angForce = creaseMeta[0] * (targetTheta - theta)`), the
sheet a mesh of axial springs ("distance constraints prevent the sheet from stretching or
compressing", site) and face-flatness constraints, with defaults `creasePercent 0.6`,
`axialStiffness 20`, `creaseStiffness 0.7`, `faceStiffness 0.2`, `percentDamping 0.45`
(js/globals.js, read 2026-11-02); raising face stiffness "models the behavior of a rigid
material (such as metal)" (site). It looks like paper because the whole sheet moves at once under
one parameter and the faces bend together under strain, and because it never overshoots: a damped
spring settles.

A hand folds a sequence: one crease at a time, each finished before the next, the unfold the same
sequence reversed. Tachi's simulator does the rigid version of the simultaneous fold: all crease
angles move together, projected onto the vertex constraints each step (Tachi 2009, read
2026-11-02).

**The seed's timings** (the numbers the owner has approved by eye):

| where | duration per crease | stagger | easing | closed angle |
|---|---|---|---|---|
| the seed's `origami.css` `--ori-dur`, `v-unfold` | 700 ms | 90 ms between siblings, 30 ms between a blintz's corners | `cubic-bezier(.22, .75, .25, 1)` | 180 (book), -90 (lift), 180 (quad flaps) |
| the seed's `OrigamiUnfold.vue` (CSS wordmark) | 760 ms | 60 ms between a letter's creases, 70 ms between letters | `cubic-bezier(.4, .1, .2, 1)` | 180 |
| the seed's `OrigamiUnfold3D.vue` (WebGL wordmark) | 760 ms | 60 / 70 ms as above | the same bezier, solved numerically | 180; a letter's root starts tilted 0.08 pi |
| the owner's note in the plan doc | 640 ms per letter | 70 ms between letters | | |

Both beziers stay inside [0, 1] on y: no overshoot, which is right (paper does not bounce past
flat; it decelerates into the surface). A letter's creases 60 ms apart over 760 ms overlap by
more than 90 percent: the seed's "sequence" is in practice a simultaneous fold with a slight
lead, and that is the look the owner accepted. The 0.08 pi tilt of a letter's root is not a rest
state (section 1) and goes.

**The schedule the engine adopts.** A fold's motion is a global time t in [0, 1] (the driver maps
it to wall-clock milliseconds, a scroll position or a slider) and, per crease, a `start`, a
`duration` and an `easing`, all in units of t:

    angle_c(t) = closed_c * (1 - ease_c( clamp((t - start_c) / duration_c, 0, 1) ))

- Simultaneous (Origami Simulator's slider): every crease `start 0, duration 1`. The default
  for a named fold with one crease and for the coupled bases (one parameter, closure solved).
- Sequence (a hand): the creases in unfold order (section 3), `start_k = k * step`, with `step`
  small against `duration` (the seed's 60 / 760) so the motion overlaps and reads as one gesture,
  or `step >= duration` for a true step-by-step (a list of steps read one by one).
- Stagger (independent flaps, the seed's `.stagger`): the same per-crease `start`, applied to
  flaps that are siblings on the root rather than a chain.
- Easing: one curve for all paper, the seed's `cubic-bezier(.22, .75, .25, 1)` (a fast start,
  a long decelerating tail: the flap falls under its own weight and the air slows it). The
  WebGL driver evaluates the same bezier numerically, as the seed does, so both drivers land at
  the same angle at the same t.
- Settle: a flap landing on a surface reaches 0 and stays; the shadow and the crease hairline
  mark the contact (02, cues 3 and 6), the shade reaches its rest tone. No bounce. The visible
  "settle" is the easing's tail: the last 10 degrees take the last third of the duration.
- Duration against size. At one angular speed a big flap's tip moves faster than a small flap's
  tip, and a hand lets a big flap fall slower. The engine scales duration with the flap's reach
  (the farthest point of the face and everything hinged beyond it from the crease, in px):

      duration_c = base * clamp( sqrt(reach_c / 240), 0.6, 1.6 )

  with `base` 640 ms (the owner's number for a letter, whose reach is about 240 px at the hero
  size). A 60 px card edge then takes 320 ms, a 600 px hero 1010 ms. The square root and the
  clamp are a design rule to be tuned on the playground, not a physical law; a drop under gravity
  would give a square root too, but paper is drag-limited, so no claim is made.

The sheet in Origami Simulator also strains, which is what makes a non-rigid pattern bend. The
engine does not model strain: a named fold here is rigidly foldable by construction (trees and
the two symmetric bases), so no face ever needs to bend, and the drivers can keep one transform
per face.

## 5. Loops: paper folding itself

A loader wants paper that keeps folding until something is ready. Real paper cannot morph from one
base into another: the waterbomb and the preliminary base share every crease line with opposite
assignments (3.7, 3.8), and the only way from one to the other is to unfold to flat and fold again
on the other assignment. Any frame between two bases that is not one of the two folds is a sheet
that would have to stretch or tear. So a loop is a sequence of real folds on one sheet, each
played whole, flat -> closed -> flat, and the next one begins from flat.

**Which cycles read as paper folding itself.** The square bases do: the waterbomb, the
preliminary and the blintz. The whole sheet takes part, every face moves, the sheet collapses to a
compact closed form a fraction of its size and opens back, and nothing is left lying still as a
background for the rest. The two closure-solved bases rise off the table as they collapse (their
layers stack toward the visitor), so the shadow grows soft and long in the air and tightens at the
landing: the shadow breathes, and that rise and fall is most of what makes the loop read as paper
and not as a drawing changing shape. The blintz's four corners lift together and do the same in
miniature. One-flap folds (`book`, `lift`) do not: a single flap swinging over a sheet that stays
put reads as a page turning, not as paper folding itself, and looped it reads as a page being
turned back and forth. They are the unfold's folds, not the loop's. The default loop is the three
square bases in that order (`LOOP_BASES`); the bases need a square sheet.

**The fold-in is the unfold played backwards.** A step's fold-in runs its unfold schedule from t =
1 to t = 0, so the first crease undone by the unfold is the last one made by the fold-in, as a hand
retraces its own folds (section 3, unfold order). One schedule serves both halves, and both halves
take the step's duration (the schedule's total by default).

**The hold at closed.** At t = 0 the paper rests a beat before it opens: `hold`, 240 ms by
default. About a quarter of a second reads as the paper resting in its closed form, a fold
finished and held; much longer reads as a stall, the motion stuck rather than paused. Zero is
allowed and reads as a bounce off the closed state, which paper does not do (section 4, settle).

**The gap at flat, and why steps meet at flat.** After the unfold the sheet lies flat for `gap`,
160 ms by default, before the next step folds in. Steps meet at flat for two reasons:

- Every step's flat state is the same sheet: the same square, every face at the identity, lying
  in the page. A driver can swap one step's crease pattern for the next there and nothing on
  screen changes. At any other moment the two steps' faces differ and a swap would show as a pop. The gap guarantees at least one flat frame is drawn before the swap.
- A stop always has a flat moment within one step to land on. When the loader is told to stop it
  does not fade the paper out or cut away mid-fold, both of which break the paper rule: it lets
  the step it is in finish its move (`nextFlat`: the moment itself when the sheet is flat, else the
  end of the playing step's unfold), lands flat, and the flat sheet is what remains. The wait is at
  most one step.

One step on the loop's clock, `d` the step's duration:

    ms:  0             d             d+hold          2d+hold       2d+hold+gap
         |   fold-in   |     hold     |    unfold     |     gap      |
    t:   1 ----------> 0 ............ 0 ------------> 1 ............ 1
         flat          closed         closed          flat           flat: the next step

The step's length is `2d + hold + gap`; the loop's period is the sum of its steps' lengths, and the
clock wraps past it to the first step again.

## Sources

Read this session, 2026-11-02:

- FOLD spec 1.2, https://raw.githubusercontent.com/edemaine/fold/main/doc/spec.md, and the repo
  https://github.com/edemaine/fold (MIT; last push 2024-01-04 per the GitHub API).
- Origami Simulator: https://origamisimulator.org/ (site text),
  https://github.com/amandaghassaei/OrigamiSimulator (README, `js/globals.js`, `index.html`
  shader source; MIT; last push 2026-10-13 per the GitHub API).
- Ghassaei, Demaine, Gershenfeld, "Fast, Interactive Origami Simulation using GPU Computation",
  Origami7 (OSME 2018), abstract page https://erikdemaine.org/papers/OrigamiSimulator_Origami7/.
- Tachi, "Simulation of Rigid Origami", Origami4 (2009), draft PDF linked from
  https://origami.c.u-tokyo.ac.jp/~tachi/cg/ (sections 1 and 2 read); Tachi's software page
  https://tsg.ne.jp/TT/software/ (Rigid Origami Simulator 0.09, 2010; Freeform Origami 1.1, 2020;
  both proprietary, free for non-commercial use).
- Wikipedia: https://en.wikipedia.org/wiki/Mathematics_of_paper_folding (Maekawa, Kawasaki,
  flat-foldability), https://en.wikipedia.org/wiki/Rigid_origami,
  https://en.wikipedia.org/wiki/Miura_fold ("at each step, each parallelogram is completely
  flat"), https://en.wikipedia.org/wiki/Yoshizawa%E2%80%93Randlett_system and
  https://en.wikipedia.org/wiki/Origami_techniques (bases and moves).
- Rabbit Ear readme and `package.json` via the GitHub API (0.9.41, 2026-10-16, GPLv3) and
  https://github.com/rabbit-ear/rabbit-ear.
- The seed: `origami.css`, `unfold.ts`, `utils/origami.ts`,
  `OrigamiUnfold.vue`, `OrigamiUnfold3D.vue` (removed by doc 04, in git history).

Unverified, from memory: the one-degree-of-freedom rigid path of a flat-foldable degree-4 vertex
(3.10); the existence of the symmetric rigid collapse path of the waterbomb and preliminary bases
from flat to flat-folded (3.7, 3.8; the folded-state assignments and the Maekawa counts are
derived above, the continuous path is asserted). The rest of section 3's geometry (landing
points, overlaps, layer walks) is derived in this document and is testable in doc 02.
