import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modelPose, modelStack, type Model } from '../src/core/model.ts'
import { preliminaryKite } from '../src/core/models/index.ts'
import { hingeTree } from '../src/core/tree.ts'
import { mountModel } from '../src/css/model.ts'
import { block, type FakeElement } from './fake-dom.ts'

const DEG = 180 / Math.PI
const num = (n: number) => String(+n.toFixed(4))
const flapsOf = (el: FakeElement) => el.querySelectorAll('.ori-flap')
const byFace = (el: FakeElement, id: string) => el.querySelectorAll(`.ori-flap[data-face=${id}]`)[0]!

/** Each flap's expected --ori-a and --ori-step at s, from the core. */
function expected(m: Model, s: number) {
  const tree = hingeTree(m)
  const pose = modelPose(m, s), stack = modelStack(m, s)
  return m.faces.filter(f => f.id !== m.root).map((f) => {
    const c = tree.hinge[f.id]!
    return { face: f.id, a: `${num(pose.angles[c]! * DEG)}deg`, step: String(stack.step[c] ?? 0) }
  })
}

test('the kite mounts one flap per non-root face, built once and driven by the core at every s', () => {
  const m = preliminaryKite(240)
  const { el } = block(240, 240)
  const h = mountModel(el, m)
  const flaps = flapsOf(el)
  assert.equal(flaps.length, m.faces.length - 1)
  assert.ok(el.classList.contains('ori-host'))
  assert.equal(el.querySelectorAll('.ori-model').length, 1)
  for (const f of flaps) {
    // Its own two sides; the faces hinged beyond it nest inside as flaps
    const own = f.children.filter(c => c.classList.contains('ori-side'))
    assert.deepEqual(own.map(c => c.className), ['ori-side front', 'ori-side back'], `${f.dataset.face} sides`)
    assert.ok(own.every(c => c.dataset.face === f.dataset.face))
  }
  const sides = el.querySelectorAll('.ori-side')
  for (const s of [0, 1.5, 3, 0.4, 2.6]) {
    h.set(s)
    assert.equal(h.s, s)
    // Built once: the same elements every step
    const now = flapsOf(el)
    assert.equal(now.length, flaps.length)
    now.forEach((f, i) => assert.equal(f, flaps[i]))
    assert.deepEqual(el.querySelectorAll('.ori-side'), sides)
    for (const e of expected(m, s)) {
      const flap = byFace(el, e.face)
      assert.equal(flap.style.getPropertyValue('--ori-a'), e.a, `${e.face} angle at ${s}`)
      assert.equal(flap.style.getPropertyValue('--ori-step'), e.step, `${e.face} step at ${s}`)
    }
    // Every side carries its tone from the core, the back the reversed normal's
    for (const side of sides) assert.ok(parseFloat(side.style.getPropertyValue('--ori-k')) > 0)
  }
  h.destroy()
})

test('the layer order swaps between the first and second keyframes on the kite flap', () => {
  const m = preliminaryKite(240)
  const { el } = block(240, 240)
  const h = mountModel(el, m)
  const read = () => Object.fromEntries(['Tro', 'Tr2o'].map(id => [id, byFace(el, id).style.getPropertyValue('--ori-step')]))
  h.set(1)
  const one = read()
  h.set(2)
  const two = read()
  assert.notDeepEqual(one, two)
  // The swap is at the half-way point of step 2, not before
  h.set(1.49)
  assert.deepEqual(read(), one)
  h.set(1.51)
  assert.deepEqual(read(), two)
  h.destroy()
})

test('the tone is the posed normal under the one light: flat sides lit as printed, a face turned over dark in front', () => {
  const m = preliminaryKite(240)
  const { el } = block(240, 240)
  mountModel(el, m)
  const k = (face: string, side: 'front' | 'back') => parseFloat(el.querySelectorAll(`.ori-side.${side}[data-face=${face}]`)[0]!.style.getPropertyValue('--ori-k'))
  // Flat: every front at ka + kd (L . z), every back at ka (facing away)
  assert.ok(Math.abs(k('T2', 'front') - (0.35 + 0.85 * 0.769)) < 1e-3)
  assert.ok(Math.abs(k('T2', 'back') - 0.35) < 1e-3)
})

test('play(0, 3) runs the clock to the end and resolves there; a set cancels a play', async () => {
  const m = preliminaryKite(240)
  const { el, win } = block(240, 240)
  let clock = 0
  const frames: number[] = []
  const h = mountModel(el, m, { now: () => clock, onFrame: s => frames.push(s) })
  const p = h.play(0, 3)
  assert.ok(h.playing)
  const total = m.steps.reduce((t, s) => t + s.duration, 0)
  for (let ms = 0; ms <= total + 32 && h.playing; ms += 16) { clock = ms; win.tick() }
  await p
  assert.equal(h.s, 3)
  assert.ok(!h.playing)
  assert.equal(el.dataset.step, '3')
  // Monotone, through every step
  for (let i = 1; i < frames.length; i++) assert.ok(frames[i]! >= frames[i - 1]!)
  assert.ok(frames.some(s => s > 0 && s < 1) && frames.some(s => s > 1 && s < 2) && frames.some(s => s > 2 && s < 3))
  // At pace 2 the first step's own length takes the paper half way through it
  const slow = block(240, 240)
  let c2 = 0
  const g = mountModel(slow.el, m, { pace: 2, now: () => c2 })
  void g.play(0, 3)
  c2 = m.steps[0]!.duration; slow.win.tick()
  assert.ok(Math.abs(g.s - 0.5) < 1e-9, `${g.s}`)
  g.destroy()
  // A duration plays linearly in s
  clock = 0
  const q = h.play(3, 0, 300)
  clock = 150; win.tick()
  assert.equal(h.s, 1.5)
  h.set(2)
  await q
  assert.equal(h.s, 2)
  assert.ok(!h.playing)
})

test('reduced motion jumps a play to its end', async () => {
  const { el, win } = block(240, 240)
  win.reducedMotion = true
  const h = mountModel(el, preliminaryKite(240))
  await h.play()
  assert.equal(h.s, 3)
})

test('destroy leaves the element as it was', () => {
  const { el } = block(240, 240)
  const before = { children: el.children.length, classes: el.className, styles: el.style.size, data: { ...el.dataset } }
  const h = mountModel(el, preliminaryKite(240), { at: 2 })
  assert.equal(h.s, 2)
  assert.ok(el.children.length > before.children)
  h.destroy()
  assert.equal(el.children.length, before.children)
  assert.equal(el.className, before.classes)
  assert.equal(el.style.size, before.styles)
  assert.deepEqual({ ...el.dataset }, before.data)
})
