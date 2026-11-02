// The build's copy step: tsc emits the TypeScript; this puts beside it what tsc does not
// handle, so the package works from dist/ alone. The single-file components ship as source
// (a consumer's Vue tooling compiles them), with the module shim their types need; the
// stylesheet goes to dist/orkami.css (the `orkami/orkami.css` export) and beside the driver.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to) }

for (const f of readdirSync(join(root, 'src/vue'))) {
  if (f.endsWith('.vue') || f.endsWith('.d.ts')) copy(join(root, 'src/vue', f), join(root, 'dist/vue', f))
}
copy(join(root, 'src/css/orkami.css'), join(root, 'dist/orkami.css'))
copy(join(root, 'src/css/orkami.css'), join(root, 'dist/css/orkami.css'))
