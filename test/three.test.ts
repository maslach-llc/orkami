// The WebGL driver under Node: three's real classes, no WebGL context. The scene graph is
// checked against the core (the hinge axes, the angles, the world matrices against pose()),
// the paint against tone(), and dispose() by counting what it frees.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BasicShadowMap, PCFShadowMap, Quaternion, ShaderChunk, Vector3, type BufferGeometry, type Material, type Mesh, type WebGLRenderer } from 'three'
import { crease as creaseOf, face as faceOf, sign, type Fold } from '../src/core/fold.ts'
import { accordion, blintz, book, named, waterbomb, type NamedFold } from '../src/core/folds/index.ts'
import { hingeAxis, pose } from '../src/core/pose.ts'
import { stackOrder } from '../src/core/stack.ts'
import { brightness, parseHex, slotTone, style as makeStyle, tone } from '../src/core/style.ts'
import { glyph, layout, PACKET, wordFold, wordId } from '../src/glyphs/index.ts'
import { bleedFor, buildFold, contactChunk, parseColor, resources, shadowSoftness, stage } from '../src/three/index.ts'

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`)

test('three imports without a DOM', () => {
  assert.equal(typeof (globalThis as { document?: unknown }).document, 'undefined')
})

test('the blintz builds four groups under the root, hinged on the core\'s axes', () => {
  const fold = blintz(300, 300)
  const h = buildFold(fold)
  const kids = h.root.children.filter(o => o.type === 'Group')
  assert.equal(kids.length, 4)
  for (const id of ['tl', 'tr', 'br', 'bl']) {
    const g = h.groups.get(id)!
    assert.equal(g.parent, h.root)
    const c = creaseOf(fold, `c${['tl', 'tr', 'br', 'bl'].indexOf(id) + 1}`)
    const axis = hingeAxis(fold, c)
    h.set(0)
    // The group's origin is the crease's point (y flipped), lifted one layer over the root while closed (D12), none once flat
    near(h.groups.get(id)!.position.z, 0.5)
    h.set(1)
    near(h.groups.get(id)!.position.z, 0)
    near(g.position.x, axis.point[0])
    near(g.position.y, -axis.point[1])
    // At t = 1 the rotation is the identity; the axis it turns about is the core's, y flipped
    h.set(0.5)
    const q = g.quaternion
    const s = Math.sqrt(1 - q.w * q.w)
    near(Math.abs(q.x / s), Math.abs(axis.dir[0]), 1e-9)
    near(Math.abs(q.y / s), Math.abs(axis.dir[1]), 1e-9)
    near(q.z, 0, 1e-12)
  }
})

test('set(1) leaves every rotation at 0; set(0) at the closed angle with the assignment\'s sign', () => {
  for (const fold of [blintz(300, 300), book(360, 220), accordion(240, 500, 5)]) {
    const h = buildFold(fold)
    h.set(1)
    for (const [id, g] of h.groups) if (id !== fold.root) near(g.quaternion.angleTo(new Quaternion()), 0, 1e-12)
    h.set(0)
    for (const c of fold.creases) {
      const g = h.groups.get(c.child)!
      const axis = hingeAxis(fold, c)
      const expected = new Quaternion().setFromAxisAngle(new Vector3(axis.dir[0], -axis.dir[1], 0).normalize(), -sign(c.assignment) * c.closed)
      for (const k of ['x', 'y', 'z', 'w'] as const) near(g.quaternion[k], expected[k], 1e-9)
    }
  }
})

/** Every non-page face's vertices through its mesh's world matrix, against the core's posed vertices, y flipped. */
function matchesPose(fold: Fold, t: number) {
  const h = buildFold(fold, { layer: 0 })
  h.set(t)
  const p = pose(fold, t)
  for (const f of fold.faces) {
    if (f.page) { assert.equal(h.faces.get(f.id), undefined); continue }
    const mesh = h.faces.get(f.id)!
    const pos = mesh.geometry.getAttribute('position')
    // ShapeGeometry may reorder the polygon's vertices: compare as sets, every posed vertex drawn
    const posed = p.faces[f.id]!.pts
    const world = (i: number) => new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mesh.matrixWorld)
    const worlds = Array.from({ length: pos.count }, (_, i) => world(i))
    for (const [x, y, z] of posed) {
      const hit = worlds.some(v => Math.hypot(v.x - x, v.y + y, v.z - z) < 1e-6 * Math.max(fold.sheet.width, 1))
      assert.ok(hit, `${fold.name} ${f.id} at t=${t}: (${x}, ${y}, ${z}) not drawn`)
    }
    // And the normal: the front's +z through the world matrix is the core's normal, y flipped
    const n = new Vector3(0, 0, 1).transformDirection(mesh.matrixWorld)
    const cn = p.faces[f.id]!.normal
    near(n.x, cn[0], 1e-9); near(n.y, -cn[1], 1e-9); near(n.z, cn[2], 1e-9)
  }
}

test('the world matrices are the core\'s poses for every named fold and the wordmark', () => {
  for (const name of Object.keys(named) as NamedFold[]) {
    for (const t of [0, 0.3, 0.7, 1]) matchesPose(named[name](300, 300), t)
  }
  for (const t of [0, 0.25, 0.5, 1]) matchesPose(wordFold(), t)
})

test('the layer step follows stackOrder: closed flat, each face sits its layer times half a unit toward the visitor (D12)', () => {
  for (const fold of [accordion(240, 500, 5), blintz(300, 300), wordFold('MAS', { packet: 0 })]) {
    const stacked = buildFold(fold), exact = buildFold(fold, { layer: 0 })
    stacked.set(0); exact.set(0)
    const layers = stackOrder(fold).layer
    for (const f of fold.faces) {
      if (f.page) continue
      const at = (h: ReturnType<typeof buildFold>) => new Vector3().setFromMatrixPosition(h.faces.get(f.id)!.matrixWorld)
      const d = at(stacked).sub(at(exact))
      near(d.z, 0.5 * layers[f.id]!, 1e-9)
      near(d.x, 0, 1e-9); near(d.y, 0, 1e-9)
    }
  }
})

test('the paint is tone(): vertex colors the print, the lights k = ka + kd max(0, L . N)', () => {
  const fold = wordFold('MA')
  const s = makeStyle()
  const h = buildFold(fold, { style: s })
  const fake = { setPixelRatio() {}, setClearColor() {}, shadowMap: {}, render() {}, setSize() {}, dispose() {} } as unknown as WebGLRenderer
  const st = stage({} as HTMLCanvasElement, { width: fold.sheet.width, height: fold.sheet.height, renderer: fake })
  st.add(h)
  const L = st.light.position.clone().sub(st.light.target.position).normalize()
  for (const t of [0, 0.4, 1]) {
    h.set(t)
    st.scene.updateMatrixWorld(true)
    const p = pose(fold, t)
    for (const f of fold.faces) {
      if (f.page) continue
      const mesh = h.faces.get(f.id)!
      const n = new Vector3(0, 0, 1).transformDirection(mesh.matrixWorld)
      const k = (st.ambient.intensity + st.light.intensity * Math.max(0, n.dot(L))) / Math.PI
      near(k, brightness(f, p, s), 2e-3)
      // The front's vertex colors are the print's gradient over the sheet's height
      const col = mesh.geometry.getAttribute('color'), pos = mesh.geometry.getAttribute('position')
      const print = slotTone(s, f.slot)
      const top = parseHex(print.top), bottom = parseHex(print.bottom)
      const want = tone(f, p, s)
      // At a vertex on the sheet's top or bottom edge, the shaded vertex color is tone()'s end
      const sheetY = (i: number) => -new Vector3(pos.getX(i), pos.getY(i), 0).add(groupOrigin(h, f.id)).y
      for (let i = 0; i < col.count; i++) {
        const y = sheetY(i)
        const frac = y / fold.sheet.height
        for (let c = 0; c < 3; c++) near([col.getX(i), col.getY(i), col.getZ(i)][c]!, (top[c]! + (bottom[c]! - top[c]!) * frac) / 255, 1e-6)
        if (Math.abs(y) < 1e-9 || Math.abs(y - fold.sheet.height) < 1e-9) {
          const end = parseHex(Math.abs(y) < 1e-9 ? want.top : want.bottom)
          const drawn = [col.getX(i), col.getY(i), col.getZ(i)].map(v => Math.min(255, Math.round(v * k * 255)))
          for (let c = 0; c < 3; c++) near(drawn[c]!, end[c]!, 1)
        }
      }
    }
  }
  st.dispose()
  h.dispose()
})

/** The sheet point (scene axes) at a face's group origin: the sum of the positions up the tree at layer 0. */
function groupOrigin(h: ReturnType<typeof buildFold>, id: string): Vector3 {
  const out = new Vector3()
  let g = h.groups.get(id)!
  while (g !== h.root) {
    out.add(new Vector3(g.position.x, g.position.y, 0))
    g = g.parent as typeof g
  }
  return out
}

test('the wordmark: one group per facet, each letter hung on the page by its own edge at the packet tilt', () => {
  const fold = wordFold()
  const w = layout()
  const h = buildFold(fold)
  assert.equal(h.groups.size, w.faces.length + 1)
  assert.equal(h.faces.size, w.faces.length)
  h.set(0)
  for (const [i, letter] of w.letters.entries()) {
    const rootId = wordId(i, letter.glyph.fold.root)
    const g = h.groups.get(rootId)!
    // Hung on the page (the root group), not on the letter before
    assert.equal(g.parent, h.root)
    near(g.quaternion.angleTo(new Quaternion()), PACKET, 1e-9)
    const [a, b] = glyph(letter.char).hinge
    const axis = new Vector3(b[0] - a[0], -(b[1] - a[1]), 0).normalize()
    const q = g.quaternion, s = Math.sqrt(1 - q.w * q.w)
    near(Math.abs(new Vector3(q.x / s, q.y / s, q.z / s).dot(axis)), 1, 1e-9)
    near(g.position.x, a[0] + letter.x)
  }
  // The root facets lift off the page: the far side of each letter rises toward the visitor
  const p = pose(fold, 0)
  for (const [i, letter] of w.letters.entries()) {
    const z = Math.max(...p.faces[wordId(i, letter.glyph.fold.root)]!.pts.map(v => v[2]))
    assert.ok(z > 10, `${letter.char} lifts ${z}`)
  }
  h.set(1)
  for (const g of h.groups.values()) near(g.quaternion.angleTo(new Quaternion()), 0, 1e-12)
  // packet 0 lays the packets flat: D1's strict rest state
  const flatPacked = buildFold(wordFold('MASLACH', { packet: 0 }))
  for (const [i, letter] of w.letters.entries()) near(flatPacked.groups.get(wordId(i, letter.glyph.fold.root))!.quaternion.angleTo(new Quaternion()), 0, 1e-12)
})

test('dispose() frees every geometry, material and texture it made', () => {
  for (const fold of [blintz(300, 300), wordFold()]) {
    const h = buildFold(fold)
    const { geometries, materials } = resources(h)
    const sheetFaces = fold.faces.filter(f => !f.page).length
    const sheetCreases = fold.creases.filter(c => !faceOf(fold, c.parent).page).length
    assert.equal(geometries.size, 2 * sheetFaces + sheetCreases)
    const lineColors = new Set(fold.creases.filter(c => !faceOf(fold, c.parent).page).map(c => /shade/.test(faceOf(fold, c.child).slot ?? '') ? 'shade' : 'lit')).size
    assert.equal(materials.size, 2 * sheetFaces + lineColors)
    let freed = 0
    const count = (x: BufferGeometry | Material) => x.addEventListener('dispose', () => { freed++ })
    geometries.forEach(count)
    materials.forEach(count)
    let maps = 0
    const map = (materials.values().next().value as Mesh['material'] & { map?: { addEventListener: (e: 'dispose', f: () => void) => void } }).map
    map?.addEventListener('dispose', () => { maps++ })
    const parent = h.root.parent
    h.dispose()
    assert.equal(freed, geometries.size + materials.size)
    assert.equal(maps, 1)
    assert.equal(h.root.parent, parent)
  }
})

test('the crease hairlines come in over the last third and use the style\'s colors', () => {
  const fold = glyph('M').fold
  const h = buildFold(fold)
  assert.equal(h.lines.size, fold.creases.length)
  h.set(0.5)
  for (const l of h.lines.values()) assert.equal((l.material as Material).opacity, 0)
  h.set(1)
  const lit = parseColor('rgb(0 0 0 / .3)'), shade = parseColor('rgb(255 255 255 / .4)')
  assert.deepEqual(lit, { rgb: [0, 0, 0], alpha: 0.3 })
  assert.deepEqual(shade, { rgb: [1, 1, 1], alpha: 0.4 })
  for (const [id, l] of h.lines) {
    const m = l.material as Material & { color: { r: number } }
    // On shade where the crease is a shade face's seam (the seed's: the crease that face hung on)
    const isShade = id !== 'fold-right'
    near(m.opacity, isShade ? 0.4 : 0.3)
    near(m.color.r, isShade ? 1 : 0)
  }
})

test('the stage: the light from the style, the bleed from the poses, the shadow softening with height', () => {
  const fold = blintz(300, 300)
  const s = makeStyle()
  const fake = { setPixelRatio() {}, setClearColor() {}, shadowMap: {}, render() {}, setSize() {}, dispose() {} } as unknown as WebGLRenderer
  const [bx, by] = bleedFor(fold)
  assert.ok(bx > 0 && by > 0)
  const st = stage({} as HTMLCanvasElement, { width: 300, height: 300, bleed: [bx, by], renderer: fake })
  const L = st.light.position.clone().normalize()
  near(L.x, s.light.direction[0], 1e-3); near(L.y, -s.light.direction[1], 1e-3); near(L.z, s.light.direction[2], 1e-3)
  near(st.ambient.intensity, s.light.ambient * Math.PI)
  near(st.light.intensity, s.light.diffuse * Math.PI)
  near(st.camera.position.z, 1000)
  near(shadowSoftness(0, s), s.shadows.contact.blur / 2)
  assert.ok(shadowSoftness(100, s) > shadowSoftness(10, s))
  st.dispose()
})

test('the contact-hardening shadow: the basic getShadow replaced, the receivers patched, the blocker search sized from the highest face', () => {
  const chunk = ShaderChunk.shadowmap_pars_fragment
  const patched = contactChunk(chunk)
  // Only the basic branch's function changes: VSM's (same signature) stays three's own
  assert.equal((patched.match(/float\s+getShadow\s*\(\s*sampler2D\s+shadowMap\b/g) ?? []).length, 2)
  assert.ok(patched.includes('oriShadowSoft') && patched.includes('p_max'))
  assert.ok(patched.indexOf('oriShadowSoft') > patched.indexOf('SHADOWMAP_TYPE_VSM'))
  assert.throws(() => contactChunk('no shadow code here'), /no basic getShadow/)
  const s = makeStyle()
  const fake = { setPixelRatio() {}, setClearColor() {}, shadowMap: {}, render() {}, setSize() {}, dispose() {} } as unknown as WebGLRenderer
  const st = stage({} as HTMLCanvasElement, { width: 200, height: 200, renderer: fake })
  assert.equal(st.renderer.shadowMap.type, BasicShadowMap)
  assert.equal((st.floor.material as Material).userData.oriContact, true)
  const h = buildFold(book(200, 200))
  st.add(h)
  const receivers: Material[] = []
  h.root.traverse(o => { const m = o as Mesh; if (m.isMesh && m.receiveShadow) receivers.push(m.material as Material) })
  assert.ok(receivers.length > 0)
  for (const m of receivers) assert.equal(m.userData.oriContact, true)
  // A program compiled for the patched material carries the uniforms the stage updates
  const shader = { uniforms: {}, fragmentShader: '#include <shadowmap_pars_fragment>', vertexShader: '' } as unknown as Parameters<Material['onBeforeCompile']>[0]
  receivers[0]!.onBeforeCompile(shader, fake)
  assert.ok('oriShadowSoft' in shader.uniforms && shader.fragmentShader.includes('oriShadowRange'))
  h.set(0.3)
  st.render()
  const soft = (shader.uniforms as Record<string, { value: number[] }>).oriShadowSoft!.value
  near(soft[0]!, s.shadows.contact.blur / 2)
  near(soft[2]!, 2 * shadowSoftness(h.height, s) + s.shadows.contact.blur)
  const pcf = stage({} as HTMLCanvasElement, { width: 200, height: 200, renderer: { ...fake, shadowMap: {} } as unknown as WebGLRenderer, shadowFilter: 'pcf' })
  assert.equal(pcf.renderer.shadowMap.type, PCFShadowMap)
  assert.equal((pcf.floor.material as Material).userData.oriContact, undefined)
  st.dispose(); pcf.dispose()
})

test('play runs t to 1 (and back) on the clock and calls onDone', async () => {
  const fold = book(200, 100)
  const h = buildFold(fold)
  const fake = { setPixelRatio() {}, setClearColor() {}, shadowMap: {}, render() {}, setSize() {}, dispose() {} } as unknown as WebGLRenderer
  const st = stage({} as HTMLCanvasElement, { width: 200, height: 100, renderer: fake })
  st.add(h)
  let done = 0
  await st.play(h, 60, () => { done++ })
  assert.equal(h.t, 1)
  await st.play(h, 60, () => { done++ }, 0)
  assert.equal(h.t, 0)
  assert.equal(done, 2)
  st.dispose()
})

test('waterbomb: the closure solved by the core is what the groups show', () => {
  matchesPose(waterbomb(300), 0.5)
})

test('shadows off (style.shadows.on false): no shadow map, no floor, no face casts or receives', () => {
  const off = { shadows: { on: false } }
  const fake = { setPixelRatio() {}, setClearColor() {}, shadowMap: {}, render() {}, setSize() {}, dispose() {} } as unknown as WebGLRenderer
  const st = stage({} as HTMLCanvasElement, { width: 200, height: 200, renderer: fake, style: off })
  assert.equal(st.renderer.shadowMap.enabled, false)
  assert.equal(st.light.castShadow, false)
  assert.equal(st.floor.visible, false)
  const h = buildFold(book(200, 200), { style: off })
  st.add(h)
  for (const t of [0, 0.5, 1]) {
    h.set(t)
    h.root.traverse(o => { const m = o as Mesh; if (m.isMesh) assert.ok(!m.castShadow && !m.receiveShadow) })
  }
  st.dispose()
})
