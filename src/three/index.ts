// orkami/three: the WebGL driver. `buildFold` turns a fold from the core into nested three.js
// groups hinged on its creases, `buildModel` the same for a model folded in steps; `stage` is
// the renderer, camera, light and shadow floor that draw them, with `play` on
// requestAnimationFrame. `three` is an optional peer dependency, imported at this module's top:
// a consumer that does not use the driver never imports `orkami/three`.
export { buildFold, buildModel, grainTexture, parseColor, resources, type BuildOptions, type FoldHandle, type ModelBuildOptions, type ModelHandle, type PaintFn, type Palette, type TexturePrint } from './scene.ts'
export { bleedFor, distanceFor, restingShadow, shadowSoftness, SHADOW_INTENSITY, stage, type Stage, type StageLoop, type StageLoopOptions, type StageModel, type StageModelOptions, type StageOptions } from './stage.ts'
export { contactChunk, contactMaterial, contactUniforms, type ContactUniforms } from './contact.ts'
export { cssColor, resolvePalette, resolveStyle } from './resolve.ts'
