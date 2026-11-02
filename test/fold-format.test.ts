import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validate, type Fold } from '../src/core/fold.ts'
import { together } from '../src/core/schedule.ts'
import { pose } from '../src/core/pose.ts'
import { toFOLD, fromFOLD, type FOLD } from '../src/core/fold-format.ts'
import { waterbomb } from '../src/core/folds/index.ts'
import { sameFold } from './same-fold.ts'

// A 200 x 100 book fold: the right half folds over the left on a valley at x = 100.
const W = 200, H = 100
function book(): Fold {
  const fold: Fold = {
    name: 'test book',
    sheet: { width: W, height: H },
    root: 'a',
    faces: [{ id: 'a', pts: [[0, 0], [W / 2, 0], [W / 2, H], [0, H]] }, { id: 'b', pts: [[W / 2, 0], [W, 0], [W, H], [W / 2, H]] }],
    creases: [{ id: 'c1', a: [W / 2, 0], b: [W / 2, H], assignment: 'V', parent: 'a', child: 'b', closed: Math.PI }],
    suits: ['wide', 'tall'],
    extra: { file_author: 'test', 'edges_foo:bar': [1, 2, 3, 4, 5, 6, 7] },
  }
  fold.schedule = together(fold)
  return fold
}

// A 100 x 100 square split by a vertical edge, with no orkami keys: six vertices, seven edges, the crease last but two.
function plainSquare(): FOLD {
  return {
    vertices_coords: [[0, 0], [50, 0], [50, 100], [0, 100], [100, 0], [100, 100]],
    faces_vertices: [[0, 1, 2, 3], [1, 4, 5, 2]],
    edges_vertices: [[0, 1], [2, 3], [3, 0], [1, 4], [1, 2], [4, 5], [5, 2]],
    edges_assignment: ['B', 'B', 'B', 'B', 'V', 'B', 'B'],
  }
}

test('a book fold exports the FOLD subset with the closed state and orkami keys', () => {
  const out = toFOLD(book())
  assert.equal(out.file_spec, 1.2)
  assert.equal(out.file_creator, 'orkami')
  assert.equal(out.file_title, 'test book')
  assert.deepEqual(out.frame_classes, ['creasePattern'])
  assert.equal(out.vertices_coords!.length, 6)
  assert.equal(out.edges_vertices!.length, 7)
  assert.equal(out.edges_assignment!.length, 7)
  assert.equal(out.edges_foldAngle!.length, 7)
  assert.equal(out.faces_vertices!.length, 2)
  assert.deepEqual(out.faces_vertices, [[0, 1, 2, 3], [1, 4, 5, 2]])
  const creaseEdge = out.edges_assignment!.indexOf('V')
  assert.ok(creaseEdge >= 0)
  assert.deepEqual([...out.edges_vertices![creaseEdge]!].sort(), [1, 2])
  assert.equal(out.edges_foldAngle![creaseEdge], 180)
  out.edges_assignment!.forEach((a, e) => {
    if (e === creaseEdge) return
    assert.equal(a, 'B', `edge ${e}`)
    assert.equal(out.edges_foldAngle![e], 0, `edge ${e}`)
  })
  assert.deepEqual(out.faceOrders, [[1, 0, 1]])
  assert.deepEqual(out['faces_orkami:parent'], [null, 0])
  assert.deepEqual(out['faces_orkami:id'], ['a', 'b'])
  assert.deepEqual(out['edges_orkami:id'], out.edges_assignment!.map((a, e) => e === creaseEdge ? 'c1' : null))
  assert.equal(out['edges_orkami:start'] !== undefined, true)
  assert.equal(out['frame_orkami:total'], book().schedule!.total)
  assert.deepEqual(out['frame_orkami:sheet'], { width: W, height: H })
  assert.deepEqual(out['frame_orkami:suits'], ['wide', 'tall'])
  assert.equal(out['frame_orkami:closures'], undefined)
  assert.equal(out['faces_orkami:slot'], undefined)
  assert.equal(out['edges_orkami:closing'], undefined)
  assert.equal(out.file_author, 'test')
  assert.deepEqual(out['edges_foo:bar'], [1, 2, 3, 4, 5, 6, 7])

  const folded = out.file_frames![0]!
  assert.deepEqual(folded.frame_classes, ['foldedForm'])
  assert.deepEqual(folded.frame_attributes, ['3D'])
  assert.equal(folded.frame_parent, 0)
  assert.equal(folded.frame_inherit, true)
  assert.equal(folded.vertices_coords!.length, 6)
  for (const v of out.faces_vertices![1]!) {
    const p = folded.vertices_coords![v]!
    assert.equal(p.length, 3)
    assert.ok(p[0]! > -1e-9 && p[0]! < 100 + 1e-9, `vertex ${v} x ${p[0]} is not on face a`)
    assert.ok(Math.abs(p[2]!) < 1e-9, `vertex ${v} z ${p[2]} is not flat`)
  }
})

test('a book fold round-trips through FOLD', () => {
  const fold = book()
  const back = fromFOLD(toFOLD(fold))
  sameFold(back, fold)
  assert.equal(back.closures, undefined)
  assert.equal(back.schedule!.total, fold.schedule!.total)
  assert.deepEqual(back.extra, fold.extra)
  assert.deepEqual(validate(back), [])
})

test('a FOLD file with no orkami keys imports with face 0 as the root and a tree from adjacency', () => {
  const fold = fromFOLD(plainSquare())
  assert.equal(fold.root, 'f0')
  assert.deepEqual(fold.faces.map(f => f.id), ['f0', 'f1'])
  assert.equal(fold.creases.length, 1)
  const c = fold.creases[0]!
  assert.equal(c.id, 'e4')
  assert.equal(c.assignment, 'V')
  assert.equal(c.closed, Math.PI)
  assert.equal(c.parent, 'f0')
  assert.equal(c.child, 'f1')
  assert.equal(c.closing, undefined)
  assert.deepEqual(fold.sheet, { width: 100, height: 100 })
  assert.equal(fold.schedule, undefined)
  assert.equal(fold.extra, undefined)
  assert.deepEqual(validate(fold), [])
  const closed = pose(fold, 0)
  for (const p of closed.faces.f1!.pts) assert.ok(Math.abs(p[2]) < 1e-9, `z ${p[2]}`)
  const far = closed.faces.f1!.pts.filter((_, k) => fold.faces[1]!.pts[k]![0] === 100)
  assert.equal(far.length, 2)
  for (const p of far) assert.ok(Math.abs(p[0]) < 1e-9, `far edge x ${p[0]} is not 0`)
})

test('an import with only fold angles takes the assignment from their sign', () => {
  const file = plainSquare()
  delete file.edges_assignment
  file.edges_foldAngle = [0, 0, 0, 0, -180, 0, 0]
  const fold = fromFOLD(file)
  assert.equal(fold.creases.length, 1)
  assert.equal(fold.creases[0]!.assignment, 'M')
  assert.equal(fold.creases[0]!.closed, Math.PI)
  const flat = plainSquare()
  delete flat.edges_assignment
  flat.edges_foldAngle = [0, 0, 0, 0, 0, 0, 0]
  assert.equal(fromFOLD(flat).creases[0]!.assignment, 'F')
})

test('an unassigned interior edge and a cut edge cannot be imported', () => {
  const unassigned = plainSquare()
  delete unassigned.edges_assignment
  assert.throws(() => fromFOLD(unassigned), /cannot be posed: edge 4 is unassigned/)
  const explicit = plainSquare()
  explicit.edges_assignment![4] = 'U'
  assert.throws(() => fromFOLD(explicit), /edge 4 is unassigned/)
  const cut = plainSquare()
  cut.edges_assignment![4] = 'C'
  assert.throws(() => fromFOLD(cut), /cut/)
  const join = plainSquare()
  join.edges_assignment![4] = 'J'
  assert.throws(() => fromFOLD(join), /join/)
})

test('a creasePattern child frame is chosen as the pattern and inherits its parent', () => {
  const base = plainSquare()
  const file: FOLD = {
    faces_vertices: base.faces_vertices,
    edges_vertices: base.edges_vertices,
    file_author: 'someone',
    file_frames: [{
      frame_inherit: true,
      frame_parent: 0,
      frame_classes: ['creasePattern'],
      frame_attributes: ['3D'],
      vertices_coords: base.vertices_coords!.map(([x, y]) => [x!, y!, 7]),
      edges_assignment: base.edges_assignment,
    }],
  }
  const fold = fromFOLD(file)
  assert.equal(fold.faces.length, 2)
  assert.deepEqual(fold.faces[1]!.pts, [[50, 0], [100, 0], [100, 100], [50, 100]])
  assert.equal(fold.creases[0]!.assignment, 'V')
  assert.deepEqual(fold.extra, { file_author: 'someone' })
  assert.deepEqual(validate(fold), [])
  // A 3D frame that is not a crease pattern is not a pattern
  const solid: FOLD = { ...base, frame_classes: ['foldedForm'], vertices_coords: base.vertices_coords!.map(([x, y]) => [x!, y!, 7]) }
  assert.throws(() => fromFOLD(solid), /3D/)
})

test('a pattern with a negative coordinate is refused with a message about the origin', () => {
  const file = plainSquare()
  file.vertices_coords![0] = [-10, 0]
  assert.throws(() => fromFOLD(file), /origin at the top left/)
})

test('an imported waterbomb keeps its closing crease and closure', () => {
  const fold = waterbomb(100)
  const out = toFOLD(fold)
  assert.ok(out['edges_orkami:closing']!.some(c => c === true))
  assert.equal((out['frame_orkami:closures'] as unknown[]).length, 1)
  const back = fromFOLD(out)
  sameFold(back, fold)
  const closing = back.creases.find(c => c.closing)!
  assert.equal(closing.id, 'OC')
  assert.equal(closing.parent, 'Tr2')
  assert.equal(closing.child, 'T8')
  assert.deepEqual(back.closures, fold.closures)
  assert.deepEqual(validate(back), [])
  // Without the orkami keys the import still builds a closure for the loop
  const bare: FOLD = { vertices_coords: out.vertices_coords, edges_vertices: out.edges_vertices, edges_assignment: out.edges_assignment, faces_vertices: out.faces_vertices }
  const plain = fromFOLD(bare)
  assert.deepEqual(validate(plain), [])
  assert.equal(plain.creases.filter(c => c.closing).length, 1)
  assert.equal(plain.closures!.length, 1)
  assert.deepEqual(plain.closures![0]!.vertex, [50, 50])
  assert.deepEqual(plain.closures![0]!.solved, [])
  assert.ok(Number.isFinite(pose(plain, 0).angles[plain.closures![0]!.closing]))
})

test('a bar hinged inside the stem\'s edge exports as a T-junction so every edge matches up', () => {
  // A glyph strip: a 20 x 100 stem with a 40 x 20 bar hinged on the middle of its right edge
  const strip: Fold = {
    sheet: { width: 60, height: 100, cut: true },
    root: 'stem',
    faces: [
      { id: 'stem', pts: [[0, 0], [20, 0], [20, 100], [0, 100]], slot: 'lit' },
      { id: 'bar', pts: [[20, 40], [60, 40], [60, 60], [20, 60]], slot: 'shade' },
    ],
    creases: [{ id: 'hinge', a: [20, 40], b: [20, 60], assignment: 'M', parent: 'stem', child: 'bar', closed: Math.PI }],
  }
  assert.deepEqual(validate(strip), [])
  const out = toFOLD(strip)
  assert.equal(out.vertices_coords!.length, 8)
  assert.deepEqual(out.faces_vertices![0], [0, 1, 4, 7, 2, 3])
  assert.deepEqual(out.faces_vertices![1], [4, 5, 6, 7])
  assert.equal(out.edges_vertices!.length, 9)
  const hinge = out.edges_assignment!.indexOf('M')
  assert.deepEqual(out.edges_vertices![hinge], [4, 7])
  assert.equal(out.edges_foldAngle![hinge], -180)
  assert.equal(out.edges_assignment!.filter(a => a === 'B').length, 8)
  assert.deepEqual(out.faceOrders, [[1, 0, -1]])
  assert.deepEqual(out['faces_orkami:slot'], ['lit', 'shade'])
  assert.deepEqual(out['frame_orkami:sheet'], { width: 60, height: 100, cut: true })
  // The inserted vertices sit on the stem's edge in the closed pose too
  const folded = out.file_frames![0]!.vertices_coords!
  assert.deepEqual(folded[4], [20, 40, 0])
  assert.deepEqual(folded[7], [20, 60, 0])
  // The bar lies folded flat over the stem, behind it (a mountain)
  for (const v of [5, 6]) assert.ok(folded[v]![0]! < 20 + 1e-9 && Math.abs(folded[v]![2]!) < 1e-9, `vertex ${v}: ${folded[v]}`)
  const back = fromFOLD(out)
  assert.deepEqual(validate(back), [])
  assert.equal(back.faces[0]!.pts.length, 6)
  assert.deepEqual(back.faces[1]!.pts, strip.faces[1]!.pts)
  assert.deepEqual(back.faces.map(f => f.slot), ['lit', 'shade'])
  assert.deepEqual(back.creases, strip.creases)
  assert.deepEqual(back.sheet, strip.sheet)
})
