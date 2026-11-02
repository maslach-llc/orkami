# Vocabulary

The words the code uses, one meaning each. Where origami has a word (Yoshizawa-Randlett
diagramming, Lang's and Demaine's usage, the FOLD spec) that word is used with that meaning;
the rest are the engine's. Fixed 2026-11-02 by `docs/study/01-how-paper-folds.md`; a later doc
that needs a new word adds it here in the same commit.

| word | meaning |
|---|---|
| **sheet** | The piece of paper a fold is made in: the block's rectangle (or the page itself, for a lift). One sheet per fold. Also the page's own paper that blocks are folded out of (the host's sheet, see sheet paint). |
| **face** | A flat polygon of the sheet bounded by creases and the sheet's border. Rigid: it never changes shape. FOLD's `faces_vertices`. |
| **crease** | A straight line in the sheet where it bends, shared by exactly two faces (FOLD's edges with assignment `M`, `V` or `F`; a border edge `B` is not a crease). A crease is remembered: it stays in the sheet at angle 0. |
| **hinge** | A crease seen from the face that turns on it: the axis (the crease line in the parent's frame) and the face that hangs off it. Every face except the root has exactly one hinge. |
| **flap** | A face together with everything hinged beyond it: the part of the sheet that moves when its hinge turns. On a book fold the flap is one face; on an accordion the flap of crease 1 is every panel after it. |
| **root face** | The one face of a fold that does not move: the hinge tree's root. For a lift the root is the page. |
| **mountain** | A crease folded away from the viewer, the two faces' fronts opening away from each other. FOLD `M`; fold angle negative. |
| **valley** | A crease folded toward the viewer, the two faces' fronts closing on each other. FOLD `V`; fold angle positive. |
| **assignment** | The letter a crease carries: `M`, `V`, `F` (flat: pre-creased, angle 0 in the closed state) or `U` (unassigned, cannot be posed). FOLD's `edges_assignment`. |
| **fold angle** | The dihedral angle at a crease, in degrees in [-180, 180]: 0 flat, +-180 the faces lying on each other, the sign by the assignment. FOLD's `edges_foldAngle`. |
| **closed state** | The pose a fold waits in before it opens: every crease at its closed angle, the sheet lying as the named fold's folded footprint. What the visitor sees before the block moves. |
| **pose** | Every crease's angle at one instant, and the face transforms that follow from them. The closed state is a pose; the flat sheet is the pose with every angle 0. |
| **schedule** | Per crease, a start, a duration and an easing in units of the global time t in [0, 1]; it turns t into a pose. Simultaneous, sequence and stagger are schedules. |
| **driver** | The code that draws a pose: the CSS driver (DOM, transforms, sheet paint) or the WebGL driver (three.js). Drivers touch the DOM or the GPU; the core never does. |
| **adapter** | A framework binding over a driver: `v-unfold`, `<Unfold>`, `useFold()` for Vue. Adapters sit on drivers, never on each other. |
| **named fold** | A fold the library ships ready to fit to a rectangle, by name: `book`, `lift`, `cupboard`, `blintz`, `diagonal`, `accordion`, `waterbomb`, `preliminary`, `kite`, `fish`. Each has a pattern, a closed state and a default schedule. |
| **base** | Origami's word for a standard folded form that models start from (waterbomb, preliminary, kite, fish, bird, frog). In orkami a base is a named fold whose closed state is that form; the word is kept for the ones origami names. |
| **pattern** | The crease pattern: the sheet's faces and creases with their assignment, flat. FOLD's key frame of class `creasePattern`. |
| **closing crease** | In a fold with an interior vertex, the one crease around the vertex left out of the hinge tree; its angle is solved so the loop of faces closes, not scheduled. |
| **sheet paint** | Painting an element with the host's sheet at the spot the element covers, so a face lying on the page shows the page. The back of a folded block wears it, so the block is invisible until it moves. |
| **back** | The unprinted side of a face: the sheet under it reflected across its crease (sheet paint), shaded by the same light with the normal reversed. Opaque unless the style says the paper is thin. |
| **print** | What is on the front of a face: the block's content and the face's print color (its tone slot's gradient). Print moves with the face and is hidden while the back faces the visitor; it never fades on its own. |
| **reach** | The distance from a crease to the farthest point of its flap, in px. Sets the crease's duration and the shadow's height. |
| **stagger** | A schedule where sibling flaps on the root start one step apart; distinct from an accordion, where panels are a chain. |
| **move** | A fold applied to an already folded pose (reverse fold, squash, petal, rabbit ear, sink): new creases through existing layers, scheduled as one coupled motion. Not a named fold in the first release. |
| **settle** | The last part of a landing: the easing's tail into angle 0, the hairline appearing, the contact shadow returning. No bounce. |
| **hairline** | The 1 px line left on a face along a crease once it is flat. |
| **grain** | The noise tile multiplied over every face: the paper's texture. |
| **style** | The themable look: tones per slot, crease hairline and gradient, grain, shadow stack, edges. `docs/design/02-look.md`. |
| **slot** | A face's print tone class, `lit` or `shade`, alternating across creases along a strip. The style gives each slot its gradient. |
| **light** | The one directional light both drivers share; its direction is fixed in page coordinates. |
