# API: the WebGL driver

`import { ... } from 'orkami/three'`: a fold from the core as lit paper in three.js. `three` is an
optional peer dependency (`>=0.160`), imported at this module's top, so a consumer that does not
use the driver never imports `orkami/three` and never loads three (the root entry and
`orkami/css` do not import it). Every number comes from the core (`hingeTree`, `hingeAxis`,
`pose`, `stackOrder`, `faceHeight`, `creaseGradient`, `occlusion`, `shadowAt`, the style's
light); the driver builds no hinge of its own and only sets rotations. Nothing touches the DOM at
import time; `buildFold` runs under Node without a WebGL context (the tests do). The choices
behind the camera, the light and the canvas are D14 to D16 in `docs/design/01-decisions.md`.
One line per export; the file each lives in is the heading.

## scene.ts: the fold as groups

- `buildFold(fold, options?)`: the fold as nested `Group`s, one per face, down the hinge tree (D3): each group's origin is its crease's point and its rotation is about the crease's axis from `hingeAxis`, so a crease opening carries every face beyond it. Each sheet face is a flat `ShapeGeometry` of its polygon (sharp, one plane, `flatShading`), a front `Mesh` and a back `Mesh` (its child, `BackSide`) with `MeshLambertMaterial`s; page faces (`face.page`, a lift's or a word's root) get a group and no mesh. Returns a `FoldHandle` at `options.at` (0, closed, by default).
- `BuildOptions`: `style` (overrides or a `Style`), `schedule` (the fold's own, else together), `palette` (a `Palette` over the style's tones, or a `PaintFn`), `layer` (the D12 step in sheet units, 0.5), `creases` (hairlines, on), `shadows` (on), `at`.
- `Palette`: `{ lit?, shade?, back? }`, each a `Tone` or a color string: `lit` for the lit and unslotted faces, `shade` for the shade faces, `back` for every back. `PaintFn`: `(face, side) => Tone | string | Material | undefined`; a `Material` is used as given and never disposed by the handle.
- `FoldHandle`: `fold`, `style`, `schedule`, `root` (the sheet's group, its top left corner at the origin, three's axes: x right, y up), `groups`, `faces` (front meshes), `backs`, `lines` (the hairlines by crease id), `t`, `pose` (the core's, at `t`), `height` (the highest face above the sheet), `set(t)`, `dispose()` (every geometry, material and texture it made; detaches `root`).
- `set(t)`: `pose(fold, t, schedule)`, then per hinged face a quaternion from the crease's axis and angle, the crease occlusion on the side the fold closes on (the front of a valley, the back of a mountain), the hairlines' fade over the last third of t, the D12 layer offset scaled by how closed the crease is (full when closed, where faces stack; none when flat, where they only tile), and the shadows: a face lifted off the sheet casts, a face lying in it does not; only the root face and the floor receive (a blurred map would shade a moving face with its neighbours).
- Axes: the core's page coordinates (y down) are a mirror of three's (y up); a page point `(x, y, z)` is `(x, -y, z)` in the scene and a rotation by a about `(ux, uy, 0)` is a rotation by -a about `(ux, -uy, 0)`. A face's mesh's world matrix carries its flat vertices to `pose()`'s vertices, y flipped (tested for every named fold and the wordmark).
- Paint: the front's vertex colors are the print (the slot's `Tone` from the top of the sheet to the bottom), multiplied by the grain and, on a shade face, the crease gradient; the back's are the style's `back` tone. Lit by the stage's light, the drawn color is the core's `tone()` (the back's `backTone()`).
- `grainTexture(grain, size?)`: the style's grain as a tiling `DataTexture` of fractal value noise (`1 - strength * noise`), built without a DOM; multiplied into every front.
- `parseColor(c)`: `{ rgb, alpha }` from a hex, `rgb()` or `rgba()` color (the style's hairline colors).
- `resources(handle)`: the geometries and materials in a handle's tree, for a test or an inspector.

## stage.ts: renderer, camera, light, floor

- `stage(canvas, options)`: a `WebGLRenderer` on the canvas (alpha, antialias, pixel ratio capped at 2, no tone mapping, no output encoding so a face shows `tone()`), a `PerspectiveCamera` on the sheet's center at `distanceFor(width)` whose view of the sheet plane is the sheet plus the bleed, one `DirectionalLight` from the style's direction at intensity `kd * pi` with an `AmbientLight` at `ka * pi` (three's Lambert divides by pi), a `ShadowMaterial` floor half a unit under the sheet, and a contact-hardening shadow (`contact.ts`, D15): sharp where a flap meets the sheet, softer and paler with the gap, by `penumbra()`. Returns a `Stage`.
- `StageOptions`: `width`, `height` (the sheet), `bleed` (`[x, y]` per side; `bleedFor` gives one), `style`, `perspective`, `pixelRatio`, `shadowMap` (size, 1024), `shadowFilter` (`'soft'`, contact hardening on a plain depth map, the default; or `'pcf'`, one radius from the highest face), `renderer` (draw with your own).
- `Stage`: `renderer`, `scene`, `camera`, `light`, `ambient`, `floor`, `content` (the group the handles hang in, placed so the sheet is centered), `style`, `add(handle)`, `remove(handle)`, `resize(w, h)` (CSS px), `render()`, `play(handle, duration?, onDone?, to?)`, `stop()`, `dispose()` (the renderer it made, the floor, the shadow map; the handles are their own).
- `play(handle, duration = schedule.total, onDone?, to = 1)`: runs the handle's t from where it is to `to` (1 open, 0 closed) over `duration` ms scaled by the distance, calling `set(t)` and `render()` on `requestAnimationFrame` (a timer without a window); the schedule's easing is applied per crease by `pose()`, so the clock is linear in t, as the CSS driver's frame drive. Resolves at the end; under `prefers-reduced-motion: reduce` it jumps.
- `distanceFor(w)`: the camera's distance, 2.2 widths and never under 1000 (02, cue 4), the CSS driver's perspective.
- `bleedFor(fold, { schedule?, perspective?, samples?, style? })`: `[x, y]`, how far past its box the fold reaches through the motion: the poses at `samples + 1` times projected from the camera's distance, and their shadows under the light, plus three standard deviations of the shadow's softness at the highest lift.
- `restingShadow(style)`: the combined opacity of the resting pair (`shadowAt(0)`: contact over ambient), what the floor shows under a full shadow. `SHADOW_INTENSITY` (0.5): how much direct light a shadow takes from a face, so a shadow on a face darkens it as much as the floor's darkens the page; the floor's opacity is `restingShadow / SHADOW_INTENSITY`.
- `shadowSoftness(height, style)`: `penumbra(height).sigma`, the shadow's standard deviation in sheet px a gap of `height` gives. Under `'pcf'`, `render()` sets the light's shadow radius from the highest face; under `'soft'` it sizes the blocker search from it, and each fragment's softness follows its own gap.
- `contactUniforms(style)`, `contactMaterial(material, uniforms)`, `contactChunk()`: the contact-hardening shadow as a patch on a receiving material (the stage applies it to the floor and to each handle's receiving faces): three's basic `getShadow` replaced by a percentage-closer soft shadow (a 16-tap blocker search, a 32-tap filter whose radius follows the gap). `contactChunk` throws when the three.js in use has no basic `getShadow` to replace.

## What differs from the CSS driver

- Tone is exact for nested faces (the CSS driver's is first order for a face hinged on a moving parent, 02 cue 1), and a lit face above k = 1 is the print times k, clamped, as `tone()`, where the CSS overlay mixes toward white.
- A named fold's fronts are the style's print with grain in WebGL; in CSS they show the host's own background (content is the CSS driver's job, D6).
- The shadow is the light's real projection on the floor and on the root under it, sharp at the crease and softening with the gap; the CSS driver draws the same law per flap onto its parent's plane only, so a flap's shadow on the table beyond its parent (a pleat's panel over the floor) is WebGL's alone.
- The hairline color follows the child face's slot (`onLit`, `onShade`), as the flat SVG; the CSS driver draws every crease in `onLit`.
