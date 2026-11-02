// orkami/three: the WebGL driver. `buildFold` turns a fold from the core into nested three.js
// groups hinged on its creases; `stage` is the renderer, camera, light and shadow floor that draw
// them, with `play` on requestAnimationFrame. `three` is an optional peer dependency, imported
// at this module's top: a consumer that does not use the driver never imports `orkami/three`.
export { buildFold, grainTexture, parseColor, resources, type BuildOptions, type FoldHandle, type PaintFn, type Palette } from './scene.ts'
export { bleedFor, distanceFor, restingShadow, shadowSoftness, SHADOW_INTENSITY, stage, type Stage, type StageOptions } from './stage.ts'
