// orkami/vue: the Vue 3 adapter on the CSS driver. `vUnfold` (the directive), `<Unfold>` (the
// component), `useFold()` (the handle as refs), and `plugin`, which registers the directive as
// `v-unfold` and the component as `<Unfold>`. `vue` is an optional peer dependency.
import type { App } from 'vue'
import Unfold from './Unfold.vue'
import { vUnfold } from './unfold.ts'

export { vUnfold, foldFor, handlesOf, options as unfoldOptions, type Hinge, type FoldSpec, type UnfoldOptions, type UnfoldValue } from './unfold.ts'
export { useFold, type UseFold } from './useFold.ts'
export { Unfold }

export const plugin = {
  install(app: App) {
    app.directive('unfold', vUnfold)
    app.component('Unfold', Unfold)
  },
}

export default plugin
