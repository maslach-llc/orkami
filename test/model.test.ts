import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, type Pt } from '../src/core/affine.ts'
import { validate, assertValid, area, overlaps, type Fold } from '../src/core/fold.ts'
import { hingeTree, flap, reach } from '../src/core/tree.ts'
import { cubicBezier, paper, creaseDuration, together, sequence, stepwise, angleAt, progress } from '../src/core/schedule.ts'
import { pose, poseAngles, flatBack, hingeAxis, closedPose } from '../src/core/pose.ts'
import { lambert, shade, faceNormal, LIGHT } from '../src/core/light.ts'
import { isIdentity, multiply, rotation, transform, IDENTITY4 } from '../src/core/space.ts'

const near = (a: number, b: number, eps = 1e-9, msg?: string) => assert.ok(Math.abs(a - b) < eps, msg ?? `${a} is not ${b}`)
const near3 = (a: readonly number[], b: readonly number[], eps = 1e-9) => assert.ok(Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, (a[2] ?? 0) - (b[2] ?? 0)) < eps, `${a} is not ${b}`)

// A 200 x 100 book fold: the right half folds over the left on a valley at x = 100.
const W = 200, H = 100
const book = (): Fold => ({
  sheet: { width: W, height: H },
  root: 'a',
  faces: [{ id: 'a', pts: [[0, 0], [W / 2, 0], [W / 2, H], [0, H]] }, { id: 'b', pts: [[W / 2, 0], [W, 0], [W, H], [W / 2, H]] }],
  creases: [{ id: 'c1', a: [W / 2, 0], b: [W / 2, H], assignment: 'V', parent: 'a', child: 'b', closed: Math.PI }],
})

// A chain of three panels: an accordion of two creases, V then M.
const chain = (): Fold => ({
  sheet: { width: 90, height: 30 },
  root: 'p0',
  faces: [
    { id: 'p0', pts: [[0, 0], [30, 0], [30, 30], [0, 30]] },
    { id: 'p1', pts: [[30, 0], [60, 0], [60, 30], [30, 30]] },
    { id: 'p2', pts: [[60, 0], [90, 0], [90, 30], [60, 30]] },
  ],
  creases: [
    { id: 'c1', a: [30, 0], b: [30, 30], assignment: 'V', parent: 'p0', child: 'p1', closed: Math.PI },
    { id: 'c2', a: [60, 0], b: [60, 30], assignment: 'M', parent: 'p1', child: 'p2', closed: Math.PI },
  ],
})

test('a sound fold validates with no problems', () => {
  assert.deepEqual(validate(book()), [])
  assert.deepEqual(validate(chain()), [])
  assert.equal(assertValid(book()).root, 'a')
})

test('validate rejects a crease that is not on the edge both faces share', () => {
  const f = book()
  f.creases[0]!.a = [90, 0]
  const problems = validate(f)
  assert.ok(problems.some(p => p.includes('not on an edge')), problems.join('; '))
  assert.throws(() => assertValid(f), /invalid fold/)
})

test('validate rejects a cycle and a face hung on two creases', () => {
  const f = chain()
  f.creases.push({ id: 'c3', a: [30, 0], b: [30, 30], assignment: 'V', parent: 'p2', child: 'p0', closed: Math.PI })
  const problems = validate(f)
  assert.ok(problems.some(p => p.includes('hinges the root') || p.includes('cycle')), problems.join('; '))
  const g = chain()
  g.creases.push({ id: 'c3', a: [60, 0], b: [60, 30], assignment: 'V', parent: 'p0', child: 'p2', closed: Math.PI })
  assert.ok(validate(g).some(p => p.includes('hangs on two creases')))
})

test('validate rejects a face the root cannot reach, overlapping faces and a sheet left uncovered', () => {
  const f = book()
  f.creases = []
  assert.ok(validate(f).some(p => p.includes('not reachable')))
  const g = book()
  g.faces[1]!.pts = [[50, 0], [W, 0], [W, H], [50, H]]
  const problems = validate(g)
  assert.ok(problems.some(p => p.includes('overlap')), problems.join('; '))
  const h = book()
  h.faces[1]!.pts = [[W / 2, 0], [150, 0], [150, H], [W / 2, H]]
  assert.ok(validate(h).some(p => p.includes('cover')))
  const cut = book()
  cut.sheet.cut = true
  cut.faces[1]!.pts = [[W / 2, 0], [150, 0], [150, H], [W / 2, H]]
  assert.deepEqual(validate(cut), [])
})

test('validate rejects a flat crease that closes and a closing crease without a closure', () => {
  const f = book()
  f.creases[0]!.assignment = 'F'
  assert.ok(validate(f).some(p => p.includes('flat but closes')))
  const g = chain()
  g.creases[1]!.closing = true
  assert.ok(validate(g).some(p => p.includes('no closure')))
})

test('polygon helpers: area, overlap of touching and crossing squares', () => {
  near(Math.abs(area([[0, 0], [10, 0], [10, 10], [0, 10]])), 100)
  const sq = (x: number): Pt[] => [[x, 0], [x + 10, 0], [x + 10, 10], [x, 10]]
  assert.equal(overlaps(sq(0), sq(10), 1e-9), false)
  assert.equal(overlaps(sq(0), sq(5), 1e-9), true)
})

test('the hinge tree is parent first with the chain of creases to each face', () => {
  const t = hingeTree(chain())
  assert.deepEqual(t.order, ['p0', 'p1', 'p2'])
  assert.deepEqual(t.chain, { p0: [], p1: ['c1'], p2: ['c1', 'c2'] })
  assert.deepEqual(t.parent, { p0: null, p1: 'p0', p2: 'p1' })
  assert.deepEqual(t.hinge, { p0: null, p1: 'c1', p2: 'c2' })
  assert.deepEqual(t.children, { p0: ['c1'], p1: ['c2'], p2: [] })
})

test('a flap is the child and everything hinged beyond it; reach is its farthest point from the crease', () => {
  const f = chain()
  assert.deepEqual(flap(f, 'c1'), ['p1', 'p2'])
  assert.deepEqual(flap(f, 'c2'), ['p2'])
  near(reach(f, 'c1'), 60)
  near(reach(f, 'c2'), 30)
  near(reach(book(), 'c1'), 100)
})

test('the paper easing is the seed bezier: 0 at 0, 1 at 1, inside [0, 1], decelerating with no overshoot', () => {
  assert.equal(paper(0), 0)
  assert.equal(paper(1), 1)
  assert.equal(paper(-1), 0)
  assert.equal(paper(2), 1)
  let last = 0
  for (let i = 1; i <= 100; i++) {
    const y = paper(i / 100)
    assert.ok(y >= last && y <= 1 + 1e-12, `not monotonic at ${i / 100}`)
    last = y
  }
  // A fast start: half way through, well past half the angle; the last third takes the last tenth
  assert.ok(paper(0.5) > 0.85, `${paper(0.5)}`)
  assert.ok(paper(2 / 3) > 0.9)
  const linear = cubicBezier(0, 0, 1, 1)
  near(linear(0.3), 0.3, 1e-6)
})

test('a crease duration scales with the square root of its reach, clamped', () => {
  near(creaseDuration(240), 640)
  // The study's prose says 320 ms for a 60 px edge, but its clamp at 0.6 gives 384: the formula wins
  near(creaseDuration(60), 384)
  near(creaseDuration(600), 640 * Math.sqrt(2.5))
  near(creaseDuration(1), 640 * 0.6)
  near(creaseDuration(1e6), 640 * 1.6)
})

test('together starts every crease at 0 and keeps the longest one as the total', () => {
  const s = together(chain())
  assert.equal(s.creases.c1!.start, 0)
  assert.equal(s.creases.c2!.start, 0)
  near(s.creases.c1!.duration, 1)
  near(s.total, creaseDuration(60))
  near(s.creases.c2!.duration, creaseDuration(30) / creaseDuration(60))
})

test('a sequence starts creases one step apart in the given order and overlaps them', () => {
  const s = sequence(chain(), ['c2', 'c1'], { step: 100 })
  near(s.creases.c2!.start, 0)
  near(s.creases.c1!.start * s.total, 100)
  near(s.total, 100 + creaseDuration(60))
  assert.ok(s.creases.c1!.start < s.creases.c2!.start + s.creases.c2!.duration, 'the second starts before the first ends')
  assert.throws(() => sequence(chain(), ['nope']), /no tree crease/)
})

test('a stepwise schedule never moves a crease before the one before it has finished', () => {
  const f = chain()
  const s = stepwise(f, ['c2', 'c1'], { gap: 10 })
  const end2 = s.creases.c2!.start + s.creases.c2!.duration
  assert.ok(s.creases.c1!.start >= end2 - 1e-12)
  near((s.creases.c1!.start - end2) * s.total, 10)
  for (const t of [0, 0.1, 0.2, 0.3]) {
    if (t <= end2) near(angleAt(f, 'c1', s, t), angleAt(f, 'c1', s, 0))
  }
  near(s.creases.c1!.start + s.creases.c1!.duration, 1)
})

test('the angle at t is the closed angle times one minus the eased progress, valley positive, mountain negative', () => {
  const f = chain()
  const s = together(f)
  near(angleAt(f, 'c1', s, 0), Math.PI)
  near(angleAt(f, 'c2', s, 0), -Math.PI)
  near(angleAt(f, 'c1', s, 1), 0)
  near(angleAt(f, 'c1', s, 0.5), Math.PI * (1 - paper(0.5)))
  near(progress({ start: 0.5, duration: 0.5 }, 0.25), 0)
  near(progress({ start: 0.5, duration: 0.5 }, 0.75), paper(0.5))
  near(progress({ start: 0.5, duration: 0 }, 0.75), 1)
})

test('a valley lifts the child toward the visitor and lands it flat over the parent', () => {
  const f = book()
  const half = pose(f, 0.5)
  const far = half.faces.b!.pts[1]!
  assert.ok(far[2] > 0, 'the far edge rises toward +z')
  assert.ok(far[0] < W, 'and comes back over the sheet')
  const closed = closedPose(f)
  near3(closed.faces.b!.pts[1]!, [0, 0, 0])
  near3(closed.faces.b!.pts[2]!, [0, H, 0])
  near3(closed.faces.b!.normal, [0, 0, -1])
  near(closed.angles.c1!, Math.PI)
  const mountain = book()
  mountain.creases[0]!.assignment = 'M'
  assert.ok(pose(mountain, 0.5).faces.b!.pts[1]![2]! < 0, 'a mountain turns the child away')
  near(pose(mountain, 0).angles.c1!, -Math.PI)
})

test('t = 1 is the flat sheet: the identity for every face', () => {
  for (const f of [book(), chain()]) {
    const p = pose(f, 1)
    for (const face of f.faces) {
      assert.ok(isIdentity(p.faces[face.id]!.matrix))
      face.pts.forEach((pt, i) => near3(p.faces[face.id]!.pts[i]!, [pt[0], pt[1], 0]))
      near3(p.faces[face.id]!.normal, [0, 0, 1])
    }
    assert.equal(p.t, 1)
  }
})

test('a nested face composes its parent hinge with its own, and the chain lists both', () => {
  const f = chain()
  const p = poseAngles(f, { c1: Math.PI / 2, c2: -Math.PI / 2 })
  assert.equal(p.faces.p2!.chain.length, 2)
  near(p.faces.p2!.chain[0]!.angle, Math.PI / 2)
  near(p.faces.p2!.chain[1]!.angle, -Math.PI / 2)
  // p1 stands up on c1; p2 folds back the other way on c2 and lies flat again, 30 above the sheet
  near3(p.faces.p1!.pts[1]!, [30, 0, 30])
  near3(p.faces.p2!.pts[1]!, [60, 0, 30])
  near3(p.faces.p2!.normal, [0, 0, 1])
  // the hinge in the chain is the crease in the parent's flat frame
  near3(p.faces.p2!.chain[1]!.axisPoint, [60, 0, 0])
  near(Math.abs(p.faces.p2!.chain[1]!.axisDir[1]!), 1)
  // the matrix is the product of the chain's rotations
  const m = multiply(rotation([30, 0, 0], hingeAxis(f, f.creases[0]!).dir, Math.PI / 2), rotation([60, 0, 0], hingeAxis(f, f.creases[1]!).dir, -Math.PI / 2))
  m.forEach((v, i) => near(v, p.faces.p2!.matrix[i]!))
  near3(transform(IDENTITY4, [1, 2, 3]), [1, 2, 3])
})

test('faces keep their shape at every t', () => {
  const f = chain()
  for (let i = 0; i <= 10; i++) {
    const p = pose(f, i / 10)
    for (const face of f.faces) {
      const pts = p.faces[face.id]!.pts
      for (let k = 0; k < pts.length; k++) {
        const a = face.pts[k]!, b = face.pts[(k + 1) % pts.length]!
        const flat = Math.hypot(b[0] - a[0], b[1] - a[1])
        const posed = Math.hypot(...([0, 1, 2] as const).map(j => pts[(k + 1) % pts.length]![j] - pts[k]![j]) as [number, number, number])
        near(posed, flat, 1e-9, `edge ${k} of ${face.id} at t = ${i / 10}`)
      }
    }
  }
})

test('flatBack reflects across the crease and composes down the tree', () => {
  near3(apply(flatBack(book(), 'c1'), [W, 0]), [0, 0])
  near3(apply(flatBack(book(), 'c1'), [W / 2, 50]), [W / 2, 50])
  // p2 folded over c2 lands on p1 (90 -> 30); p1 folded over c1 lands on p0 (30 -> 30): the far corner ends on c1
  near3(apply(flatBack(chain(), 'c2'), [90, 0]), [30, 0])
  near3(apply(flatBack(chain(), 'c2'), [60, 0]), [0, 0])
})

test('Lambert: the flat face, the edge-on face and the face toward the light', () => {
  near(lambert([0, 0, 1]), 0.769, 1e-3)
  near(shade([0, 0, 1]), 0.35 + 0.85 * 0.769, 1e-3)
  near(shade([0, 0, -1]), 0.35)
  near(shade(LIGHT), 1.2)
  // a face hinged on a vertical crease, turned 90 degrees: its normal is (1, 0, 0) or (-1, 0, 0)
  near(shade([1, 0, 0]), 0.35)
  near(shade([-1, 0, 0]), 0.35 + 0.85 * 0.346, 1e-3)
  near(shade([0, -1, 0]), 0.35 + 0.85 * 0.538, 1e-3)
  near(shade([0, 0, 1], LIGHT, 0.3, 1.0), 0.3 + 0.769, 1e-3)
})

test('a face normal is (0, 0, 1) when flat whatever the winding, and follows the pose', () => {
  near3(faceNormal([[0, 0], [10, 0], [10, 10]]), [0, 0, 1])
  near3(faceNormal([[0, 0], [10, 10], [10, 0]]), [0, 0, 1])
  const f = book()
  const p = poseAngles(f, { c1: Math.PI / 2 })
  near3(p.faces.b!.normal, [-1, 0, 0])
  near(shade(p.faces.b!.normal), 0.35 + 0.85 * 0.346, 1e-3)
})
