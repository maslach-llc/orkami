# API: the CSS driver

`import { ... } from 'orkami/css'` plus the stylesheet `orkami/orkami.css` imported once. A fold
from the core as flaps in the DOM: one `.ori-flap` per non-content face inside the element, nested
by parent down the hinge tree (D3), each a front and a back clipped to the face's polygon
(`clip-path: polygon()`, no radius), the hinge as `transform-origin` and a `rotate3d` axis from
`hingeAxis`, the angle on the registered `--ori-a` property with one transition per flap from
the schedule. Every number comes from the core (`pose`, `flatBack`, `hingeTree`, `stackOrder`,
`shadowAt`, `creaseGradient`); the driver builds no geometry of its own. The module touches no
DOM at import time, so it loads on a server. One line per export; the file each lives in is the
heading.

## driver.ts: mount

- `mount(el, fold | (w, h) => Fold, options?)`: builds the flaps inside `el` (a factory gets `el`'s box) and returns a `Handle`. The element is the host (`.ori-host`); its own content is the print of the content face: the root, or, when the root is the page (a lift), the page's one child, in which case the element itself is the flap (`.ori-lifted`) and turns on the hinge with the vanishing point at its own center. A page with several faces hung on it (a word, `wordFold`, D13) has no content face: every face is a flap of painted paper, no ground is drawn (the page is the ground), and the element's own content (the flat `wordSvg`, say) is what shows at the landing. Mounted closed unless `at` says otherwise; under `prefers-reduced-motion: reduce` mounted landed.
- `MountOptions`: `style` (overrides over the default style, or a `Style`), `schedule` (the fold's own by default, else every crease together), `drive`, `at` (0 closed, 1 flat and landed), `delay` ms before the schedule (a stagger), `sheet` (`true`, `'fixed'`, `'scroll'` or `false`: whether the backs and grounds track the page's sheet), `perspective` px (2.2 times the width, never under 1000).
- `Drive`: `'css' | 'frame' | 'auto'`. Auto is `css` (transitions on `--ori-a`) when the window registers custom properties (`CSS.registerProperty`) and the fold has no closure, else `frame` (a `requestAnimationFrame` loop writing every angle from `pose`). The shadows are painted from the pose on every frame in both drives.
- `Handle`: `el`, `fold`, `style`, `schedule`, `drive` (the one in use), `t` (0 closed to 1 flat), `state` (`'closed' | 'opening' | 'open' | 'closing' | 'still'`), `open()` (resolves at the landing), `close()` (the schedule reversed; resolves when closed), `set(t)` (no motion: a slider, a scroll, a loop with its own clock; the state becomes `still`), `destroy()` (the element as it was), `landed` (resolves the first time the paper lies flat).
- `State`: the five states above.
- `grainUrl(grain, strength?)`: the style's grain as a `data:` SVG url (fractal noise at that alpha).
- `sidePolygon(fold, faceId, back?)`: the face's polygon in host px, mirrored for the back (the side's box is its bounds; its clip-path is this less the box's offset).
- `fits(el, fold, tol?)`: whether the fold's sheet is the element's box.

What the DOM looks like while folded, all inside one `.ori-fold` layer (`position: absolute; inset: 0; pointer-events: none`) the driver appends to the host:

- `.ori-ground.ori-paper` per non-content face and a `.ori-root` for the content face: the sheet where a face is not yet, and the host's background standing for the content. The host's own background is set transparent inline and its children `visibility: hidden` until `.is-landed`, so the only paint is the paper (the seams of a closed block are invisible against the sheet).
- `.ori-flap` with `--ori-ux/--ori-uy` (the hinge axis), `--ori-step` (the face's layer from `stackOrder`, a `translateZ` epsilon that keeps coplanar faces apart, D12), `--ori-start/--ori-end/--ori-dur` from the schedule; inside it `.ori-side.front` (the host's background, or the slot's tone for a glyph), `.ori-side.back` (`rotateY(180deg)` about the sheet's vertical midline, the sheet under `compose(mirrorX, invert(flatBack))` in an `.ori-ink.ori-paper` child, so a folded block is the background until it moves), each side a box the size of its face's bounds clipped to the face in its own px, its paint on a sheet-sized `.ori-face` inside shifted back into the sheet's frame (a sheet-sized side clipped far from its origin is culled by Chromium's software compositor), two `.ori-shadow` layers (contact and ambient, counter-rotated into the parent's plane, clipped to the posed outline, blurred and offset by `shadowAt(faceHeight)`), and the child flaps.
- `.ori-creases`: an SVG of hairlines over the whole box, fading in over the last third of the motion and shown at rest.
- Tone is CSS: `--ori-ln` is L . N of a flap from its angle, `--ori-k` the Lambert factor; each side's `::after` darkens (black at `1 - k`) or lightens (white at `k - 1`) it and carries the crease's occlusion gradient on the inside of the fold (the front of a valley, the back of a mountain). The light, the ambient and diffuse factors and the occlusion are written on the host from the style.
- Landed (`.is-landed`), the flaps, grounds and shadows hide and the element's own content shows flat with the creases over it; `.is-open` runs the forward delays, `.ori-scrub` turns the transitions off for `set(t)`.
- Rule: the host must not clip. `overflow` other than `visible` on it clips the paper swinging past its box; put the clip on a wrapper outside or on the content inside.
- Shadow at rest: a face lying in the sheet casts nothing; the stack from `shadowAt(0)` comes in over the first `contact.fade` px of lift (`opacity * min(1, h / fade)`), since a flap folded flat against the page is part of the page, not a card on it. Doc 02's resting stack is for a painted glyph standing on the sheet.

## sheet.ts: the page's paper

- `paintSheet(sheet?, { mode, document }?)`: registers the page's sheet on `<html>`: `--ori-sheet` (the image, `none` for a plain color), `--ori-paper` (the color under it), `--ori-vw/--ori-vh` (the size the fixed sheet is drawn at). No argument: the folded example sheet in the page's own tokens (`--ori-bg`, `--ori-ink`, `--ori-accent`); call it again after the tokens change (a theme toggle).
- `SheetSpec`: `{ svg }`, `{ image }` (a CSS image value), `{ color }`, or a color string; each with an optional `color` under it. `SheetMode`: `'fixed'` (drawn at the viewport and fixed to it, the default) or `'scroll'` (scrolls with the document). `PaintOptions`: `{ mode?, document? }`.
- `trackSheet(el, mode?)`: keeps `--ori-sx/--ori-sy` on `el` pointed at the paper under it (on scroll and resize for a fixed sheet, once for a scrolling one); returns the untrack function. `measureSheet()`: re-reads every tracked element's position after a layout change.
- `paintOffset(x, y, scrollX, scrollY, mode)`: the pure math: the background position that shows the page's paper under a box at `(x, y)` in the viewport.
- `resolveSheet(spec, colors)`: `{ image, color }` as CSS values. `pageColors(root)`: the three tokens read from `<html>` with the light defaults as fallback.
- The CSS that wears the variables is `.ori-paper` in orkami.css; a page's `body` can wear the same stack (`--ori-grain-soft`, `--ori-sheet` at `--ori-vw x --ori-vh` fixed, `--ori-paper`) so the flaps and the page are one sheet.

## sheets/folded.ts: the example sheet

- `FOLDED_W` 1600, `FOLDED_H` 1000; `FOLDED_FACETS` (seven facets, keys into the point table), `foldedPolys` (with their points), `foldedCreases` (the ten interior edges), `FOLDED_TONES` (each tone's mix into light, dark or the accent, in percent), `FOLDED_CREASE_INK` .06.
- `FoldedColors`: `{ bg, ink, accent }` hex. `FoldedTone`: `'l1' | 'l2' | 's1' | 's2' | 'b'`.
- `mixHex(a, b, pctA)`: a linear mix of two hex colors. `foldedToneColor(tone, colors)`: the facet's color. `foldedSheetSvg(colors)`: the SVG document, `xMidYMid slice`, every facet within four lightness points of the page color.

## orkami.css

The tokens (`--ori-bg`, `--ori-ink`, `--ori-accent`, `--ori-paper`, `--ori-ease`, `--ori-layer`, `--ori-ply`, the light, the grain), `@property --ori-a` (an inherited `<angle>`), and the rules the driver's classes rely on, in six numbered sections in the file's header. Import it once; the driver sets the classes and the custom properties. Under `prefers-reduced-motion: reduce` and in print the flaps, grounds and shadows are hidden and the content shows flat from the start.
