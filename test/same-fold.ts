// Test helper: two folds agree on everything a FOLD file carries. Not a test file itself.
import assert from 'node:assert/strict'
import type { Fold } from '../src/core/fold.ts'

/** Deep equality with numbers compared within eps: the file writes degrees and the import reads them back. */
function nearDeep(actual: unknown, expected: unknown, eps = 1e-9, path = '$'): void {
  if (typeof expected === 'number' && typeof actual === 'number') {
    assert.ok(Math.abs(actual - expected) < eps, `${path}: ${actual} is not ${expected}`)
  } else if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path}: not an array`)
    assert.equal(actual.length, expected.length, `${path}: length ${actual.length} is not ${expected.length}`)
    expected.forEach((e, i) => nearDeep(actual[i], e, eps, `${path}[${i}]`))
  } else if (expected && typeof expected === 'object') {
    assert.ok(actual && typeof actual === 'object', `${path}: not an object`)
    const a = actual as Record<string, unknown>, e = expected as Record<string, unknown>
    assert.deepEqual(Object.keys(a).sort(), Object.keys(e).sort(), `${path}: keys differ`)
    for (const k of Object.keys(e)) nearDeep(a[k], e[k], eps, `${path}.${k}`)
  } else {
    assert.equal(actual, expected, `${path}: ${String(actual)} is not ${String(expected)}`)
  }
}

const byId = <T extends { id: string }>(list: T[]) => [...list].sort((p, q) => p.id < q.id ? -1 : p.id > q.id ? 1 : 0)

/** The two folds agree on everything the file carries; crease order is the file's, so creases compare by id. */
export function sameFold(actual: Fold, expected: Fold): void {
  nearDeep(actual.faces, expected.faces, 1e-9, 'faces')
  nearDeep(byId(actual.creases), byId(expected.creases), 1e-9, 'creases')
  assert.equal(actual.root, expected.root)
  nearDeep(actual.sheet, expected.sheet, 1e-9, 'sheet')
  assert.deepEqual(actual.suits, expected.suits)
  assert.equal(actual.name, expected.name)
  nearDeep(actual.closures, expected.closures, 1e-9, 'closures')
  nearDeep(actual.schedule, expected.schedule, 1e-9, 'schedule')
}

