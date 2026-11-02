import { test } from 'node:test'
import assert from 'node:assert/strict'
import { backTone, brightness, creaseGradient, DEFAULT_STYLE, faceHeight, flat, occlusion, parseHex, shadowAt, style, tone } from '../src/core/style.ts'
import { assertValid, crease as creaseOf, face as faceOf, type Fold } from '../src/core/fold.ts'
import { pose, poseAngles, type Pose } from '../src/core/pose.ts'
import { IDENTITY4, type Vec3 } from '../src/core/space.ts'
import { glyph } from '../src/glyphs/index.ts'

// A 100 x 100 sheet folded in half on a vertical crease; the right half turns.
const book = (): Fold => assertValid({
  name: 'book',
  sheet: { width: 100, height: 100 },
  faces: [
    { id: 'left', pts: [[0, 0], [50, 0], [50, 100], [0, 100]] },
    { id: 'right', pts: [[50, 0], [100, 0], [100, 100], [50, 100]] },
  ],
  creases: [{ id: 'spine', a: [50, 0], b: [50, 100], assignment: 'V', parent: 'left', child: 'right', closed: Math.PI }],
  root: 'left',
})

/** A pose whose one face has the given normal; only the normal matters to the tone rules. */
const posedNormal = (id: string, normal: Vec3): Pose => ({ t: NaN, faces: { [id]: { id, matrix: IDENTITY4, chain: [], pts: [], normal } }, angles: {} })

const near = (a: number, b: number, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`)

test('the default style is the Paper light tones under the one light', () => {
  assert.deepEqual(DEFAULT_STYLE.tones.lit, [{ top: '#FFFFFF', bottom: '#E6E6E6' }, { top: '#F8F8F5', bottom: '#DEDEDC' }])
  assert.deepEqual(DEFAULT_STYLE.tones.shade, [{ top: '#E4E5E0', bottom: '#CBCBC6' }, { top: '#CED0CA', bottom: '#B5B7B0' }])
  assert.deepEqual(DEFAULT_STYLE.tones.back, { top: '#f3f4f1', bottom: '#f3f4f1' })
  assert.deepEqual(DEFAULT_STYLE.light, { direction: [-0.346, -0.538, 0.769], ambient: 0.35, diffuse: 0.85 })
})

test('the shadow at height 0 is the resting stack', () => {
  // The plan doc said "the seed's two feDropShadow values", but docs/design/02-look.md makes the
  // Figma stack the reference; the seed's values (dy 14 blur 28 at .2, dy 2 blur 4 at .16) differ slightly.
  assert.deepEqual(shadowAt(0), {
    contact: { offset: [0, 2], blur: 4, opacity: 0.14 },
    ambient: { offset: [0, 16], blur: 32, spread: -6, opacity: 0.22 },
  })
})

test('the shadow drifts, softens and thins with height, and the contact layer is gone by the fade', () => {
  let prev = shadowAt(0)
  for (let h = 10; h <= 400; h += 10) {
    const s = shadowAt(h)
    assert.ok(s.ambient.offset[1] >= prev.ambient.offset[1], `ambient offset y falls at ${h}`)
    assert.ok(s.ambient.blur >= prev.ambient.blur, `ambient blur falls at ${h}`)
    assert.ok(s.ambient.opacity <= prev.ambient.opacity, `ambient opacity rises at ${h}`)
    assert.ok(s.contact.opacity <= prev.contact.opacity, `contact opacity rises at ${h}`)
    if (h >= 24) assert.equal(s.contact.opacity, 0)
    prev = s
  }
  assert.equal(shadowAt(24).contact.opacity, 0)
  assert.equal(shadowAt(-5).contact.opacity, shadowAt(0).contact.opacity)
})

test('the crease gradient reproduces the seed stops at strength .46 and depth .6', () => {
  const g = glyph('M')
  const face = faceOf(g.fold, 'fold-left'), crease = creaseOf(g.fold, 'fold-left')
  const s = style({ crease: { gradient: { strength: 0.46, depth: 0.6 } } })
  assert.equal(s.crease.gradient.occlusion, 0.12)
  assert.equal(s.grain.octaves, 3)
  const cg = creaseGradient(face, crease, s)
  assert.deepEqual(cg.stops.map(st => st.offset), [0, 0.6, 1])
  near(cg.stops[0]!.opacity, 0.46)
  near(cg.stops[1]!.opacity, 0.1)
  near(cg.stops[2]!.opacity, 0.18)
  // mid of (0,0)-(112,190) is (56, 95); the centroid of the four points is (128, 155.75)
  assert.deepEqual(cg.from, [56, 95])
  near(cg.to[0], 56 + (128 - 56) * 2.2)
  near(cg.to[1], 95 + (155.75 - 95) * 2.2)
})

test('a face at rest shows its print', () => {
  // The seed's flat tokens --ori-1..4 as the four slots; a flat face has k = .35 + .85 * .769 = 1.0035,
  // so each channel may round up by one.
  const print = { lit: '#5d72e3', shade: '#16213a', lit2: '#2f49d1', shade2: '#0b0f1a' }
  const s = style({ tones: { lit: [flat(print.lit), flat(print.lit2)], shade: [flat(print.shade), flat(print.shade2)] } })
  const g = glyph('M')
  const p = pose(g.fold, 1)
  for (const face of g.fold.faces) {
    near(brightness(face, p, s), 1.0035, 1e-3)
    const want = parseHex(print[face.slot!])
    const t = tone(face, p, s)
    for (const c of [t.top, t.bottom]) {
      const got = parseHex(c)
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(got[i]! - want[i]!) <= 1, `${face.id}: ${c} is not within 1 of ${print[face.slot!]}`)
    }
  }
})

test('a face edge-on to the light drops to .35 of its print and one facing it rises to 1.2', () => {
  const s = style({ tones: { lit: [flat('#808080'), flat('#808080')] } })
  const face = { id: 'f', pts: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][] }
  // L . N = 0: perpendicular to the light
  const edgeOn = posedNormal('f', [0.769, 0, 0.346])
  near(brightness(face, edgeOn, s), 0.35)
  assert.equal(tone(face, edgeOn, s).top, '#2d2d2d') // 128 * .35 = 44.8
  const facing = posedNormal('f', [-0.346, -0.538, 0.769])
  near(brightness(face, facing, s), 1.2, 1e-9)
  assert.equal(tone(face, facing, s).top, '#9a9a9a') // 128 * 1.2 = 153.6
  const bright = style({ tones: { lit: [flat('#ffffff'), flat('#ffffff')] } })
  assert.equal(tone(face, facing, bright).top, '#ffffff') // clamped
})

test('the back of a flat face is lit by the reversed normal', () => {
  const s = style({ tones: { back: flat('#c8c8c8') } })
  const face = { id: 'f', pts: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][] }
  assert.equal(backTone(face, posedNormal('f', [0, 0, 1]), s).top, '#464646') // 200 * .35 = 70
})

test('a moving half has a height and the root has none', () => {
  const fold = book()
  const half = pose(fold, 0.5)
  assert.ok(faceHeight(fold, half, 'right') > 0)
  assert.equal(faceHeight(fold, half, 'left'), 0)
  const open = pose(fold, 1)
  assert.equal(faceHeight(fold, open, 'right'), 0)
  assert.equal(faceHeight(fold, open, 'left'), 0)
  // The half folded straight up stands 50 high
  near(faceHeight(fold, poseAngles(fold, { spine: Math.PI / 2 }), 'right'), 50, 1e-9)
})

test('the occlusion at a crease grows from nothing when flat to the full value at 180', () => {
  assert.equal(occlusion(0), 0)
  near(occlusion(Math.PI), 0.12)
  near(occlusion(-Math.PI), 0.12)
  near(occlusion(Math.PI / 2), 0.06)
})
