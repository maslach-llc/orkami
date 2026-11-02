import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, type Pt } from '../src/core/affine.ts'
import { validate, type Fold } from '../src/core/fold.ts'
import { accordion, blintz, book, cupboard, diagonal, kite, lift, named, preliminary, waterbomb, type NamedFold } from '../src/core/folds/index.ts'
import { flatBack, pose } from '../src/core/pose.ts'
import { isIdentity, transform, type Vec3 } from '../src/core/space.ts'
import { flatFoldable, interiorVertices } from '../src/core/vertex.ts'

type Maker = (w: number, h: number) => Fold

const treeFolds: Record<string, Maker> = {
  'book left': (w, h) => book(w, h, 'left'),
  'book right': (w, h) => book(w, h, 'right'),
  'book top': (w, h) => book(w, h, 'top'),
  'book bottom': (w, h) => book(w, h, 'bottom'),
  'lift top': (w, h) => lift(w, h, 'top'),
  'lift bottom': (w, h) => lift(w, h, 'bottom'),
  'lift left': (w, h) => lift(w, h, 'left'),
  'lift right': (w, h) => lift(w, h, 'right'),
  'cupboard vertical': (w, h) => cupboard(w, h, 'vertical'),
  'cupboard horizontal': (w, h) => cupboard(w, h, 'horizontal'),
  'accordion horizontal 1': (w, h) => accordion(w, h, 1, 'horizontal'),
  'accordion horizontal 3': (w, h) => accordion(w, h, 3, 'horizontal'),
  'accordion vertical 1': (w, h) => accordion(w, h, 1, 'vertical'),
  'accordion vertical 3': (w, h) => accordion(w, h, 3, 'vertical'),
  blintz,
  'diagonal tr': (w, h) => diagonal(w, h, 'tr'),
  'diagonal tl': (w, h) => diagonal(w, h, 'tl'),
  'diagonal br': (w, h) => diagonal(w, h, 'br'),
  'diagonal bl': (w, h) => diagonal(w, h, 'bl'),
  kite,
}
const bases: Record<string, Maker> = { waterbomb, preliminary }
const rectangles: [number, number][] = [[300, 100], [100, 100], [100, 300]]
const names = Object.keys(named) as NamedFold[]
/** Every named fold on a rectangle it accepts (the bases need the square). */
const onSquare = () => names.map(n => [n, named[n](100, 100)] as const)
const range = (step: number) => Array.from({ length: Math.round(1 / step) + 1 }, (_, i) => Math.min(1, i * step))

const near3 = (a: Vec3, b: Vec3, eps: number, what: string) =>
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < eps, `${what}: ${a} is not ${b}`)
const near2 = (a: Pt, b: Pt, eps: number, what: string) =>
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < eps, `${what}: ${a} is not ${b}`)

/** Edge lengths and interior angles of a polygon in space. */
function shape(pts: Vec3[]): { lengths: number[], angles: number[] } {
  const n = pts.length
  const lengths: number[] = [], angles: number[] = []
  for (let i = 0; i < n; i++) {
    const p = pts[(i + n - 1) % n]!, q = pts[i]!, r = pts[(i + 1) % n]!
    const u: Vec3 = [p[0] - q[0], p[1] - q[1], p[2] - q[2]], v: Vec3 = [r[0] - q[0], r[1] - q[1], r[2] - q[2]]
    const lu = Math.hypot(...u), lv = Math.hypot(...v)
    lengths.push(lv)
    angles.push(Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv)))))
  }
  return { lengths, angles }
}

/** Whether p (xy) lies inside the convex polygon, with slack. */
function insideConvex(p: Vec3, poly: Pt[], slack: number): boolean {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!
    s += a[0] * b[1] - b[0] * a[1]
  }
  const orient = Math.sign(s)
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!
    const ex = b[0] - a[0], ey = b[1] - a[1]
    const cross = ex * (p[1] - a[1]) - ey * (p[0] - a[0])
    if (orient * cross < -slack * Math.hypot(ex, ey)) return false
  }
  return true
}

/** The difference between two angles, wrapped to (-pi, pi]: +pi and -pi are the same dihedral. */
const angleDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))

test('every tree fold validates on a wide, a square and a tall rectangle', () => {
  for (const [name, make] of Object.entries(treeFolds)) {
    for (const [w, h] of rectangles) {
      assert.deepEqual(validate(make(w, h)), [], `${name} on ${w}x${h}`)
    }
  }
})

test('the bases validate on a square and refuse a rectangle', () => {
  for (const [name, make] of Object.entries(bases)) {
    assert.deepEqual(validate(make(100, 100)), [], name)
    assert.throws(() => make(300, 100), /needs a square sheet/, name)
  }
})

test('an accordion needs at least one crease', () => {
  assert.throws(() => accordion(100, 100, 0))
  assert.throws(() => accordion(100, 100, 2.5))
})

test('the pose at t = 1 is the flat sheet: every face the identity', () => {
  for (const [name, fold] of onSquare()) {
    const p = pose(fold, 1)
    for (const f of fold.faces) {
      const fp = p.faces[f.id]!
      assert.ok(isIdentity(fp.matrix), `${name} face ${f.id} is not the identity at t = 1`)
      f.pts.forEach((pt, i) => near3(fp.pts[i]!, [pt[0], pt[1], 0], 1e-9, `${name} face ${f.id}`))
    }
  }
})

test('the blintz on a square folds every corner onto the center', () => {
  const p = pose(blintz(100, 100), 0)
  const corners: Record<string, Pt> = { tl: [0, 0], tr: [100, 0], br: [100, 100], bl: [0, 100] }
  for (const [id, c] of Object.entries(corners)) {
    near3(transform(p.faces[id]!.matrix, [c[0], c[1], 0]), [50, 50, 0], 1e-9, `corner ${id}`)
  }
})

test('the blintz on a tall column lands the corners where the reflection puts them, not at the center', () => {
  const p = pose(blintz(100, 300), 0)
  near3(transform(p.faces['tl']!.matrix, [0, 0, 0]), [90, 30, 0], 1e-9, 'top-left corner')
  near3(transform(p.faces['tr']!.matrix, [100, 0, 0]), [10, 30, 0], 1e-9, 'top-right corner')
})

test('the diagonal on a square folds the moving corner onto the opposite corner', () => {
  const p = pose(diagonal(100, 100, 'tr'), 0)
  near3(transform(p.faces['b']!.matrix, [100, 0, 0]), [0, 100, 0], 1e-9, 'corner tr')
  const q = pose(diagonal(100, 100, 'tl'), 0)
  near3(transform(q.faces['b']!.matrix, [0, 0, 0]), [100, 100, 0], 1e-9, 'corner tl')
})

test('the flat back of a blintz corner is the reflection across its crease', () => {
  near2(apply(flatBack(blintz(100, 100), 'c1'), [0, 0]), [50, 50], 1e-9, 'square')
  near2(apply(flatBack(blintz(100, 300), 'c1'), [0, 0]), [90, 30], 1e-9, 'tall column')
})

test('the lift waits mirrored across its hinge edge, flat on the page, back up', () => {
  const p = pose(lift(100, 100, 'top'), 0)
  const block = p.faces['block']!
  for (const [, y, z] of block.pts) {
    assert.ok(Math.abs(z) < 1e-9, `z ${z} is not 0`)
    assert.ok(y >= -100 - 1e-9 && y <= 1e-9, `y ${y} is not above the hinge`)
  }
  near3(block.normal, [0, 0, -1], 1e-9, 'normal')
})

test('faces keep their shape through the whole motion', () => {
  const eps = 1e-8 * 100
  for (const [name, fold] of onSquare()) {
    const flat = Object.fromEntries(fold.faces.map(f => [f.id, shape(f.pts.map(([x, y]) => [x, y, 0] as Vec3))]))
    for (const t of range(0.1)) {
      const p = pose(fold, t)
      for (const f of fold.faces) {
        const s = shape(p.faces[f.id]!.pts), ref = flat[f.id]!
        s.lengths.forEach((l, i) => assert.ok(Math.abs(l - ref.lengths[i]!) < eps, `${name} face ${f.id} edge ${i} at t = ${t}: ${l} vs ${ref.lengths[i]}`))
        s.angles.forEach((a, i) => assert.ok(Math.abs(a - ref.angles[i]!) < eps, `${name} face ${f.id} angle ${i} at t = ${t}: ${a} vs ${ref.angles[i]}`))
      }
    }
  }
})

test('the bases close: the loop around the center meets at the closing crease at every t', () => {
  const size = 100
  const footprint: Record<string, Pt[]> = {
    waterbomb: [[50, 50], [0, 0], [100, 0]],
    preliminary: [[0, 0], [50, 0], [50, 50], [0, 50]],
  }
  for (const [name, make] of Object.entries(bases)) {
    const fold = make(size, size)
    for (const t of range(0.05)) {
      const p = pose(fold, t)
      const viaChild = transform(p.faces['T8']!.matrix, [size, size, 0])
      const viaParent = transform(p.faces['Tr2']!.matrix, [size, size, 0])
      near3(viaChild, viaParent, 1e-7 * size, `${name} at t = ${t}: C through T8 and through Tr2`)
      if (name === 'waterbomb') assert.ok(angleDiff(p.angles['OC']!, p.angles['OB']!) < 1e-9, `${name} at t = ${t}: OC ${p.angles['OC']} is not OB ${p.angles['OB']}`)
      else assert.ok(Math.abs(p.angles['OC']!) < 1e-9, `${name} at t = ${t}: OC ${p.angles['OC']} is not flat`)
    }
    const closed = pose(fold, 0)
    for (const f of fold.faces) {
      for (const v of closed.faces[f.id]!.pts) {
        assert.ok(Math.abs(v[2]) < 1e-7, `${name} face ${f.id} vertex ${v} is not flat when closed`)
        assert.ok(insideConvex(v, footprint[name]!, 1e-7), `${name} face ${f.id} vertex ${v} is outside the closed footprint`)
      }
    }
  }
})

test('Maekawa and Kawasaki hold at every interior vertex of every named fold', () => {
  for (const [name, fold] of onSquare()) assert.deepEqual(flatFoldable(fold), [], name)
  for (const [name, make] of Object.entries(treeFolds)) {
    for (const [w, h] of rectangles) assert.deepEqual(flatFoldable(make(w, h)), [], `${name} on ${w}x${h}`)
  }
})

test('the bases have one interior vertex, the center; the tree folds have none', () => {
  for (const [name, make] of Object.entries(bases)) {
    const vs = interiorVertices(make(100, 100))
    assert.equal(vs.length, 1, name)
    near2(vs[0]!, [50, 50], 1e-9, name)
  }
  for (const [name, make] of Object.entries(treeFolds)) {
    for (const [w, h] of rectangles) assert.deepEqual(interiorVertices(make(w, h)), [], `${name} on ${w}x${h}`)
  }
})

test('a sequenced fold starts its creases in the unfold order, a step apart', () => {
  const orders: [Fold, string[]][] = [
    [cupboard(300, 100), ['c2', 'c1']],
    [cupboard(100, 300, 'horizontal'), ['c2', 'c1']],
    [accordion(100, 300, 3), ['c3', 'c2', 'c1']],
    [blintz(100, 100), ['c4', 'c3', 'c2', 'c1']],
    [kite(100, 100), ['c2', 'c1']],
  ]
  for (const [fold, order] of orders) {
    const starts = order.map(id => fold.schedule!.creases[id]!.start)
    for (let i = 1; i < starts.length; i++) {
      assert.ok(starts[i]! > starts[i - 1]!, `${fold.name}: ${order[i]} starts at ${starts[i]}, not after ${order[i - 1]} at ${starts[i - 1]}`)
    }
  }
})

test('a fold that moves together starts every crease at 0', () => {
  for (const fold of [book(300, 100), lift(300, 100), diagonal(100, 100), waterbomb(100), preliminary(100)]) {
    for (const [id, entry] of Object.entries(fold.schedule!.creases)) assert.equal(entry.start, 0, `${fold.name} ${id}`)
  }
})

test('every named fold is named, says what it suits, and validates on its defaults', () => {
  for (const name of names) {
    const fold = named[name](100, 100)
    assert.equal(fold.name, name)
    assert.ok(fold.suits && fold.suits.length > 0, `${name} suits nothing`)
    assert.deepEqual(validate(fold), [], name)
  }
})
