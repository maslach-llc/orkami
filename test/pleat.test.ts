import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accordion } from '../src/core/folds/index.ts'
import { toFOLD, fromFOLD } from '../src/core/fold-format.ts'
import { pose } from '../src/core/pose.ts'
import { angleAt, foldedAt, transitionable, together } from '../src/core/schedule.ts'

const samples = Array.from({ length: 41 }, (_, i) => i / 40)

test('a pleat moves all its creases at once: the inner ones at twice the first crease, capped at folded', () => {
  const fold = accordion(150, 300, 5)
  const s = fold.schedule!
  for (const t of samples) {
    const f1 = foldedAt(s, 'c1', t)
    for (const id of ['c2', 'c3', 'c4', 'c5']) assert.ok(Math.abs(foldedAt(s, id, t) - Math.min(1, 2 * f1)) < 1e-12, `${id} at ${t}`)
  }
  assert.equal(foldedAt(s, 'c1', 0), 1)
  assert.equal(foldedAt(s, 'c3', 1), 0)
  assert.equal(transitionable(s), false)
  assert.equal(transitionable(together(fold)), true)
})

test('a pleat never goes under the sheet, and while it fans out its low creases rest on it', () => {
  for (const [n, axis] of [[3, 'horizontal'], [5, 'horizontal'], [4, 'vertical']] as const) {
    const fold = accordion(150, 300, n, axis)
    for (const t of samples) {
      const p = pose(fold, t)
      for (const f of Object.values(p.faces)) for (const v of f.pts) assert.ok(v[2] > -1e-6, `n=${n} ${axis} t=${t}: ${f.id} at z=${v[2]}`)
      // Fanning out (c1 under 90 degrees): the zigzag's low creases (c1, c3, c5, ...) lie on the table
      if (Math.abs(angleAt(fold, 'c1', fold.schedule!, t)) <= Math.PI / 2 + 1e-9) {
        for (let k = 3; k <= n; k += 2) {
          const c = fold.creases.find(x => x.id === `c${k}`)!
          const face = fold.faces.find(f => f.id === c.child)!
          const on = face.pts.map((q, i) => [q, i] as const).filter(([q]) => [c.a, c.b].some(e => Math.hypot(q[0] - e[0], q[1] - e[1]) < 1e-9))
          assert.equal(on.length, 2)
          for (const [, i] of on) assert.ok(Math.abs(p.faces[c.child]!.pts[i]![2]) < 1e-6, `n=${n} t=${t}: c${k} at z=${p.faces[c.child]!.pts[i]![2]}`)
        }
      }
    }
  }
})

test('the pleat follows round-trip through FOLD', () => {
  const fold = accordion(150, 300, 3)
  const back = fromFOLD(toFOLD(fold))
  assert.deepEqual(back.schedule!.creases.c2!.follow, { crease: 'c1', ratio: 2 })
  for (const t of [0, 0.3, 0.6, 1]) assert.ok(Math.abs(angleAt(back, 'c3', back.schedule!, t) - angleAt(fold, 'c3', fold.schedule!, t)) < 1e-12)
})
