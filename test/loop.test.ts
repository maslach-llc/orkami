// The loop (D18): steps meet at flat, `at` walks each step's phases and wraps, a stop lands flat
// within one step; the CSS mountLoop on a fake clock; the WebGL stage loop; the loader's timing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { WebGLRenderer } from 'three'
import { blintz, book, preliminary, waterbomb } from '../src/core/folds/index.ts'
import { loop, loopSteps, LOOP_BASES, LOOP_GAP, LOOP_HOLD } from '../src/core/loop.ts'
import { pose } from '../src/core/pose.ts'
import { mountLoop } from '../src/css/loop.ts'
import { stage } from '../src/three/stage.ts'
import { loaderPlan } from '../src/vue/loader.ts'
import { block } from './fake-dom.ts'

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`)
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

test('the default loop is the square bases, each step fold-in + hold + unfold + gap long', () => {
  const lp = loop(loopSteps(200))
  assert.deepEqual(lp.steps.map(s => s.fold.name), [...LOOP_BASES])
  assert.equal(lp.hold, LOOP_HOLD)
  assert.equal(lp.gap, LOOP_GAP)
  let start = 0
  for (const s of lp.steps) {
    assert.equal(s.duration, s.schedule.total)
    assert.equal(s.length, 2 * s.duration + LOOP_HOLD + LOOP_GAP)
    assert.equal(s.start, start)
    start += s.length
  }
  assert.equal(lp.period, start)
})

test('at(ms) walks every step through fold-in, hold, unfold and gap in order, and wraps', () => {
  const lp = loop([{ fold: waterbomb(100, 100), duration: 400 }, { fold: preliminary(100, 100), duration: 300 }], { hold: 100, gap: 50 })
  assert.equal(lp.period, 950 + 750)
  const expect: [number, number, number, string][] = [
    [0, 0, 1, 'fold-in'], [200, 0, 0.5, 'fold-in'], [400, 0, 0, 'hold'], [499, 0, 0, 'hold'],
    [500, 0, 0, 'unfold'], [700, 0, 0.5, 'unfold'], [900, 0, 1, 'gap'], [949, 0, 1, 'gap'],
    [950, 1, 1, 'fold-in'], [1100, 1, 0.5, 'fold-in'], [1250, 1, 0, 'hold'], [1350, 1, 0, 'unfold'], [1650, 1, 1, 'gap'],
  ]
  for (const [ms, step, t, phase] of expect) {
    for (const cycle of [0, 1, 3]) {
      const a = lp.at(ms + cycle * lp.period)
      assert.equal(a.step, step, `step at ${ms}`)
      near(a.t, t)
      assert.equal(a.phase, phase, `phase at ${ms}`)
      assert.equal(a.cycle, cycle)
    }
  }
  // t never jumps inside a step: the fold-in falls, the unfold rises
  let prev = lp.at(0)
  for (let ms = 1; ms < lp.period; ms++) {
    const a = lp.at(ms)
    if (a.step === prev.step) assert.ok(Math.abs(a.t - prev.t) <= 1 / 300 + 1e-9, `t jumps at ${ms}`)
    else assert.ok(prev.t === 1 && a.t > 0.99, `the step changes away from flat at ${ms}`)
    prev = a
  }
})

test('at every step boundary the pose is flat: every face the identity', () => {
  const lp = loop(loopSteps(160))
  for (const s of lp.steps) {
    for (const ms of [s.start, s.start + s.length - 1e-6, s.start + 2 * s.duration + lp.hold]) {
      const a = lp.at(ms)
      assert.equal(lp.steps[a.step], s)
      near(a.t, 1, 1e-6)
      const p = pose(s.fold, a.t, s.schedule)
      for (const f of Object.values(p.faces)) f.matrix.forEach((v, i) => near(v, IDENTITY[i]!, 1e-6))
    }
    // and closed in the hold: some face is turned
    const held = pose(s.fold, lp.at(s.start + s.duration + lp.hold / 2).t, s.schedule)
    assert.ok(Object.values(held.faces).some(f => Math.abs(f.normal[2] - 1) > 1e-3), `${s.fold.name} is closed in the hold`)
  }
})

test('nextFlat lands on a flat moment, never more than one step away', () => {
  const lp = loop(loopSteps(120), { hold: 200, gap: 100 })
  const longest = Math.max(...lp.steps.map(s => s.length))
  for (let ms = -lp.period; ms < 2 * lp.period; ms += 37) {
    const f = lp.nextFlat(ms)
    assert.ok(f >= ms)
    assert.ok(f - ms <= longest, `${f - ms} ms to flat from ${ms}`)
    assert.equal(lp.at(f).t, 1, `not flat at ${f}`)
    // and it is the first flat moment after ms
    if (f > ms) assert.equal(lp.at(f).step, lp.at(ms).step)
  }
  // with no gap, the end of an unfold is still a flat moment
  const tight = loop(loopSteps(120), { hold: 0, gap: 0 })
  for (let ms = 0; ms < tight.period; ms += 53) near(tight.at(tight.nextFlat(ms)).t, 1)
})

test('loop refuses steps on different sheets, invalid folds and an empty list', () => {
  assert.throws(() => loop([{ fold: waterbomb(100, 100) }, { fold: blintz(120, 120) }]), /one sheet/)
  assert.throws(() => loop([{ fold: book(100, 60) }, { fold: book(60, 100) }]), /one sheet/)
  assert.throws(() => loop([]), /at least one/)
  const broken = blintz(100, 100)
  broken.faces[0] = { ...broken.faces[0]!, pts: [[0, 0], [10, 0], [0, 10]] }
  assert.throws(() => loop([{ fold: broken }]), /not a valid fold/)
  assert.throws(() => loop([{ fold: blintz(100, 100), duration: 0 }]), /duration/)
})

/** A fake clock the loop reads and the fake window's frames advance. */
function clock() {
  let ms = 1000
  return { now: () => ms, advance: (d: number) => { ms += d } }
}

test('mountLoop: the first step mounts flat, start() plays the steps, a swap only after a flat frame', () => {
  const { el, win } = block(120, 120)
  const lp = loop(loopSteps(120), { hold: 100, gap: 80 })
  const c = clock()
  const swaps: { step: number; lastT: number }[] = []
  let lastT = 1
  const h = mountLoop(el as unknown as HTMLElement, lp, { now: c.now, onStep: (step) => swaps.push({ step, lastT }) })
  assert.equal(h.step, 0)
  assert.equal(h.t, 1)
  assert.equal(h.running, false)
  assert.equal(h.handle!.fold, lp.steps[0]!.fold)
  h.start()
  assert.ok(h.running)
  for (let i = 0; i < Math.ceil(lp.period / 16) + 10; i++) {
    c.advance(16)
    win.tick()
    if (h.step === swaps.at(-1)!.step) lastT = h.t
  }
  assert.deepEqual(swaps.map(s => s.step), [0, 1, 2, 0])
  for (const s of swaps.slice(1)) assert.equal(s.lastT, 1, 'the frame before a swap is flat')
  h.destroy()
})

test('mountLoop: stop() resolves only at a flat moment, and lands flat', async () => {
  const { el, win } = block(100, 100)
  const lp = loop(loopSteps(100), { hold: 120, gap: 60 })
  for (const stopAfter of [10, 300, lp.steps[0]!.duration + 50, lp.period * 1.5]) {
    const c = clock()
    const h = mountLoop(el as unknown as HTMLElement, lp, { now: c.now })
    h.start()
    let elapsed = 0
    while (elapsed < stopAfter) { c.advance(16); elapsed += 16; win.tick() }
    let resolved = false
    const target = lp.nextFlat(elapsed)
    const p = h.stop().then(() => { resolved = true })
    const step = h.step
    for (let i = 0; i < 400 && !resolved; i++) {
      await Promise.resolve()
      if (resolved) break
      assert.ok(elapsed < target, `stopped late at ${elapsed}, flat at ${target}`)
      c.advance(16); elapsed += 16; win.tick()
      await Promise.resolve()
    }
    await p
    assert.ok(resolved)
    assert.ok(elapsed >= target, `resolved at ${elapsed}, before the flat moment ${target}`)
    assert.equal(h.t, 1)
    assert.equal(h.step, step, 'a stop lands the step it was playing')
    assert.equal(h.handle!.state, 'open')
    assert.equal(h.running, false)
    win.tick()
    assert.equal(h.t, 1, 'nothing moves after the stop')
    h.destroy()
  }
})

test('mountLoop: destroy() leaves the element as it was; stop() when idle resolves at once', async () => {
  const { el } = block(100, 100)
  el.classList.add('ori-loader-paper')
  const before = { classes: el.classList.toString(), children: el.children.length, style: [...el.style.props.entries()] }
  const c = clock()
  const h = mountLoop(el as unknown as HTMLElement, loop(loopSteps(100)), { now: c.now })
  await h.stop()
  h.start()
  h.destroy()
  assert.equal(el.classList.toString(), before.classes)
  assert.equal(el.children.length, before.children)
  assert.deepEqual([...el.style.props.entries()], before.style)
  assert.equal(h.handle, undefined)
  await h.stop()
})

test('mountLoop under reduced motion: the first step lies flat and nothing starts', async () => {
  const { el, win } = block(100, 100)
  win.reducedMotion = true
  const h = mountLoop(el as unknown as HTMLElement, loop(loopSteps(100)))
  h.start()
  assert.equal(h.running, false)
  assert.equal(h.t, 1)
  await h.stop()
  h.destroy()
})

test('stage.loop: rebuilds the groups at each step, renders every frame, and stop() lands flat', async () => {
  let renders = 0
  const fake = { setPixelRatio() {}, setClearColor() {}, shadowMap: {}, render() { renders++ }, setSize() {}, dispose() {} } as unknown as WebGLRenderer
  const st = stage({} as HTMLCanvasElement, { width: 100, height: 100, renderer: fake })
  const lp = loop(loopSteps(100), { hold: 40, gap: 40 })
  assert.throws(() => st.loop(loop(loopSteps(80))), /stage/)
  let ms = 0
  const sl = st.loop(lp, { now: () => ms })
  const first = sl.handle!
  assert.equal(first.fold, lp.steps[0]!.fold)
  assert.equal(first.t, 1)
  assert.ok(st.content.children.includes(first.root))
  // Jump the clock into the second step's hold and let one frame run
  ms = lp.steps[1]!.start + lp.steps[1]!.duration + 10
  await new Promise(r => setTimeout(r, 40))
  assert.equal(sl.step, 1)
  assert.equal(sl.handle!.t, 0)
  assert.ok(!st.content.children.includes(first.root), 'the first step is gone')
  assert.equal(st.content.children.filter(c => c === sl.handle!.root).length, 1)
  assert.ok(renders > 1)
  const landing = sl.stop()
  ms = lp.nextFlat(ms)
  await landing
  assert.equal(sl.handle!.t, 1)
  assert.equal(sl.step, 1)
  assert.equal(sl.running, false)
  st.dispose()
  assert.equal(sl.handle, undefined)
  assert.equal(st.content.children.length, 0)
})

test('loaderPlan: skipWithin renders nothing, minMs keeps it up, then it stops', () => {
  const o = { minMs: 600, skipWithin: 150 }
  assert.deepEqual(loaderPlan(undefined, 0, o), { phase: 'wait', next: 150 })
  assert.deepEqual(loaderPlan(undefined, 149, o), { phase: 'wait', next: 150 })
  assert.deepEqual(loaderPlan(0, 0, o), { phase: 'skip' })
  assert.deepEqual(loaderPlan(150, 150, o), { phase: 'skip' })
  assert.deepEqual(loaderPlan(undefined, 150, o), { phase: 'loop' })
  assert.deepEqual(loaderPlan(undefined, 5000, o), { phase: 'loop' })
  // ready soon after it showed: it stays for minMs from when it showed
  assert.deepEqual(loaderPlan(200, 200, o), { phase: 'loop', next: 750 })
  assert.deepEqual(loaderPlan(200, 749, o), { phase: 'loop', next: 750 })
  assert.deepEqual(loaderPlan(200, 750, o), { phase: 'stop' })
  // ready long after: it stops at once
  assert.deepEqual(loaderPlan(3000, 3000, o), { phase: 'stop' })
  // the defaults are 600 and 150
  assert.deepEqual(loaderPlan(100, 100), { phase: 'skip' })
  assert.deepEqual(loaderPlan(200, 200), { phase: 'loop', next: 750 })
})
