# orkami™

Origami for the web. A block of a page lies folded in its background as a shape of paper and
unfolds out of it when it is needed, the way real paper does: faces turn on the creases they
share, the backs show the sheet they were folded over, one light shades every face. The core is
plain geometry with no dependency and no DOM; a CSS driver and a WebGL driver draw the same fold,
and a Vue adapter puts it on a page in one attribute.

**The paper rule.** Every motion orkami makes is one a sheet of paper can make: a face turns about
a crease it shares with its parent and never changes shape. Nothing scales, slides, flies or fades
in place of folding; a fold that would tear the sheet is refused, not drawn.

```bash
npm install github:maslach-llc/orkami#v0.1.0
```

`vue` and `three` are optional peers: install them only for the entries that use them.

## The core: `orkami`

```ts
import { blintz, pose, toFOLD } from 'orkami'

const fold = blintz(300, 300)        // the four corners folded to the center
const half = pose(fold, 0.5)         // every face's transform halfway open
for (const f of Object.values(half.faces)) {
  console.log(f.id, f.normal)        // and its normal, for your own renderer
}
console.log(half.angles)             // every crease's angle, valley positive
const file = toFOLD(fold)            // the crease pattern as a FOLD 1.2 file
```

## The CSS driver: `orkami/css`

```ts
import { blintz } from 'orkami'
import { mount, paintSheet } from 'orkami/css'
import 'orkami/orkami.css'

paintSheet()                                        // the page's paper, from the --ori-* tokens
const el = document.querySelector<HTMLElement>('.card')!
const handle = mount(el, (w, h) => blintz(w, h))   // lies folded, closed
await handle.open()                                 // unfolds and lands flat
handle.set(0.4)                                     // or scrub it by hand
```

## The Vue adapter: `orkami/vue`

```ts
// main.ts
import { createApp } from 'vue'
import { plugin } from 'orkami/vue'
import 'orkami/orkami.css'
import App from './App.vue'
createApp(App).use(plugin).mount('#app')
```

```vue
<section v-unfold="'cupboard'">Unfolds as it scrolls into view</section>
<Unfold fold="blintz" :open="ready"><Card /></Unfold>
<Unfold3D fold="MASLACH" />   <!-- the wordmark as lit paper in WebGL -->
```

## The WebGL driver: `orkami/three`

```ts
import { waterbomb } from 'orkami'
import { buildFold, stage } from 'orkami/three'

const fold = waterbomb(320, 320)
const canvas = document.querySelector('canvas')!
const s = stage(canvas, { width: 320, height: 320 })
const handle = buildFold(fold)       // nested groups hinged on the creases, closed
s.add(handle)
s.resize(480, 480)
await s.play(handle)                 // lit, shadowed, landing flat
```

## The named folds

| fold | what it is | suits |
|---|---|---|
| `book` | one panel folded over the other along the midline | wide, tall, square |
| `lift` | the block folded over one edge onto the page | wide, square, tall, list |
| `cupboard` | two doors folded in to a center line | wide (vertical), tall (horizontal) |
| `accordion` | a pleat of n panels, alternating | list, tall (horizontal); wide (vertical) |
| `blintz` | the four corners folded to the center | square |
| `diagonal` | one corner folded over the diagonal | square |
| `kite` | two edges folded to the diagonal | square |
| `waterbomb` | the base: diagonals valley, midlines mountain (seen from the side that faces you), closed by a solver | square |
| `preliminary` | the base: midlines valley, diagonals mountain (seen from the side that faces you), closed by a solver | square |

A fold built for a rectangle it does not suit still folds honestly; the two bases refuse a
rectangle, since their pattern cannot close on one. The wordmark glyphs (`wordFold`, `wordSvg`)
are letters built as folds.

## Look at it

The playground shows every named fold at three shapes, a fold under a `t` slider with its crease
angles, a mock page folded block by block, the wordmark in both drivers, and the house-look check:

```bash
npm install
npm run play          # http://localhost:5173
```

## Read more

- [`docs/api/`](docs/api/index.md): the API, entry by entry.
- [`docs/study/`](docs/study/): how paper folds, what reads as paper on a screen, what exists already.
- [`docs/design/`](docs/design/): the vocabulary, the decisions (D1 to D16) and the house look.
- [`CHANGELOG.md`](CHANGELOG.md).

## Contributing a named fold

Draw it first. A new fold starts as a section in `docs/study/01-how-paper-folds.md`: its crease
pattern (ASCII or SVG) with mountains and valleys, its closed state, which side shows, its fold
and unfold order, and the rectangles it suits. Then the code in `src/core/folds/`, a test that it
validates, passes Maekawa and Kawasaki at every interior vertex and lands flat at `t = 1`, and a
line in `docs/api/core.md`, in the same commit.

```bash
npm run verify        # typecheck, tests, build, release check
```

Node 24 or newer (the tests are TypeScript run by `node --test`).

## Who wrote this

Parts of this library were written with the help of a superintelligence. Or at least something
that types faster than we do and never needs coffee. A human steered it, tested it and answers
the issues, so the bugs are a joint effort.

MIT for the code, © 2026 Maslach LLC. Maslach and the Maslach logo are trademarks of Maslach LLC;
see [`NOTICE.md`](NOTICE.md).
