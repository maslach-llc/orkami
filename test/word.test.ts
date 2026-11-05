// The word as one fold (D13), the page-hinged crease it needs, the `timed` schedule it is built
// with, and the flat SVG of the resting lockup.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validate, type Fold } from '../src/core/fold.ts'
import { lift } from '../src/core/folds/index.ts'
import { pose } from '../src/core/pose.ts'
import { timed } from '../src/core/schedule.ts'
import { DEFAULT_STYLE, shadowAt } from '../src/core/style.ts'
import { isIdentity } from '../src/core/space.ts'
import { FACET_STEP, LETTER_STEP, OVERLAP, layout, PACKET, wordFold, wordId, wordSvg } from '../src/glyphs/index.ts'

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`)

test('a crease on a page face may lie anywhere inside the page, not outside it', () => {
  const base = lift(200, 100)
  const inner: Fold = { ...base, creases: [{ ...base.creases[0]!, a: [0, 0], b: [200, 0] }] }
  assert.deepEqual(validate(inner), [])
  const page = base.faces.find(f => f.page)!
  // A page box around the block: the block's top edge lies inside it
  const big: Fold = { ...base, faces: [{ ...page, pts: [[-50, -150], [250, -150], [250, 50], [-50, 50]] }, base.faces[1]!] }
  assert.deepEqual(validate(big), [])
  // A hinge that leaves the page is still refused
  const out: Fold = { ...base, faces: [{ ...page, pts: [[0, -100], [100, -100], [100, 0], [0, 0]] }, base.faces[1]!] }
  assert.ok(validate(out).some(p => /not on the page/.test(p)))
})

test('timed: the given starts in ms, durations from reach, normalized with the total kept', () => {
  const fold = lift(240, 100)
  const s = timed(fold, { c1: 100 })
  near(s.creases.c1!.start * s.total, 100)
  assert.ok(s.total > 100)
  assert.throws(() => timed(fold, { nope: 0 }))
})

test('the word is one sound fold: the page, every letter hung on it by its own hinge at the packet tilt', () => {
  const fold = wordFold()
  const w = layout()
  assert.deepEqual(validate(fold), [])
  assert.equal(fold.root, 'page')
  assert.equal(fold.faces.length, w.faces.length + 1)
  for (const [i, letter] of w.letters.entries()) {
    const c = fold.creases.find(c => c.id === wordId(i, 'hinge'))!
    assert.equal(c.parent, 'page')
    assert.equal(c.child, wordId(i, letter.glyph.fold.root))
    assert.equal(c.assignment, 'V')
    near(c.closed, PACKET)
    assert.deepEqual(c.a, [letter.glyph.hinge[0][0] + letter.x, letter.glyph.hinge[0][1]])
  }
  // Letter i at i * 70 ms; its creases in the glyph's order, each OVERLAP of the way into the one before
  const s = fold.schedule!
  const ms = (id: string) => s.creases[id]!.start * s.total
  const run = (id: string) => s.creases[id]!.duration * s.total
  for (const [i, letter] of w.letters.entries()) {
    near(ms(wordId(i, 'hinge')), i * LETTER_STEP, 1e-6)
    const order = letter.glyph.order.map(c => wordId(i, c))
    near(ms(order[0]!), i * LETTER_STEP, 1e-6)
    for (let k = 1; k < order.length; k++) near(ms(order[k]!), ms(order[k - 1]!) + OVERLAP * run(order[k - 1]!), 1e-6)
  }
  // The seed's fixed step on request: the k-th crease of the order k * 60 ms after its letter
  const seed = wordFold('MASLACH', { step: FACET_STEP }).schedule!
  for (const [i, letter] of w.letters.entries()) letter.glyph.order.forEach((c, k) => near(seed.creases[wordId(i, c)]!.start * seed.total, i * LETTER_STEP + k * FACET_STEP, 1e-6))
  // Flat at t = 1, and the letters' slots carried over
  for (const p of Object.values(pose(fold, 1).faces)) assert.ok(isIdentity(p.matrix))
  assert.deepEqual(fold.faces.slice(1, 5).map(f => f.slot), ['lit', 'shade', 'lit2', 'shade2'])
  // packet 0: the strict rest state, a flat crease
  const flatPacked = wordFold('MA', { packet: 0 })
  assert.deepEqual(validate(flatPacked), [])
  assert.equal(flatPacked.creases.find(c => c.id === '0.hinge')!.assignment, 'F')
  assert.throws(() => wordFold('M', { packet: Math.PI }))
})

test('wordSvg draws the resting lockup from the style, with no DOM', () => {
  const svg = wordSvg('MASLACH', { id: 'x' })
  const w = layout()
  assert.equal(svg.viewBox, `0 0 ${w.width} ${w.height}`)
  assert.equal((svg.inner.match(/<polygon data-face/g) ?? []).length, w.faces.length)
  const shade = w.faces.filter(f => f.slot === 'shade' || f.slot === 'shade2').length
  assert.equal((svg.inner.match(/id="x-crease-/g) ?? []).length, shade)
  assert.equal((svg.inner.match(/<line /g) ?? []).length, w.faces.filter(f => f.crease).length)
  assert.ok(svg.inner.includes(`stop-color="${DEFAULT_STYLE.tones.lit[0].top}"`))
  const r = shadowAt(0)
  assert.ok(svg.inner.includes(`stdDeviation="${r.ambient.blur / 2}"`))
  assert.ok(svg.inner.includes(`stdDeviation="${r.contact.blur / 2}"`))
  assert.ok(svg.markup.includes('aria-hidden="true"'))
  assert.ok(wordSvg('M', { label: 'mark' }).markup.includes('role="img" aria-label="mark"'))
  const bare = wordSvg('M', { shadow: false, grain: false })
  assert.ok(!bare.inner.includes('feDropShadow') && !bare.inner.includes('feTurbulence'))
  assert.ok(wordSvg('M', { style: { tones: { lit: [{ top: 'var(--a)', bottom: 'var(--a)' }, { top: '#000', bottom: '#000' }] } } }).inner.includes('stop-color="var(--a)"'))
})

test('no two faces of a letter pass through each other anywhere in the word unfold', () => {
  type V = number[]
  const sub3 = (a: V, b: V) => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!]
  const cr = (a: V, b: V) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]
  const dt = (a: V, b: V) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
  // An edge of one face crossing the other's interior, clear of the shared edges and of the flat stack (half a unit)
  const crosses = (p: V, q: V, a: V, b: V, c: V) => {
    const n = cr(sub3(b, a), sub3(c, a)), L = Math.hypot(...n)
    const dp = dt(n, sub3(p, a)) / L, dq = dt(n, sub3(q, a)) / L
    if (dp * dq >= 0 || Math.abs(dp) < 0.5 || Math.abs(dq) < 0.5) return false
    const s = dp / (dp - dq), x = [p[0]! + s * (q[0]! - p[0]!), p[1]! + s * (q[1]! - p[1]!), p[2]! + s * (q[2]! - p[2]!)]
    const inside = (u: V, v: V) => dt(cr(sub3(v, u), sub3(x, u)), n) / Math.hypot(...sub3(v, u)) / L > 1.5
    return inside(a, b) && inside(b, c) && inside(c, a)
  }
  const hits = (A: V[], B: V[]) => [[A, B], [B, A]].some(([P, Q]) => P!.some((p, i) => Q!.slice(1, -1).some((_, j) => crosses(p, P![(i + 1) % P!.length]!, Q![0]!, Q![j + 1]!, Q![j + 2]!))))
  const fold = wordFold()
  const adjacent = new Set(fold.creases.flatMap(c => [`${c.parent}|${c.child}`, `${c.child}|${c.parent}`]))
  const faces = fold.faces.filter(f => !f.page)
  for (let k = 1; k < 120; k++) {
    const p = pose(fold, k / 120)
    for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
      const a = faces[i]!.id, b = faces[j]!.id
      if (a.split('.')[0] !== b.split('.')[0] || adjacent.has(`${a}|${b}`)) continue
      assert.ok(!hits(p.faces[a]!.pts, p.faces[b]!.pts), `${a} passes through ${b} at t = ${k / 120}`)
    }
  }
  // The check bites: with the overlap at .45 the S's side-right is still over its top when the top lifts
  const tight = wordFold('S', { overlap: 0.45 })
  const pt = (t: number) => pose(tight, t)
  assert.ok(Array.from({ length: 119 }, (_, k) => pt((k + 1) / 120)).some(p => hits(p.faces['0.top']!.pts, p.faces['0.side-right']!.pts)))
})
