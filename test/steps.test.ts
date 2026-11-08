// Models folded in steps (D19, doc 09): one crease pattern, steps naming crease targets, time s
// from the flat sheet (0) to the finished model (steps.length).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { treeCreases, type Fold } from '../src/core/fold.ts'
import { poseAngles, pose } from '../src/core/pose.ts'
import { model, modelPose, modelAngles, modelStack, keyFold, keyAt, creasesMade, jointGap, stepAt, modelDuration, modelTime, type Model } from '../src/core/model.ts'
import { preliminaryKite, preliminaryKitePattern, preliminaryKiteSteps, models } from '../src/core/models/index.ts'
import { preliminary } from '../src/core/folds/preliminary.ts'
import { stackOrder } from '../src/core/stack.ts'
import { flatFoldable } from '../src/core/vertex.ts'
import { modelToFOLD, modelFromFOLD } from '../src/core/fold-format.ts'
import { hingeTree } from '../src/core/tree.ts'
import type { Vec3 } from '../src/core/space.ts'

const SIZE = 240
const m = preliminaryKite(SIZE)
const n = m.steps.length
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const samples = (k: number) => Array.from({ length: k * n + 1 }, (_, i) => i / k)

test('the first model is the preliminary base and two kite folds, through the named library', () => {
  assert.equal(n, 3)
  assert.deepEqual(m.steps.map(s => s.name), ['collapse to the preliminary base', 'kite fold, right', 'kite fold, left'])
  assert.equal(models.preliminaryKite(100).sheet.width, 100)
  for (const s of m.steps) assert.ok(s.duration > 0)
})

test('s = 0 is the flat sheet: every face where it lies in the pattern', () => {
  const p = modelPose(m, 0)
  for (const f of m.faces) for (const q of p.faces[f.id]!.pts) assert.ok(Math.abs(q[2]) < 1e-9)
  for (const a of Object.values(p.angles)) assert.ok(Math.abs(a) < 1e-9)
})

test('modelPose at a keyframe is the pose of the steps\' accumulated angles', () => {
  const tree = hingeTree(m)
  for (let k = 0; k <= n; k++) {
    const acc: Record<string, number> = {}
    for (const c of m.creases) acc[c.id] = 0
    for (let i = 0; i < k; i++) Object.assign(acc, m.steps[i]!.moves)
    const ours = modelPose(m, k)
    const theirs = poseAngles(m, acc, tree)
    for (const f of m.faces) for (let i = 0; i < f.pts.length; i++) assert.ok(dist(ours.faces[f.id]!.pts[i]!, theirs.faces[f.id]!.pts[i]!) < 1e-6, `face ${f.id} at keyframe ${k}`)
  }
})

test('each step starts where the last stopped: the pose is continuous across every step boundary', () => {
  const eps = 1e-6
  for (let k = 1; k < n; k++) {
    const a = modelPose(m, k - eps), b = modelPose(m, k + eps), at = modelPose(m, k)
    for (const f of m.faces) {
      for (let i = 0; i < f.pts.length; i++) {
        assert.ok(dist(a.faces[f.id]!.pts[i]!, b.faces[f.id]!.pts[i]!) < 1e-3, `face ${f.id} jumps at s = ${k}`)
        assert.ok(dist(a.faces[f.id]!.pts[i]!, at.faces[f.id]!.pts[i]!) < 1e-3)
      }
    }
  }
})

test('a crease a step does not name holds its angle through the step', () => {
  const tree = hingeTree(m)
  for (let k = 0; k < n; k++) {
    const step = m.steps[k]!
    for (const c of treeCreases(m)) {
      if (c.id in step.moves) continue
      // A closure's solved creases follow its driven ones, and move only in a step that drives it
      if ((m.closures ?? []).some(cl => cl.solved.includes(c.id)) && k === 0) continue
      for (const x of [0.2, 0.5, 0.8]) assert.ok(Math.abs(modelAngles(m, k + x, tree)[c.id]! - m.keys[k]![c.id]!) < 1e-9, `${c.id} moves in step ${k + 1}`)
    }
  }
})

test('faces stay rigid and joined at every sampled s', () => {
  for (const s of samples(16)) {
    const p = modelPose(m, s)
    for (const f of m.faces) {
      const q = p.faces[f.id]!.pts
      for (let i = 0; i < f.pts.length; i++) {
        const j = (i + 1) % f.pts.length
        const flat = Math.hypot(f.pts[j]![0] - f.pts[i]![0], f.pts[j]![1] - f.pts[i]![1])
        assert.ok(Math.abs(dist(q[i]!, q[j]!) - flat) < 1e-9 * SIZE, `face ${f.id} stretches at s = ${s}`)
      }
    }
    const g = jointGap(m, p)
    assert.ok(g.gap < 1e-7 * SIZE, `the sheet tears at ${g.crease} at s = ${s} (${g.gap})`)
  }
})

test('no face passes below the page at any sampled s', () => {
  for (const s of samples(16)) {
    const p = modelPose(m, s)
    for (const f of m.faces) for (const q of p.faces[f.id]!.pts) assert.ok(q[2] > -1e-6 * SIZE, `face ${f.id} below the page at s = ${s}: ${q[2]}`)
  }
})

test('the kite folds lift both layers of the front flap toward the visitor', () => {
  for (const [k, faces] of [[1, ['Tro', 'Tr2o']], [2, ['T7o', 'T8o']]] as const) {
    for (const id of faces) {
      const high = Math.max(...[0.05, 0.1, 0.2, 0.3].map(x => Math.max(...modelPose(m, k + x).faces[id]!.pts.map(q => q[2]))))
      assert.ok(high > SIZE * 0.1, `${id} does not lift in step ${k + 1}: ${high}`)
    }
  }
  // and the faces not in the flap stay where the base left them
  const at1 = modelPose(m, 1), mid = modelPose(m, 1.5)
  for (const id of ['T1', 'T2', 'Tri', 'Tr2i', 'T7o', 'T8o']) for (let i = 0; i < 3; i++) assert.ok(dist(at1.faces[id]!.pts[i]!, mid.faces[id]!.pts[i]!) < 1e-9)
})

test('every flat-folded step end passes Maekawa and Kawasaki at every interior vertex', () => {
  for (let k = 1; k <= n; k++) assert.deepEqual(flatFoldable(keyFold(m, k)), [], `keyframe ${k}`)
})

test('the collapse ends in the preliminary base: its pose and its layer order', () => {
  const base = pose(preliminary(SIZE), 0)
  const p = modelPose(m, 1)
  const halves: Record<string, string> = { Tri: 'Tr', Tro: 'Tr', Tr2i: 'Tr2', Tr2o: 'Tr2', T7i: 'T7', T7o: 'T7', T8i: 'T8', T8o: 'T8' }
  for (const f of m.faces) {
    const of = halves[f.id] ?? f.id
    for (let i = 0; i < f.pts.length; i++) {
      const [x, y] = f.pts[i]!
      const mat = base.faces[of]!.matrix
      const expect: Vec3 = [mat[0]! * x + mat[4]! * y + mat[12]!, mat[1]! * x + mat[5]! * y + mat[13]!, mat[2]! * x + mat[6]! * y + mat[14]!]
      assert.ok(dist(p.faces[f.id]!.pts[i]!, expect) < 1e-6 * SIZE, `face ${f.id} is not where the base puts ${of}`)
    }
  }
  const ref = stackOrder(preliminary(SIZE))
  for (const f of m.faces) assert.equal(m.stacks[1]!.layer[f.id], ref.layer[halves[f.id] ?? f.id], `layer of ${f.id}`)
})

test('the layer order: flat at s = 0, the kite flap on top of the base after its fold, the swap half way through a step', () => {
  for (const f of m.faces) assert.equal(m.stacks[0]!.layer[f.id], 0)
  const top1 = Math.max(...Object.values(m.stacks[1]!.layer))
  // The right flap turned over: its two layers above everything, in reverse order
  const l2 = m.stacks[2]!.layer
  assert.ok(l2.Tro! > top1 && l2.Tr2o! > top1)
  assert.ok(l2.Tro! > l2.Tr2o!, 'the under layer of the flap lands on top')
  assert.equal(m.stacks[2]!.up.Tro, -1)
  const l3 = m.stacks[3]!.layer
  assert.ok(l3.T7o! > top1 && l3.T8o! > l3.T7o! - 2)
  // nearer keyframe
  assert.equal(keyAt(m, 1.4), 1)
  assert.equal(keyAt(m, 1.6), 2)
  assert.deepEqual(modelStack(m, 1.6), m.stacks[2])
  // a step is the child's layer over its parent's along the parent's normal
  for (const st of m.stacks) for (const c of treeCreases(m)) assert.equal(st.step[c.id], (st.layer[c.child]! - st.layer[c.parent]!) * st.up[c.parent]!)
})

test('reverse playback is the same function read backwards: the unfold', () => {
  for (const s of samples(8)) {
    const a = modelPose(m, s), b = modelPose(m, n - (n - s))
    for (const f of m.faces) assert.ok(dist(a.faces[f.id]!.pts[0]!, b.faces[f.id]!.pts[0]!) < 1e-12)
  }
  assert.deepEqual(stepAt(m, 0), { step: 0, x: 0 })
  assert.deepEqual(stepAt(m, 1), { step: 0, x: 1 })
  assert.equal(stepAt(m, 2.25).step, 2)
})

test('the creases made so far: none flat, the base after step 1, the kites after theirs', () => {
  assert.equal(creasesMade(m, 0).size, 0)
  const one = creasesMade(m, 1)
  assert.ok(one.has('Om1') && one.has('OB') && !one.has('BqC'))
  assert.ok(creasesMade(m, 2).has('BqC') && creasesMade(m, 2).has('CqC') && !creasesMade(m, 2).has('DpC'))
  assert.ok(creasesMade(m, 3).has('DpC'))
})

test('the steps\' pace: durations add up and modelTime walks them', () => {
  const total = modelDuration(m)
  assert.equal(total, m.steps.reduce((s, x) => s + x.duration, 0))
  assert.equal(modelTime(m, 0, n, total), n)
  assert.equal(modelTime(m, n, 0, total), 0)
  assert.ok(Math.abs(modelTime(m, 0, n, m.steps[0]!.duration) - 1) < 1e-9)
  assert.ok(Math.abs(modelTime(m, n, 0, m.steps[2]!.duration / 2) - 2.5) < 1e-9)
})

test('model() refuses a step that names an unknown crease, an angle past pi, or a moving set that would tear the sheet', () => {
  const pattern = preliminaryKitePattern(SIZE)
  assert.throws(() => model(pattern, [{ name: 'x', moves: { nope: 1 } }]), /does not have/)
  assert.throws(() => model(pattern, [{ name: 'x', moves: { Om1: 4 } }]), /outside/)
  // A kite crease in the under layer alone, on the flat sheet, swings Tro and Tr2o away from Tr2i: the closing kite crease opens
  assert.throws(() => model(pattern, [{ name: 'half a kite', moves: { BqC: 1 } }]), /tears the sheet/)
  // A closing crease told the wrong angle (a half kite, where the sign shows: at pi the two read the same)
  const steps = preliminaryKiteSteps()
  steps[1] = { ...steps[1]!, moves: { BqC: Math.PI / 2, CqC: Math.PI / 2 } }
  assert.throws(() => model(pattern, steps), /paper puts it/)
})

test('a model round-trips through FOLD: a creasePattern key frame and one foldedForm frame per step end', () => {
  const json = modelToFOLD(m)
  assert.deepEqual(json.file_classes, ['diagrams'])
  assert.deepEqual(json.frame_classes, ['creasePattern'])
  assert.equal(json.file_frames!.length, n)
  json.file_frames!.forEach((f, i) => {
    assert.deepEqual(f.frame_classes, ['foldedForm'])
    assert.equal(f.frame_parent, i)
    assert.equal(f.frame_inherit, true)
    assert.equal(f.frame_title, m.steps[i]!.name)
    assert.equal(f.vertices_coords!.length, json.vertices_coords!.length)
    assert.ok(f.faceOrders!.length > 0)
  })
  // The last frame's fold angles are the finished model's, in degrees
  const ids = json['edges_orkami:id'] as (string | null)[]
  const last = json.file_frames![n - 1]!
  ids.forEach((id, e) => { if (id) assert.ok(Math.abs(last.edges_foldAngle![e]! - m.keys[n]![id]! * 180 / Math.PI) < 1e-9) })
  const back = modelFromFOLD(JSON.parse(JSON.stringify(json)))
  assert.equal(back.steps.length, n)
  assert.deepEqual(back.steps.map(s => s.name), m.steps.map(s => s.name))
  for (let k = 0; k <= n; k++) for (const c of m.creases) assert.ok(Math.abs(back.keys[k]![c.id]! - m.keys[k]![c.id]!) < 1e-9, `${c.id} at keyframe ${k}`)
  assert.deepEqual(back.stacks.map(s => s.layer), m.stacks.map(s => s.layer))
  assert.deepEqual(back.faces.map(f => f.id), m.faces.map(f => f.id))
})

test('a foreign diagrams file (no orkami keys on its frames) reads its moves from the fold angles that change', () => {
  const json = modelToFOLD(m)
  for (const f of json.file_frames!) { delete f['frame_orkami:moves']; delete f['frame_orkami:duration'] }
  const back: Model = modelFromFOLD(JSON.parse(JSON.stringify(json)))
  for (let k = 0; k <= n; k++) for (const c of m.creases) assert.ok(Math.abs(Math.abs(back.keys[k]![c.id]!) - Math.abs(m.keys[k]![c.id]!)) < 1e-9)
})

test('a model of a fold with no steps is the flat sheet at every s', () => {
  const empty = model(preliminaryKitePattern(SIZE) as Fold, [])
  assert.equal(empty.keys.length, 1)
  const p = modelPose(empty, 2)
  for (const f of empty.faces) for (const q of p.faces[f.id]!.pts) assert.equal(q[2], 0)
})
