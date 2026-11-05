import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validate } from '../src/core/fold.ts'
import { pose } from '../src/core/pose.ts'
import { isIdentity, length, sub } from '../src/core/space.ts'
import { stackOrder } from '../src/core/stack.ts'
import { GLYPHS, HEIGHT, STRIP, glyph, layout, points, wordSvg } from '../src/glyphs/index.ts'

test('every glyph is a sound fold', () => {
  for (const g of Object.values(GLYPHS)) assert.deepEqual(validate(g.fold), [], g.char)
  assert.throws(() => glyph('Z'))
})

test('the word lays out as the seed did', () => {
  const w = layout('MASLACH')
  assert.equal(w.width, 2074)
  assert.equal(w.height, 270)
  assert.deepEqual(w.letters.map(l => l.x), [0, 452, 792, 1052, 1274, 1614, 1874])
  assert.deepEqual(w.letters.map(l => l.width), [400, 300, 220, 200, 300, 220, 200])
  assert.equal(layout('M').width, 400)
  assert.equal(layout('maslach').width, 2074)
  assert.deepEqual(layout('MxA').letters.map(l => l.char), ['M', 'A'])
  assert.equal(layout('').width, 0)
})

test('placed faces carry absolute polygons and hinges', () => {
  const w = layout('MA')
  const a = w.faces.filter(f => f.letter === 1)
  assert.deepEqual(a[0]!.abs, [[452, 270], [602, 0], [602, 148.3]])
  assert.deepEqual(a[0]!.hingeAbs, [[452, 270], [602, 0]])
  assert.equal(a[0]!.crease, null)
  assert.deepEqual(a[1]!.hingeAbs, [[602, 0], [602, 148.3]])
  assert.equal(a[1]!.crease!.id, 'stroke-right')
})

test('the slots alternate lit, shade, lit2, shade2 along the M', () => {
  const m = layout('M').faces
  assert.deepEqual(m.map(f => f.slot), ['lit', 'shade', 'lit2', 'shade2'])
  assert.deepEqual(m.map(f => f.face.id), ['leg-left', 'fold-left', 'fold-right', 'leg-right'])
  assert.deepEqual(layout('S').faces.map(f => f.slot), ['lit', 'shade', 'lit2', 'shade2', 'lit'])
})

test('each letter folds down onto its middle facet, the creases zigzagging out from it', () => {
  const m = glyph('M').fold
  assert.deepEqual(m.creases.map(c => [c.id, c.assignment, c.parent, c.child]), [
    ['leg-left', 'V', 'fold-left', 'leg-left'],
    ['fold-right', 'V', 'fold-left', 'fold-right'],
    ['leg-right', 'M', 'fold-right', 'leg-right'],
  ])
  assert.ok(m.creases.every(c => c.closed === Math.PI))
  assert.equal(m.root, 'fold-left')
  assert.deepEqual(glyph('M').hinge, [[200, 163], [200, 270]])
  assert.deepEqual(glyph('M').order, ['leg-right', 'fold-right', 'leg-left'])
  const roots = Object.fromEntries(Object.values(GLYPHS).map(g => [g.char, g.fold.root]))
  assert.deepEqual(roots, { M: 'fold-left', A: 'stroke-left', S: 'middle', L: 'stem', C: 'spine', H: 'bar' })
  for (const g of Object.values(GLYPHS)) assert.deepEqual([...g.order].sort(), g.fold.creases.map(c => c.id).sort(), g.char)
})

test('folded, every letter lies in its own place: the packet stays within a strip width of the letter', () => {
  for (const g of Object.values(GLYPHS)) {
    for (const p of Object.values(pose(g.fold, 0).faces)) {
      for (const [x, y, z] of p.pts) {
        assert.ok(Math.abs(z) < 1e-6, `${g.char} ${p.id} lies flat`)
        assert.ok(x > -STRIP && x < g.width + STRIP && y > -1e-6 && y < HEIGHT + 1e-6, `${g.char} ${p.id} at ${x}, ${y}`)
      }
    }
  }
})

test('overlapping flaps folded onto the same face stack, the later over the whole of the earlier', () => {
  assert.deepEqual(stackOrder(glyph('S').fold).layer, { middle: 0, 'side-left': 1, top: 2, 'side-right': 3, bottom: 4 })
  assert.deepEqual(stackOrder(glyph('C').fold).layer, { spine: 0, top: 1, bottom: 2 })
  assert.deepEqual(stackOrder(glyph('H').fold).layer, { bar: 0, 'stem-left': 1, 'stem-right': 1 }) // folded, the stems lie side by side over the bar
})


test('the M lies open at t = 1 and its last leg lies flat again at t = 0', () => {
  const m = glyph('M').fold
  const open = pose(m, 1)
  for (const f of m.faces) assert.ok(isIdentity(open.faces[f.id]!.matrix), f.id)
  const closed = pose(m, 0)
  for (const p of closed.faces['leg-right']!.pts) assert.ok(Math.abs(p[2]) < 1e-9, `z ${p[2]}`)
})

test('faces keep their shape half way through the unfold', () => {
  for (const g of Object.values(GLYPHS)) {
    const p = pose(g.fold, 0.5)
    for (const f of g.fold.faces) {
      const posed = p.faces[f.id]!.pts
      for (let i = 0; i < f.pts.length; i++) {
        const a = f.pts[i]!, b = f.pts[(i + 1) % f.pts.length]!
        const flat = Math.hypot(b[0] - a[0], b[1] - a[1])
        const l = length(sub(posed[(i + 1) % f.pts.length]!, posed[i]!))
        assert.ok(Math.abs(l - flat) < 1e-9, `${g.char} ${f.id} edge ${i}: ${l} is not ${flat}`)
      }
    }
  }
})

test('points rounds to a tenth', () => {
  assert.equal(points([[1.26, 2], [3, 4.04]]), '1.3,2 3,4')
})

test('wordSvg follows the style\'s shadows.on unless shadow is given', () => {
  assert.match(wordSvg('MA').markup, /feDropShadow/)
  assert.doesNotMatch(wordSvg('MA', { style: { shadows: { on: false } } }).markup, /feDropShadow/)
  assert.match(wordSvg('MA', { style: { shadows: { on: false } }, shadow: true }).markup, /feDropShadow/)
})
