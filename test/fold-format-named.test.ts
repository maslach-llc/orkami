import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validate } from '../src/core/fold.ts'
import { toFOLD, fromFOLD } from '../src/core/fold-format.ts'
import { named, book, lift, cupboard, accordion, diagonal, kite } from '../src/core/folds/index.ts'
import { sameFold } from './same-fold.ts'

const wide = { book, lift, cupboard, accordion, diagonal, kite }

for (const [name, make] of Object.entries(named)) {
  test(`the ${name} fold on a 100 x 100 square round-trips through FOLD`, () => {
    const fold = make(100, 100)
    const out = toFOLD(fold)
    const back = fromFOLD(out)
    sameFold(back, fold)
    assert.deepEqual(validate(back), [])
    const fromJson = fromFOLD(JSON.parse(JSON.stringify(out)))
    sameFold(fromJson, fold)
    assert.deepEqual(validate(fromJson), [])
  })
}

for (const [name, make] of Object.entries(wide)) {
  test(`the ${name} fold on a 300 x 100 rectangle round-trips through FOLD`, () => {
    const fold = make(300, 100)
    const out = toFOLD(fold)
    const back = fromFOLD(out)
    sameFold(back, fold)
    assert.deepEqual(validate(back), [])
    const fromJson = fromFOLD(JSON.parse(JSON.stringify(out)))
    sameFold(fromJson, fold)
    assert.deepEqual(validate(fromJson), [])
  })
}
