// orkami/vue: the Vue 3 adapter on the drivers. `vUnfold` (the directive), `<Unfold>` (the
// component) and `useFold()` (the handle as refs) on the CSS driver; `<Unfold3D>` on the WebGL
// driver (three.js loaded on its first play, so importing this module never loads it); `<Word>`
// and `<Mark>`, the glyphs drawn flat as SVG; `<FoldLoader>`, paper folding itself until
// the page is ready (D18). `plugin` registers them all. `vue` and `three` are
// optional peer dependencies.
import type { App } from 'vue'
import FoldLoader from './FoldLoader.vue'
import Mark from './Mark.vue'
import Unfold from './Unfold.vue'
import Unfold3D from './Unfold3D.vue'
import Word from './Word.vue'
import { vUnfold } from './unfold.ts'

export { vUnfold, foldFor, handlesOf, openWhenReady, options as unfoldOptions, type Hinge, type FoldSpec, type UnfoldOptions, type UnfoldValue } from './unfold.ts'
export { useFold, type UseFold } from './useFold.ts'
export { loaderPlan, LOADER_MIN_MS, LOADER_SKIP_WITHIN, type LoaderPlan, type LoaderPhase, type LoaderTiming } from './loader.ts'
export { Unfold, Unfold3D, Word, Mark, FoldLoader }

export const plugin = {
  install(app: App) {
    app.directive('unfold', vUnfold)
    app.component('Unfold', Unfold)
    app.component('Unfold3D', Unfold3D)
    app.component('Word', Word)
    app.component('Mark', Mark)
    app.component('FoldLoader', FoldLoader)
  },
}

export default plugin
