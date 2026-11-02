import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, compose, direction, invert, reflect, IDENTITY, type Pt } from '../src/core/affine.ts'

const near = (a: Pt, b: Pt) => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9, `${a} is not ${b}`)

test('reflecting across a crease twice is the identity', () => {
  const r = reflect([3, 1], direction([3, 1], [7, 4]))
  near(apply(compose(r, r), [10, -2]), [10, -2])
})

test('a point on the crease stays where it is', () => {
  const r = reflect([0, 0], direction([0, 0], [1, 1]))
  near(apply(r, [5, 5]), [5, 5])
})

test('a corner folded to the center lands on the center', () => {
  // The blintz: the top-left corner of a 100 x 100 square folds over the crease from
  // (50, 0) to (0, 50) and lands on the center.
  const r = reflect([50, 0], direction([50, 0], [0, 50]))
  near(apply(r, [0, 0]), [50, 50])
})

test('compose applies the right map first', () => {
  const shift: [number, number, number, number, number, number] = [1, 0, 0, 1, 10, 0]
  const flipX: [number, number, number, number, number, number] = [-1, 0, 0, 1, 0, 0]
  near(apply(compose(flipX, shift), [1, 0]), [-11, 0])
  near(apply(compose(shift, flipX), [1, 0]), [9, 0])
  near(apply(IDENTITY, [4, 2]), [4, 2])
})

test('invert undoes a map, and a reflection is its own inverse', () => {
  const m: [number, number, number, number, number, number] = [2, 1, 0.5, 3, 7, -4]
  const back = compose(m, invert(m))
  near(apply(back, [3, 9]), [3, 9])
  near(apply(compose(invert(m), m), [-2, 5]), [-2, 5])
  const r = reflect([3, 1], direction([3, 1], [7, 4]))
  assert.ok(invert(r).every((v, i) => Math.abs(v - r[i]!) < 1e-9))
  assert.throws(() => invert([1, 2, 2, 4, 0, 0]))
})
