import { test } from 'node:test'
import assert from 'node:assert/strict'
import { measureSheet, paintOffset, paintSheet, resolveSheet, trackSheet } from '../src/css/sheet.ts'
import { FOLDED_FACETS, foldedCreases, foldedSheetSvg, foldedToneColor, mixHex } from '../src/css/sheets/folded.ts'
import { block, FakeElement } from './fake-dom.ts'

const colors = { bg: '#f3f4f1', ink: '#0e1726', accent: '#8a8f99' }

test('the paint offset puts the sheet origin under the element: fixed sheets follow the scroll, scrolling ones do not', () => {
  // An element laid out at (40, 900) with the page scrolled to y = 700 sits at viewport y = 200
  assert.deepEqual(paintOffset(40, 900, 0, 700, 'fixed'), [-40, -200])
  assert.deepEqual(paintOffset(40, 900, 0, 700, 'scroll'), [-40, -900])
  assert.deepEqual(paintOffset(0, 0, 0, 0, 'fixed'), [-0, -0])
})

test('trackSheet writes --ori-sx/--ori-sy from the offset chain and the scroll, and lets go on untrack', () => {
  const { el, win, doc } = block(300, 200)
  el.offsetLeft = 50
  el.offsetTop = 1200
  el.offsetParent = doc.body
  win.scrollY = 1000
  const stop = trackSheet(el, 'fixed')
  assert.equal(el.style.getPropertyValue('--ori-sx'), '-50px')
  assert.equal(el.style.getPropertyValue('--ori-sy'), '-200px')
  win.scrollY = 1100
  measureSheet()
  assert.equal(el.style.getPropertyValue('--ori-sy'), '-100px')
  stop()
  assert.equal(el.style.getPropertyValue('--ori-sy'), '')
})

test('paintSheet registers the sheet and the paper color on the root', () => {
  const { doc, win } = block(10, 10)
  const root = doc.documentElement
  root.style.setProperty('--ori-bg', '#ffffff')
  paintSheet(undefined, { document: doc as unknown as Document })
  assert.ok(root.style.getPropertyValue('--ori-sheet').startsWith('url("data:image/svg+xml,'))
  assert.equal(root.style.getPropertyValue('--ori-paper'), '#ffffff')
  assert.equal(root.style.getPropertyValue('--ori-vw'), `${win.innerWidth}px`)
  paintSheet('#123456', { document: doc as unknown as Document })
  assert.equal(root.style.getPropertyValue('--ori-sheet'), 'none')
  assert.equal(root.style.getPropertyValue('--ori-paper'), '#123456')
  assert.ok(root instanceof FakeElement)
})

test('a sheet spec resolves to an image and a paper color', () => {
  assert.equal(resolveSheet('#abc', colors).image, 'none')
  assert.equal(resolveSheet('#abc', colors).color, '#abc')
  assert.equal(resolveSheet('url(paper.png)', colors).image, 'url(paper.png)')
  assert.equal(resolveSheet({ image: 'linear-gradient(red, blue)', color: '#000' }, colors).color, '#000')
  assert.ok(resolveSheet('<svg xmlns="http://www.w3.org/2000/svg"></svg>', colors).image.startsWith('url("data:image/svg+xml,'))
  assert.ok(resolveSheet({ svg: '<svg/>' }, colors).image.includes(encodeURIComponent('<svg/>')))
  assert.equal(resolveSheet(undefined, colors).color, colors.bg)
})

test('the folded sheet has seven facets, their creases drawn once, in tones a few percent off the page', () => {
  assert.equal(FOLDED_FACETS.length, 7)
  assert.equal(foldedCreases.length, 10)
  const svg = foldedSheetSvg(colors)
  assert.equal((svg.match(/<polygon/g) ?? []).length, 7)
  assert.ok(svg.includes('viewBox="0 0 1600 1000"'))
  assert.ok(svg.includes('rgba(14,23,38,0.06)'))
  assert.equal(mixHex('#000000', '#ffffff', 50), '#808080')
  assert.equal(mixHex('#ffffff', '#000000', 100), '#ffffff')
  assert.equal(foldedToneColor('l2', { ...colors, bg: '#000000' }), '#0a0a0a')
  assert.equal(foldedToneColor('s2', { ...colors, bg: '#ffffff' }), '#f6f6f6')
  assert.equal(foldedToneColor('b', { ...colors, bg: '#ffffff', accent: '#0000ff' }), '#f5f5ff')
})
