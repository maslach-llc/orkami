// orkami/vue: the Vue 3 adapter on the drivers. `vUnfold` (the directive), `<Unfold>` (the
// component) and `useFold()` (the handle as refs) on the CSS driver; `<Unfold3D>` on the WebGL
// driver (three.js loaded on its first play, so importing this module never loads it); `<Word>`
// and `<Mark>`, the glyphs drawn flat as SVG. `plugin` registers them all. `vue` and `three` are
// optional peer dependencies.
import type { App } from 'vue'
import Mark from './Mark.vue'
import Unfold from './Unfold.vue'
import Unfold3D from './Unfold3D.vue'
import Word from './Word.vue'
import { vUnfold } from './unfold.ts'

export { vUnfold, foldFor, handlesOf, options as unfoldOptions, type Hinge, type FoldSpec, type UnfoldOptions, type UnfoldValue } from './unfold.ts'
export { useFold, type UseFold } from './useFold.ts'
export { Unfold, Unfold3D, Word, Mark }

export const plugin = {
  install(app: App) {
    app.directive('unfold', vUnfold)
    app.component('Unfold', Unfold)
    app.component('Unfold3D', Unfold3D)
    app.component('Word', Word)
    app.component('Mark', Mark)
  },
}

export default plugin
