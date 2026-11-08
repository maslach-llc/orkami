// Printing on the faces (D17) and the still mount: the core's placement math, the CSS driver's
// print modes on the fake DOM, and the WebGL driver's printed UVs under Node.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DataTexture, RGBAFormat, Vector3, type Mesh, type MeshLambertMaterial } from 'three'
import type { Pt } from '../src/core/affine.ts'
import type { Fold } from '../src/core/fold.ts'
import { accordion, blintz, cupboard, lift } from '../src/core/folds/index.ts'
import { boundsOf, facePrint, isImagePrint, printPolygon, printRect, printUv } from '../src/core/print.ts'
import { CONTENT_FACES, mount } from '../src/css/driver.ts'
import { buildFold } from '../src/three/scene.ts'
import { block, type FakeElement } from './fake-dom.ts'

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`)
const area = (pts: Pt[]) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]!; return s + p[0] * q[1] - q[0] * p[1] }, 0)) / 2
const W = 720, H = 876
const FOLDS: [string, Fold][] = [['blintz', blintz(W, H)], ['cupboard', cupboard(W, H, 'vertical')], ['accordion', accordion(W, H, 4, 'horizontal')]]
const URL = '/sample/print.svg'

// --- the core

test('printRect: the sheet itself without a size or for fill; cover crops, contain leaves paper, both centered by default', () => {
  assert.deepEqual(printRect({ width: W, height: H }), { x: 0, y: 0, w: W, h: H })
  assert.deepEqual(printRect({ width: W, height: H }, { width: 360, height: 720 }, 'fill'), { x: 0, y: 0, w: W, h: H })
  assert.deepEqual(printRect({ width: W, height: H }, { width: 0, height: 0 }), { x: 0, y: 0, w: W, h: H })
  // A tall picture: cover scales by the width (2x), cropping top and bottom evenly
  const cover = printRect({ width: W, height: H }, { width: 360, height: 720 }, 'cover')
  assert.deepEqual(cover, { x: 0, y: (H - 1440) / 2, w: 720, h: 1440 })
  // contain scales by the height, leaving bands of paper either side
  const contain = printRect({ width: W, height: H }, { width: 360, height: 720 }, 'contain')
  near(contain.h, H)
  near(contain.w, 438)
  near(contain.x, (W - 438) / 2)
  near(contain.y, 0)
  // position moves the crop: the top of the picture at the top of the sheet
  near(printRect({ width: W, height: H }, { width: 360, height: 720 }, 'cover', [0.5, 0]).y, 0)
  // a picture of the sheet's own shape lies exactly on it whatever the fit
  for (const fit of ['cover', 'contain', 'fill'] as const) assert.deepEqual(printRect({ width: W, height: H }, { width: 360, height: 438 }, fit), { x: 0, y: 0, w: W, h: H })
})

test("facePrint: every face of the blintz, cupboard and accordion puts sheet point (0, 0) at the picture's top left", () => {
  for (const [name, fold] of FOLDS) {
    for (const face of fold.faces) {
      if (face.page) continue
      const p = facePrint(fold, face.id)
      assert.deepEqual(p.box, boundsOf(face.pts), `${name} ${face.id}`)
      assert.deepEqual(p.size, [W, H])
      // The picture's corner, in the face's box, is the sheet's origin in that box
      near(p.offset[0] + p.box.x, 0)
      near(p.offset[1] + p.box.y, 0)
      // A cropped picture keeps the arithmetic: the corner moves with the rect
      const r = printRect(fold.sheet, { width: 360, height: 720 })
      const q = facePrint(fold, face.id, r)
      near(q.offset[0] + q.box.x, r.x)
      near(q.offset[1] + q.box.y, r.y)
    }
  }
})

test('the faces\' print rects tile the sheet: their parts of the picture cover it once, with no gap and no overlap', () => {
  for (const [name, fold] of FOLDS) {
    const faces = fold.faces.filter(f => !f.page)
    const parts = faces.map(f => printPolygon(fold, f.id))
    near(parts.reduce((s, p) => s + area(p), 0), 1, 1e-9)
    for (const p of parts) for (const [u, v] of p) assert.ok(u >= -1e-9 && u <= 1 + 1e-9 && v >= -1e-9 && v <= 1 + 1e-9, `${name}: ${u}, ${v}`)
    // and in sheet px the face areas add to the sheet's
    near(faces.reduce((s, f) => s + area(f.pts), 0), W * H, 1e-6)
  }
})

test('printUv: three\'s convention, v up from the picture\'s bottom; outside [0, 1] is paper', () => {
  const r = { x: 0, y: 0, w: W, h: H }
  assert.deepEqual(printUv([0, 0], r), [0, 1])
  assert.deepEqual(printUv([W, H], r), [1, 0])
  assert.deepEqual(printUv([W / 2, H / 4], r), [0.5, 0.75])
  const [u] = printUv([0, 0], printRect({ width: W, height: H }, { width: 360, height: 720 }, 'contain'))
  assert.ok(u < 0)
  assert.ok(isImagePrint({ image: URL }))
  assert.ok(!isImagePrint('landed') && !isImagePrint('content') && !isImagePrint(undefined))
})

// --- the CSS driver

const fronts = (el: FakeElement) => el.querySelectorAll('.ori-side.front')
/** A layer of a comma list of CSS values. */
const layer = (v: string, i: number) => v.split(/,\s*(?![^()]*\))/)[i]!.trim()

test('print: { image } sets the same picture on every front side, each placed by facePrint, the backs left the sheet', async () => {
  for (const [, fold] of FOLDS) {
    const { el, doc } = block(W, H)
    doc.imageSize = [360, 720]
    const h = mount(el, fold, { print: { image: URL } })
    assert.equal(h.print, 'image')
    await h.ready
    const r = printRect(fold.sheet, { width: 360, height: 720 })
    const sides = fronts(el)
    assert.equal(sides.length, fold.faces.filter(f => !f.page).length)
    for (const side of sides) {
      const p = facePrint(fold, side.dataset.face!, r)
      assert.equal(side.style.backgroundImage, `var(--ori-grain), url("${URL}")`)
      assert.equal(layer(side.style.backgroundSize!, 1), `${p.size[0]}px ${p.size[1]}px`)
      assert.equal(layer(side.style.backgroundPosition!, 1), `${+p.offset[0].toFixed(4)}px ${+p.offset[1].toFixed(4)}px`)
      assert.equal(layer(side.style.backgroundRepeat!, 1), 'no-repeat')
      // grain multiplied over the print, tiled in sheet coordinates
      assert.equal(side.style.backgroundBlendMode, 'multiply, normal')
      assert.equal(layer(side.style.backgroundPosition!, 0), `${+(-p.box.x).toFixed(4)}px ${+(-p.box.y).toFixed(4)}px`)
      // The paper inside paints nothing over it; the tone is the side's ::after, over both
      const paper = side.querySelectorAll('.ori-face')[0]!
      assert.equal(paper.style.backgroundImage, '')
      assert.ok(!paper.classList.contains('ori-paper'))
    }
    for (const back of el.querySelectorAll('.ori-side.back')) {
      assert.equal(back.style.backgroundImage, '')
      assert.equal(back.querySelectorAll('.ori-ink.ori-paper').length, 1)
    }
    // Folded, the host paints nothing; landed, it wears the whole picture
    assert.equal(el.style.getPropertyValue('background-image'), 'none')
    h.set(1)
    assert.equal(el.style.getPropertyValue('background-image'), `var(--ori-grain), url("${URL}")`)
    assert.equal(layer(el.style.getPropertyValue('background-position'), 1), `${r.x}px ${r.y}px`)
    h.set(0)
    assert.equal(el.style.getPropertyValue('background-image'), 'none')
    h.destroy()
    assert.equal(el.style.size, 0)
  }
})

test('a printed lift wears the picture on the element the whole way; ready rejects when the picture cannot decode', async () => {
  const { el, doc } = block(400, 200)
  doc.imageSize = [400, 200]
  const h = mount(el, lift(400, 200, 'top'), { print: { image: URL } })
  await h.ready
  assert.equal(el.style.getPropertyValue('background-image'), `var(--ori-grain), url("${URL}")`)
  h.destroy()
  assert.equal(el.style.size, 0)
  const bad = block(200, 200)
  bad.doc.imageFails = true
  await assert.rejects(mount(bad.el, cupboard(200, 200), { print: { image: '/missing.png' } }).ready)
  // No picture, nothing to wait for
  await mount(block(200, 200).el, cupboard(200, 200)).ready
})

test("print: 'content' prints a hidden clone of the element on every front, capped at CONTENT_FACES faces", () => {
  const { el, doc } = block(W, H, { backgroundColor: 'rgb(255, 255, 255)' })
  el.setAttribute('id', 'card')
  const title = doc.createElement('h3')
  title.textContent = 'A card'
  title.setAttribute('id', 'card-title')
  el.appendChild(title)
  const fold = blintz(W, H)
  const h = mount(el, fold, { print: 'content' })
  assert.equal(h.print, 'content')
  const clones = el.querySelectorAll('.ori-print-content')
  assert.equal(clones.length, fronts(el).length)
  for (const c of clones) {
    assert.equal(c.getAttribute('aria-hidden'), 'true')
    assert.equal(c.getAttribute('id'), null)
    assert.equal(c.querySelectorAll('[id]').length, 0)
    assert.equal(c.children[0]!.textContent, 'A card')
    assert.equal(c.style.width, `${W}px`)
    assert.ok(![...c.classList.set].some(n => n.startsWith('ori-') && n !== 'ori-print-content'))
    // On a front's sheet-sized paper, never on a back
    assert.ok(c.parentNode!.classList.contains('ori-face'))
    assert.ok(c.parentNode!.parentNode!.classList.contains('front'))
  }
  // The real content stays in the element for readers
  assert.ok(el.children.includes(title as FakeElement))
  h.destroy()
  // Past the cap, and on a lift (the element is its own print), it prints 'landed'
  const many = block(W, H)
  const pleats = accordion(W, H, CONTENT_FACES + 1, 'horizontal')
  const m = mount(many.el, pleats, { print: 'content' })
  assert.equal(m.print, 'landed')
  assert.equal(many.el.querySelectorAll('.ori-print-content').length, 0)
  assert.equal(mount(block(400, 200).el, lift(400, 200), { print: 'content' }).print, 'landed')
})

test('still: mounts flat and landed at once, with no flap and no transition, and builds the paper when it folds', async () => {
  const { el } = block(W, H)
  const fold = blintz(W, H)
  const h = mount(el, fold, { still: true })
  let landed = false
  void h.landed.then(() => { landed = true })
  assert.equal(h.t, 1)
  assert.equal(h.state, 'open')
  assert.ok(el.classList.contains('is-landed'))
  assert.ok(el.classList.contains('ori-scrub'))
  assert.equal(el.querySelectorAll('.ori-flap').length, 0)
  assert.equal(el.querySelectorAll('.ori-ground').length, 0)
  for (const n of [el, ...el.all()]) {
    assert.equal(n.style.getPropertyValue('transition'), '')
    const a = n.style.getPropertyValue('--ori-a')
    assert.ok(a === '' || a === '0deg', a)
  }
  // The creases that stay are there
  assert.equal(el.querySelectorAll('line').length, 4)
  await Promise.resolve()
  assert.ok(landed)
  // open() has nothing to do
  await h.open()
  assert.equal(el.querySelectorAll('.ori-flap').length, 0)
  // Folding builds the flaps, under the creases, and folds them
  h.set(0)
  assert.equal(el.querySelectorAll('.ori-flap').length, 4)
  const fold0 = el.querySelectorAll('.ori-fold')[0]!
  assert.equal(fold0.children[fold0.children.length - 1]!.getAttribute('class'), 'ori-creases')
  for (const f of el.querySelectorAll('.ori-flap')) assert.ok(Math.abs(Math.abs(parseFloat(f.style.getPropertyValue('--ori-a'))) - 180) < 1e-3)
  h.destroy()
})

test('a still printed mount wears the picture flat, and close() from still builds the paper flat before folding', async () => {
  const { el, doc } = block(W, H)
  doc.imageSize = [W, H]
  const h = mount(el, cupboard(W, H), { still: true, print: { image: URL }, drive: 'frame' })
  await h.ready
  assert.equal(el.style.getPropertyValue('background-image'), `var(--ori-grain), url("${URL}")`)
  const closing = h.close()
  assert.equal(el.querySelectorAll('.ori-flap').length, 2)
  // Built flat (the frame drive will write the angles as it closes) and printed
  for (const f of el.querySelectorAll('.ori-flap')) assert.equal(f.style.getPropertyValue('--ori-a'), '0deg')
  for (const side of fronts(el)) assert.equal(side.style.backgroundImage, `var(--ori-grain), url("${URL}")`)
  assert.equal(el.style.getPropertyValue('background-image'), 'none')
  h.destroy()
  await closing
})

// --- the WebGL driver

test('buildFold with a picture: each printed front\'s UVs are its sheet points over the sheet size, the backs unprinted', async () => {
  const fold = blintz(W, H)
  const tex = new DataTexture(new Uint8Array(W * H * 4), W, H, RGBAFormat)
  const h = buildFold(fold, { print: { image: tex } })
  await h.ready
  assert.deepEqual(h.printRect, { x: 0, y: 0, w: W, h: H })
  h.set(1)
  for (const face of fold.faces) {
    const mesh = h.faces.get(face.id) as Mesh
    const g = mesh.geometry
    const pos = g.getAttribute('position'), uv = g.getAttribute('uv'), color = g.getAttribute('color')
    for (let i = 0; i < pos.count; i++) {
      // Flat, the mesh's world matrix carries its vertex to the sheet point (y flipped)
      const v = new Vector3(pos.getX(i), pos.getY(i), 0).applyMatrix4(mesh.matrixWorld)
      near(uv.getX(i), v.x / W, 1e-4)
      near(uv.getY(i), 1 + v.y / H, 1e-4)
      // The vertex colors are white: the picture is the print
      for (let k = 0; k < 3; k++) near(color.array[i * 3 + k] as number, 1)
    }
    const m = mesh.material as MeshLambertMaterial
    assert.ok(m.defines && 'ORI_PRINT' in m.defines)
    assert.equal((m.userData.oriPrint as { oriPrint: { value: unknown } }).oriPrint.value, tex)
    const back = h.backs.get(face.id)!.material as MeshLambertMaterial
    assert.ok(!back.defines || !('ORI_PRINT' in back.defines))
  }
  // The caller's texture is the caller's to dispose
  let freed = false
  tex.addEventListener('dispose', () => { freed = true })
  h.dispose()
  assert.ok(!freed)
})

test('buildFold with a cropped picture places the UVs in its rect; without a print the fronts keep the grain in sheet units', async () => {
  const fold = cupboard(W, H)
  const h = buildFold(fold, { print: { image: new DataTexture(new Uint8Array(4 * 360 * 720), 360, 720, RGBAFormat) } })
  await h.ready
  const r = printRect(fold.sheet, { width: 360, height: 720 })
  assert.deepEqual(h.printRect, r)
  h.set(1)
  for (const [, mesh] of h.faces) {
    const pos = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv')
    for (let i = 0; i < pos.count; i++) {
      const v = new Vector3(pos.getX(i), pos.getY(i), 0).applyMatrix4(mesh.matrixWorld)
      const [u, w] = printUv([v.x, -v.y], r)
      near(uv.getX(i), u, 1e-4)
      near(uv.getY(i), w, 1e-4)
    }
  }
  const plain = buildFold(fold)
  for (const [, mesh] of plain.faces) assert.ok(!(mesh.material as MeshLambertMaterial).defines?.ORI_PRINT)
  assert.equal(plain.printRect, undefined)
  await plain.ready
})
