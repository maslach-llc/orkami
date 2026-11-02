import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertValid, type Fold } from '../src/core/fold.ts'
import { toFOLD } from '../src/core/fold-format.ts'
import { accordion, blintz, book, cupboard, diagonal, lift, named, type NamedFold } from '../src/core/folds/index.ts'
import { stackOrder } from '../src/core/stack.ts'

const names = Object.keys(named) as NamedFold[]

test('a flap closing at pi lies over its parent: layer 1 on the root', () => {
  assert.deepEqual(stackOrder(blintz(100, 100)).layer, { c: 0, tl: 1, tr: 1, br: 1, bl: 1 })
  assert.deepEqual(stackOrder(book(100, 100)).layer, { a: 0, b: 1 })
  assert.deepEqual(stackOrder(diagonal(100, 100)).layer, { a: 0, b: 1 })
  assert.deepEqual(stackOrder(cupboard(200, 100)).layer, { c: 0, l: 1, r: 1 })
  assert.deepEqual(stackOrder(lift(100, 100)).layer, { page: 0, block: 1 })
  assert.deepEqual(stackOrder(blintz(100, 100)).step, { c1: 1, c2: 1, c3: 1, c4: 1 })
})

test('a pleat stacks one panel on the next: a mountain under a face that lies face down is over it', () => {
  const s = stackOrder(accordion(100, 600, 5))
  assert.deepEqual(s.layer, { p0: 0, p1: 1, p2: 2, p3: 3, p4: 4, p5: 5 })
  assert.deepEqual(s.up, { p0: 1, p1: -1, p2: 1, p3: -1, p4: 1, p5: -1 })
  assert.deepEqual(s.step, { c1: 1, c2: -1, c3: 1, c4: -1, c5: 1 })
})

test('a mountain on the root goes under it, and a crease that does not close flat does not stack', () => {
  const strip = (assignment: 'M' | 'V', closed: number): Fold => assertValid({
    sheet: { width: 100, height: 200 },
    faces: [
      { id: 'p0', pts: [[0, 0], [100, 0], [100, 100], [0, 100]] },
      { id: 'p1', pts: [[0, 100], [100, 100], [100, 200], [0, 200]] },
    ],
    creases: [{ id: 'c1', a: [0, 100], b: [100, 100], assignment, parent: 'p0', child: 'p1', closed }],
    root: 'p0',
  })
  assert.deepEqual(stackOrder(strip('M', Math.PI)).layer, { p0: 0, p1: -1 })
  assert.deepEqual(stackOrder(strip('M', Math.PI)).up, { p0: 1, p1: -1 })
  const standing = stackOrder(strip('V', Math.PI / 2))
  assert.deepEqual(standing.layer, { p0: 0, p1: 0 })
  assert.deepEqual(standing.up, { p0: 1, p1: 1 })
  assert.deepEqual(standing.step, { c1: 0 })
})

test('the layers agree with the faceOrders toFOLD writes, for every named fold', () => {
  for (const n of names) {
    const fold = named[n](100, 100)
    const s = stackOrder(fold)
    const file = toFOLD(fold)
    for (const [f, g, order] of file.faceOrders!) {
      const child = fold.faces[f]!.id, parent = fold.faces[g]!.id
      assert.equal((s.layer[child]! - s.layer[parent]!) * s.up[parent]!, order, `${n}: ${child} over ${parent}`)
    }
    for (const f of fold.faces) assert.ok(Number.isInteger(s.layer[f.id]), `${n}: ${f.id} has a layer`)
  }
})
