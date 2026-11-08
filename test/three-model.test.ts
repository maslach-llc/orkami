// The WebGL driver plays a model (D19) under Node: three's real classes, no WebGL context. The
// groups are built once and checked against the core at every keyframe (the world matrices
// against modelPose(), the layers against modelStack()), the hairlines against the creases
// made, and the stage's play on a fake clock.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Matrix4, Quaternion, Vector3, type Group, type Material, type WebGLRenderer } from 'three'
import { modelPose, modelStack } from '../src/core/model.ts'
import { preliminaryKite } from '../src/core/models/index.ts'
import { hingeTree } from '../src/core/tree.ts'
import { buildModel, stage, type ModelHandle } from '../src/three/index.ts'

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`)
const fake = () => ({ setPixelRatio() {}, setClearColor() {}, shadowMap: {}, render() {}, setSize() {}, dispose() {} } as unknown as WebGLRenderer)

/** The sheet point (scene axes) at a face's group origin: the sum of the positions up the tree, without the layer lift. */
function groupOrigin(h: ModelHandle, id: string): Vector3 {
  const out = new Vector3()
  let g = h.groups.get(id)!
  while (g !== h.root) {
    out.add(new Vector3(g.position.x, g.position.y, 0))
    g = g.parent as Group
  }
  return out
}

test('a model builds one group per face, once: the same groups at every s', () => {
  const m = preliminaryKite(240)
  const h = buildModel(m)
  assert.equal(h.steps, 3)
  assert.equal(h.model, m)
  assert.equal(h.groups.size, m.faces.length)
  assert.equal(h.faces.size, m.faces.length)
  const before = new Map(h.groups)
  for (const s of [0, 1.5, 3]) {
    h.set(s)
    assert.equal(h.s, s)
    for (const [id, g] of h.groups) assert.equal(g, before.get(id))
  }
  h.set(7)
  assert.equal(h.s, 3)
  h.set(-1)
  assert.equal(h.s, 0)
  h.dispose()
})

test('at every keyframe each face\'s world matrix is modelPose()\'s, y flipped', () => {
  const m = preliminaryKite(240)
  const h = buildModel(m, { layer: 0 })
  const F = new Matrix4().makeScale(1, -1, 1)
  for (const s of [0, 1, 2, 3]) {
    h.set(s)
    const p = modelPose(m, s)
    for (const f of m.faces) {
      const mesh = h.faces.get(f.id)!
      // The mesh's geometry sits at its group origin; undo that offset to get the face's sheet-to-world map
      const o = groupOrigin(h, f.id)
      const drawn = mesh.matrixWorld.clone().multiply(new Matrix4().makeTranslation(-o.x, -o.y, 0))
      const want = F.clone().multiply(new Matrix4().fromArray(p.faces[f.id]!.matrix)).multiply(F)
      for (let i = 0; i < 16; i++) near(drawn.elements[i]!, want.elements[i]!, 1e-6 * 240)
    }
  }
  h.dispose()
})

test('the layer offsets are modelStack()\'s steps times the layer, in full', () => {
  const m = preliminaryKite(240)
  const h = buildModel(m, { layer: 0.75 })
  const tree = hingeTree(m)
  let lifted = 0
  for (const s of [0, 0.4, 1, 1.6, 2, 2.5, 3]) {
    h.set(s)
    const stack = modelStack(m, s)
    for (const f of m.faces) {
      const hinge = tree.hinge[f.id]
      if (!hinge) continue
      const z = h.groups.get(f.id)!.position.z
      near(z, (stack.step[hinge] ?? 0) * 0.75, 1e-12)
      if (z !== 0) lifted++
    }
  }
  assert.ok(lifted > 0, 'some flap is lifted')
})

test('a crease\'s hairline shows once the paper has it: not before its step, past half way through it', () => {
  const m = preliminaryKite(240)
  const h = buildModel(m)
  const opacity = (id: string) => (h.lines.get(id)!.material as Material).opacity
  // BqC is made in step 2 (the right kite fold); Om1 in step 1 (the collapse)
  assert.ok(h.lines.has('BqC') && h.lines.has('Om1'))
  h.set(0)
  for (const l of h.lines.values()) assert.equal((l.material as Material).opacity, 0)
  h.set(1)
  assert.equal(opacity('BqC'), 0)
  assert.ok(opacity('Om1') > 0)
  h.set(1.4)
  assert.equal(opacity('BqC'), 0)
  h.set(1.6)
  assert.ok(opacity('BqC') > 0)
  h.set(2)
  assert.ok(opacity('BqC') > 0)
  // Each hairline has its own material, so one can show while another does not
  assert.notEqual(h.lines.get('BqC')!.material, h.lines.get('DpC')!.material)
  assert.equal(opacity('DpC'), 0)
  h.dispose()
})

test('stage.model plays s to the end on the clock, and back to the flat sheet', async () => {
  const m = preliminaryKite(240)
  let clock = 0
  const st = stage({} as HTMLCanvasElement, { width: 240, height: 240, renderer: fake() })
  assert.throws(() => st.model(preliminaryKite(200)), /sheet/)
  const sm = st.model(m, { now: () => (clock += 250), pace: 0.5 })
  assert.equal(sm.s, 0)
  assert.equal(sm.handle.root.parent, st.content)
  const forward = sm.play()
  assert.equal(sm.playing, true)
  await forward
  assert.equal(sm.s, 3)
  assert.equal(sm.playing, false)
  await sm.play(3, 0)
  assert.equal(sm.s, 0)
  for (const a of Object.values(sm.handle.pose.angles)) near(a, 0, 1e-12)
  for (const g of sm.handle.groups.values()) {
    near(g.quaternion.angleTo(new Quaternion()), 0, 1e-12)
    assert.equal(g.position.z, 0)
  }
  // A linear play over a given duration, cancelled by a set: it resolves where it stands
  const running = sm.play(0, 3, 1e6)
  sm.set(1)
  await running
  assert.equal(sm.s, 1)
  assert.equal(sm.playing, false)
  sm.destroy()
  assert.equal(sm.handle.root.parent, null)
  st.dispose()
})
