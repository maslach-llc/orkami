import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, compose, type Affine, type Pt } from '../src/core/affine.ts'
import { crease as creaseOf, face as faceOf } from '../src/core/fold.ts'
import { accordion, blintz, book, cupboard, lift, named, type NamedFold } from '../src/core/folds/index.ts'
import { flatBack } from '../src/core/pose.ts'
import { shadowAt } from '../src/core/style.ts'
import { fits, grainUrl, mount, sidePolygon } from '../src/css/driver.ts'
import { wordFold } from '../src/glyphs/layout.ts'
import { block, type FakeElement } from './fake-dom.ts'

const DEG = 180 / Math.PI
const deg = (s: string) => parseFloat(s)
const flapsOf = (el: FakeElement) => el.querySelectorAll('.ori-flap')
const byFace = (el: FakeElement, id: string) => el.querySelectorAll(`.ori-flap[data-face=${id}]`)[0]!
/** The vertex count of a `polygon(...)` clip-path. */
const vertices = (clip: string) => clip.replace(/^polygon\(|\)$/g, '').split(',').length
const parsePolygon = (clip: string): Pt[] => clip.replace(/^polygon\(|\)$/g, '').split(',').map(s => s.trim().split(' ').map(parseFloat) as Pt)
const parseMatrix = (t: string): Affine => t.replace(/^matrix\(|\)$/g, '').split(',').map(Number) as Affine
/** A side's clip polygon back in host px: its own box's offset added. */
const inHost = (side: FakeElement): Pt[] => parsePolygon(side.style.clipPath!).map(([x, y]) => [x + parseFloat(side.style.left || '0'), y + parseFloat(side.style.top || '0')])
const near = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`)

test('the blintz mounts four flaps, each clipped to its corner and hinged at its crease', () => {
  const { el } = block(300, 300)
  const fold = blintz(300, 300)
  const h = mount(el, fold)
  const flaps = flapsOf(el)
  assert.equal(flaps.length, 4)
  for (const id of ['tl', 'tr', 'br', 'bl']) {
    const flap = byFace(el, id)
    const c = creaseOf(fold, `c${['tl', 'tr', 'br', 'bl'].indexOf(id) + 1}`)
    assert.equal(flap.style.getPropertyValue('transform-origin'), `${c.a[0]}px ${c.a[1]}px`)
    const front = flap.querySelectorAll('.ori-side.front')[0]!, back = flap.querySelectorAll('.ori-side.back')[0]!
    assert.deepEqual(inHost(front), faceOf(fold, id).pts)
    assert.deepEqual(inHost(back), sidePolygon(fold, id, true))
    assert.equal(vertices(front.style.clipPath!), 3)
    near(deg(flap.style.getPropertyValue('--ori-a')), 180)
    assert.equal(flap.style.getPropertyValue('--ori-step'), '1')
  }
  assert.equal(h.drive, 'css')
  assert.ok(el.classList.contains('ori-host'))
  assert.equal(el.querySelectorAll('.ori-ground').length, 4)
  assert.equal(el.querySelectorAll('line').length, 4)
  h.destroy()
})

test("the schedule's starts and durations land on the flaps as transition delays", () => {
  const { el } = block(300, 300)
  const fold = blintz(300, 300)
  mount(el, fold, { delay: 100 })
  const s = fold.schedule!
  for (const id of ['tl', 'tr', 'br', 'bl']) {
    const flap = byFace(el, id)
    const e = s.creases[`c${['tl', 'tr', 'br', 'bl'].indexOf(id) + 1}`]!
    near(parseFloat(flap.style.getPropertyValue('--ori-start')), e.start * s.total)
    near(parseFloat(flap.style.getPropertyValue('--ori-dur')), e.duration * s.total)
    near(parseFloat(flap.style.getPropertyValue('--ori-end')), (1 - e.start - e.duration) * s.total)
  }
  assert.equal(el.style.getPropertyValue('--ori-delay'), '100ms')
  assert.equal(el.style.getPropertyValue('--ori-total'), `${+s.total.toFixed(4)}ms`)
  // The corners open c4 first (the unfold order), so c4 has the earliest start
  near(parseFloat(byFace(el, 'bl').style.getPropertyValue('--ori-start')), 0)
  assert.ok(parseFloat(byFace(el, 'tl').style.getPropertyValue('--ori-start')) > 0)
})

test('set(1) puts every angle at 0deg and lands; set(0) closes again', () => {
  const { el } = block(300, 300)
  const h = mount(el, blintz(300, 300))
  h.set(1)
  for (const flap of flapsOf(el)) assert.equal(flap.style.getPropertyValue('--ori-a'), '0deg')
  assert.equal(h.t, 1)
  assert.equal(h.state, 'open')
  assert.ok(el.classList.contains('is-landed'))
  h.set(0)
  for (const flap of flapsOf(el)) near(deg(flap.style.getPropertyValue('--ori-a')), 180)
  assert.ok(!el.classList.contains('is-landed'))
  assert.equal(h.state, 'closed')
  h.set(0.5)
  assert.equal(h.state, 'still')
})

test('destroy leaves the element as it was', () => {
  const { el } = block(300, 300)
  const before = { children: el.children.length, classes: el.className, styles: el.style.size }
  const h = mount(el, blintz(300, 300))
  assert.ok(el.children.length > before.children)
  assert.ok(el.style.size > before.styles)
  h.destroy()
  assert.equal(el.children.length, before.children)
  assert.equal(el.className, before.classes)
  assert.equal(el.style.size, before.styles)
})

test('every generated clip-path has exactly the face its vertex count, for every named fold', () => {
  for (const n of Object.keys(named) as NamedFold[]) {
    const { el } = block(200, 200)
    const fold = named[n](200, 200)
    const h = mount(el, fold)
    for (const side of el.querySelectorAll('.ori-side')) {
      const face = faceOf(fold, side.dataset.face!)
      const clip = side.style.clipPath
      if (!clip) { assert.equal(face.pts.length, 4, `${n}: ${face.id} unclipped but not the full box`); continue }
      assert.equal(vertices(clip), face.pts.length, `${n}: ${face.id}`)
    }
    h.destroy()
  }
})

test('each side is a box the size of its face, its clip and paper in that box, for every named fold', () => {
  // A sheet-sized side with the face clipped out of it far from the box's origin is culled by
  // Chromium's software compositor on a 3D-transformed flap: the blintz lost three corners
  for (const n of Object.keys(named) as NamedFold[]) {
    const { el } = block(240, 240)
    const fold = named[n](240, 240)
    const h = mount(el, fold)
    for (const side of el.querySelectorAll('.ori-side')) {
      const back = side.classList.contains('back')
      const pts = sidePolygon(fold, side.dataset.face!, back)
      const paper = side.querySelectorAll('.ori-face')[0]!
      assert.ok(paper, `${n}: ${side.dataset.face} has its paper`)
      assert.equal(paper.style.width, '240px')
      if (!side.style.clipPath) continue
      const x0 = Math.min(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1]))
      near(parseFloat(side.style.left!), x0); near(parseFloat(side.style.top!), y0)
      near(parseFloat(side.style.width!), Math.max(...pts.map(p => p[0])) - x0)
      near(parseFloat(side.style.height!), Math.max(...pts.map(p => p[1])) - y0)
      near(parseFloat(paper.style.left!), -x0); near(parseFloat(paper.style.top!), -y0)
      const got = inHost(side)
      got.forEach((p, i) => { near(p[0], pts[i]![0]); near(p[1], pts[i]![1]) })
      // The back still turns about the sheet's vertical midline
      if (back) assert.equal(side.style.transformOrigin, `${+(120 - x0).toFixed(4)}px ${+(120 - y0).toFixed(4)}px`)
    }
    h.destroy()
  }
})

test('a flap at mid-unfold casts a larger, softer shadow than at t = 1, where it casts none', () => {
  const { el } = block(300, 300)
  const fold = blintz(300, 300)
  const h = mount(el, fold)
  const shadow = () => byFace(el, 'tl').querySelectorAll('.ori-shadow.ambient')[0]!
  h.set(0.5)
  const mid = { blur: parseFloat(shadow().style.filter!.replace(/^blur\(|\)$/g, '')), offset: parseFloat(shadow().style.getPropertyValue('--ori-soy')), opacity: parseFloat(shadow().style.opacity!) }
  h.set(1)
  const flat = { blur: parseFloat(shadow().style.filter!.replace(/^blur\(|\)$/g, '')), offset: parseFloat(shadow().style.getPropertyValue('--ori-soy')), opacity: parseFloat(shadow().style.opacity!) }
  assert.ok(mid.blur > flat.blur, `mid blur ${mid.blur} over flat ${flat.blur}`)
  assert.ok(mid.offset > flat.offset, `mid offset ${mid.offset} over flat ${flat.offset}`)
  assert.ok(mid.opacity > 0)
  assert.equal(flat.opacity, 0)
  // At rest the blur and offset are the style's resting stack, halved into CSS blur radius
  near(flat.blur, shadowAt(0).ambient.blur / 2)
  near(flat.offset, shadowAt(0).ambient.offset[1])
  // The shadow's shape is the face's projected outline: the triangle, foreshortened
  const shape = shadow().querySelectorAll('.ori-shadow-shape')[0]!
  assert.equal(vertices(shape.style.clipPath!), 3)
})

test('the back is painted with the sheet under the inverse of flatBack, mirrored for the turned side', () => {
  const { el } = block(200, 100)
  const fold = book(200, 100, 'left')
  mount(el, fold)
  const ink = byFace(el, 'b').querySelectorAll('.ori-ink')[0]!
  const m = parseMatrix(ink.style.transform!)
  // A point on the back at local (x', y) is the face point (W - x', y); it must show the sheet
  // where that point lies folded: flatBack. So the map takes sheet point s to local mirror(flatBack(s)).
  const fb = flatBack(fold, 'c1')
  for (const s of [[150, 20], [180, 90], [100, 50]] as Pt[]) {
    const expected = apply(compose([-1, 0, 0, 1, 200, 0], [1, 0, 0, 1, 0, 0]), apply(fb, s))
    const got = apply(m, s)
    near(got[0], expected[0]); near(got[1], expected[1])
  }
  // The right half of the book lands on the left half: sheet (150, 20) shows at face (50, 20), local (150, 20)
  const got = apply(m, [150, 20])
  near(got[0], 150); near(got[1], 20)
})

test('a pleat lifts each panel a layer step in its parent frame, signed by the crease', () => {
  const { el } = block(100, 500)
  const h = mount(el, accordion(100, 500, 4))
  assert.deepEqual(['p1', 'p2', 'p3', 'p4'].map(id => byFace(el, id).style.getPropertyValue('--ori-step')), ['1', '-1', '1', '-1'])
  // Nested by parent: p2's flap sits inside p1's
  assert.equal(byFace(el, 'p2').parentNode, byFace(el, 'p1'))
  assert.equal(byFace(el, 'p1').parentNode, el.querySelectorAll('.ori-fold')[0])
  h.destroy()
})

test('a lift turns the element itself, with its back and shade inside', () => {
  const { el } = block(400, 200, { backgroundColor: 'rgb(255, 255, 255)' })
  const fold = lift(400, 200, 'top')
  const h = mount(el, fold)
  assert.ok(el.classList.contains('ori-lifted'))
  assert.equal(flapsOf(el).length, 0)
  assert.equal(el.style.getPropertyValue('--ori-hx'), '-200px')
  assert.equal(el.style.getPropertyValue('--ori-hy'), '-100px')
  assert.equal(el.style.getPropertyValue('transform-origin'), '200px 100px')
  near(deg(el.style.getPropertyValue('--ori-a')), 180)
  assert.equal(el.querySelectorAll('.ori-side.back').length, 1)
  assert.equal(el.querySelectorAll('.ori-shade').length, 1)
  assert.equal(el.querySelectorAll('.ori-ground').length, 0)
  assert.equal(el.querySelectorAll('line').length, 1)
  h.set(1)
  assert.equal(el.style.getPropertyValue('--ori-a'), '0deg')
  h.destroy()
  assert.ok(!el.classList.contains('ori-lifted'))
  assert.equal(el.style.size, 0)
})

test('a bare element is painted with the sheet; one with a background keeps it on its fronts', () => {
  const bare = block(200, 200)
  mount(bare.el, cupboard(200, 200))
  const paperOf = (side: FakeElement) => side.querySelectorAll('.ori-face')[0]!
  for (const front of bare.el.querySelectorAll('.ori-side.front')) assert.ok(paperOf(front).classList.contains('ori-paper'))
  const card = block(200, 200, { backgroundColor: 'rgb(10, 20, 30)', backgroundImage: 'linear-gradient(red, blue)' })
  mount(card.el, cupboard(200, 200))
  for (const front of card.el.querySelectorAll('.ori-side.front')) {
    assert.ok(!paperOf(front).classList.contains('ori-paper'))
    assert.equal(paperOf(front).style.backgroundColor, 'rgb(10, 20, 30)')
    assert.equal(paperOf(front).style.backgroundImage, 'linear-gradient(red, blue)')
  }
})

test('open() runs the clock to the landing and resolves landed; the frame drive writes the angles', async () => {
  const { el, win } = block(300, 300)
  win.registered = false
  const fold = blintz(300, 300)
  const h = mount(el, fold, { drive: 'auto' })
  assert.equal(h.drive, 'frame')
  let landed = false
  void h.landed.then(() => { landed = true })
  const opening = h.open()
  assert.equal(h.state, 'opening')
  assert.ok(el.classList.contains('is-open'))
  const t0 = performance.now()
  // Drive the frames past the schedule's length
  while (performance.now() - t0 < fold.schedule!.total + 50 && h.state === 'opening') {
    await new Promise(r => setTimeout(r, 5))
    win.tick()
  }
  await opening
  assert.equal(h.state, 'open')
  assert.equal(h.t, 1)
  await Promise.resolve()
  assert.ok(landed)
  for (const flap of flapsOf(el)) assert.equal(flap.style.getPropertyValue('--ori-a'), '0deg')
  assert.ok(el.classList.contains('is-landed'))
})

test('open() in the css drive sets the targets and leaves the motion to the transitions', async () => {
  const { el, win } = block(300, 300)
  const h = mount(el, blintz(300, 300))
  const p = h.open()
  for (const flap of flapsOf(el)) assert.equal(flap.style.getPropertyValue('--ori-a'), '0deg')
  assert.ok(!el.classList.contains('ori-scrub'))
  // Only the shadows are painted per frame; finish the clock
  const t0 = performance.now()
  while (performance.now() - t0 < 1500 && h.state === 'opening') { await new Promise(r => setTimeout(r, 5)); win.tick() }
  await p
  assert.equal(h.state, 'open')
})

test('reduced motion mounts flat, and a fold with a closure takes the frame drive', () => {
  const r = block(200, 200)
  r.win.reducedMotion = true
  const h = mount(r.el, blintz(200, 200))
  assert.equal(h.t, 1)
  assert.ok(r.el.classList.contains('is-landed'))
  const w = block(200, 200)
  assert.equal(mount(w.el, named.waterbomb(200, 200)).drive, 'frame')
})

test('a fold built as a factory takes the element size; fits says when a fold matches its box', () => {
  const { el } = block(320, 180)
  const h = mount(el, (w, hh) => book(w, hh, 'top'))
  assert.equal(h.fold.sheet.width, 320)
  assert.equal(h.fold.sheet.height, 180)
  assert.ok(fits(el, h.fold))
  assert.ok(!fits(el, book(100, 100)))
})

test('the grain tile follows the style values', () => {
  const url = grainUrl({ on: true, strength: 0.14, frequency: 1, octaves: 3 })
  assert.ok(url.startsWith('url("data:image/svg+xml,'))
  assert.ok(url.includes("baseFrequency='1'") && url.includes("numOctaves='3'") && url.includes('0 0.14'))
})

test('the angle at t is the pose angle in degrees, closing creases included', () => {
  const { el } = block(200, 200)
  const fold = blintz(200, 200)
  const h = mount(el, fold)
  h.set(0.3)
  const c4 = creaseOf(fold, 'c4')
  const expected = (1 - fold.schedule!.creases.c4!.start) // sanity: c4 started
  assert.ok(expected > 0)
  const a = deg(byFace(el, 'bl').style.getPropertyValue('--ori-a'))
  assert.ok(a > 0 && a < c4.closed * DEG)
})

test('a word mounts every letter facet as a flap on the page, with no ground and no root side', () => {
  const fold = wordFold('MAS')
  const { el } = block(fold.sheet.width, fold.sheet.height)
  const h = mount(el, fold)
  const faces = fold.faces.filter(f => !f.page)
  assert.equal(flapsOf(el).length, faces.length)
  assert.equal(el.querySelectorAll('.ori-ground').length, 0)
  assert.equal(el.querySelectorAll('.ori-root').length, 0)
  assert.ok(!el.classList.contains('ori-lifted'))
  for (const f of faces) assert.ok(byFace(el, f.id), `no flap for ${f.id}`)
  h.set(1)
  assert.ok(el.classList.contains('is-landed'))
  for (const flap of flapsOf(el)) near(deg(flap.style.getPropertyValue('--ori-a')), 0)
  h.destroy()
  assert.equal(el.querySelectorAll('.ori-flap').length, 0)
})
