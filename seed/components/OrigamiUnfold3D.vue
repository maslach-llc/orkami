<script setup lang="ts">
// The wordmark unfolding as real paper: the same facet tree OrigamiUnfold swings with CSS, but
// as lit geometry in three.js, so a facet gets brighter and darker as it turns and casts a soft
// shadow on the page while it lifts. Every facet is a flat shape hinged on the crease it shares
// with its parent (a Group at the crease, the child groups nested inside, so a crease opening
// carries everything folded beyond it); the first facet of the mark hinges on its left edge, so
// the whole lockup lifts off the sheet. The front of a facet is its brand color, the back the
// page's own paper.
//
// The canvas exists only while the unfold plays: the resting lockup is OrigamiWord (the flat
// SVG, server rendered and what no-JS and reduced-motion visitors see), hidden under the canvas
// during the play and cross-faded in at the end, when the 3D word lies flat and matches it.
// three.js is imported on the client, on first play, so pages that never play pay nothing.
// Same props and API as OrigamiUnfold: `autoplay`, `delay`, `letterStep`, `step`, `duration`,
// `play()`, `show()`, `done`.
import { layout, type Pt } from '~/utils/origami'
import type * as THREE from 'three'

const props = withDefaults(defineProps<{
  text?: string
  label?: string
  autoplay?: boolean
  /** ms before an autoplay starts, so the page can settle first. */
  delay?: number
  /** ms between one letter starting and the next. */
  letterStep?: number
  /** ms between one crease of a letter opening and the next. */
  step?: number
  /** ms one crease takes to open. */
  duration?: number
}>(), { text: 'MASLACH', label: 'Maslach', autoplay: true, delay: 200, letterStep: 70, step: 60, duration: 760 })

const emit = defineEmits<{ done: [] }>()

const word = computed(() => layout(props.text))
const W = computed(() => word.value.width)
const H = computed(() => word.value.height)
// The canvas bleeds past the word's box: a facet swinging about its crease reaches outside it
const MX = computed(() => W.value * 0.2)
const MY = computed(() => H.value * 0.75)

interface Face {
  f: ReturnType<typeof layout>['facets'][number]
  children: Face[]
  /** Start of this crease's opening, ms from play(). */
  at: number
  /** The crease this face swings on, in word space. */
  hinge: [Pt, Pt]
  /** How far closed this crease starts: a full half turn for a facet folded over its parent,
   * a slight tilt for a letter's first facet, which lies on the page where the letter is. */
  closed: number
}
// A letter's first facet is the folded packet lying in the letter's own spot; it only settles
// flat while the others open out of it, so each letter unfolds where it is
const PACKET = Math.PI * 0.08
const tree = computed(() => {
  const roots: Face[] = []
  const byLetter = new Map<number, Face[]>()
  let total = 0
  for (const f of word.value.facets) {
    const at = f.letter * props.letterStep + f.index * props.step
    const face: Face = { f, children: [], at, hinge: f.hingeAbs, closed: f.parent < 0 ? PACKET : Math.PI }
    const list = byLetter.get(f.letter) ?? []
    list.push(face)
    byLetter.set(f.letter, list)
    if (f.parent < 0) roots.push(face)
    else list[f.parent]!.children.push(face)
    total = Math.max(total, at + props.duration)
  }
  return { roots, total }
})

// Paper swings over fast and settles into flat (the CSS version's cubic-bezier(.4, .1, .2, 1))
function ease(t: number) {
  const [x1, y1, x2, y2] = [0.4, 0.1, 0.2, 1]
  const bx = (u: number) => 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3
  const by = (u: number) => 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3
  let lo = 0, hi = 1, u = t
  for (let i = 0; i < 24; i++) { u = (lo + hi) / 2; if (bx(u) < t) lo = u; else hi = u }
  return by(u)
}

const box = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const playing = ref(false)
const open = ref(false)
// The canvas fading out over the flat SVG at the end of a play
const landing = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let frame = 0

// --- the scene, built on first play
interface Hinge { group: THREE.Group, axis: THREE.Vector3, face: Face }
let three: typeof THREE | undefined
let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let hinges: Hinge[] = []
let fronts: THREE.MeshStandardMaterial[] = []
let back: THREE.MeshStandardMaterial | undefined

// Word space is y down with the origin at the top left; the scene is y up, centered
const toScene = (p: Pt) => [p[0] - W.value / 2, H.value / 2 - p[1]] as const

async function build() {
  if (renderer) return true
  const T = three ??= await import('three')
  if (!canvas.value) return false
  try {
    renderer = new T.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true })
  }
  catch { return false }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFShadowMap
  renderer.toneMapping = T.NoToneMapping
  scene = new T.Scene()

  // The camera looks straight at the word; its view at z = 0 is the bled canvas exactly, with
  // mild perspective (a little over two word widths away, the CSS version's perspective)
  const vw = W.value + 2 * MX.value, vh = H.value + 2 * MY.value
  const dist = W.value * 2.2
  camera = new T.PerspectiveCamera(2 * Math.atan(vh / 2 / dist) * 180 / Math.PI, vw / vh, dist / 10, dist * 4)
  camera.position.set(0, 0, dist)
  camera.lookAt(0, 0, 0)

  // One soft light from the upper left and in front (the light the flat lockup's lit and shaded
  // facets assume), a fill so nothing goes black, tuned so a flat facet shows its token color
  const sun = new T.DirectionalLight(0xffffff, 1.0)
  sun.position.set(-0.45, 0.7, 1).normalize().multiplyScalar(dist)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -vw / 2
  sun.shadow.camera.right = vw / 2
  sun.shadow.camera.top = vh / 2
  sun.shadow.camera.bottom = -vh / 2
  sun.shadow.camera.near = dist / 4
  sun.shadow.camera.far = dist * 2
  sun.shadow.bias = -0.0005
  sun.shadow.radius = 4
  scene.add(sun, new T.AmbientLight(0xffffff, 0.3))

  // The page under the word catches the shadows
  const floor = new T.Mesh(new T.PlaneGeometry(vw, vh), new T.ShadowMaterial({ opacity: 0.22, transparent: true }))
  floor.position.z = -2
  floor.receiveShadow = true
  scene.add(floor)

  back = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, side: T.BackSide })
  hinges = []
  fronts = []
  const add = (face: Face, parent: THREE.Object3D, parentA: Pt) => {
    const [a, b] = face.hinge
    const group = new T.Group()
    const [ax, ay] = toScene(a), [px, py] = toScene(parentA)
    group.position.set(ax - px, ay - py, 0)
    // The crease as an axis, pointed so the facet swings toward the viewer (rises in z)
    const [bx, by] = toScene(b)
    const axis = new T.Vector3(bx - ax, by - ay, 0).normalize()
    const c = face.f.abs.reduce<Pt>((s, p) => [s[0] + p[0] / face.f.abs.length, s[1] + p[1] / face.f.abs.length], [0, 0])
    const [cx, cy] = toScene(c)
    if (axis.x * (cy - ay) - axis.y * (cx - ax) < 0) axis.negate()

    const shape = new T.Shape(face.f.abs.map(p => new T.Vector2(...toScene(p))))
    const geometry = new T.ShapeGeometry(shape)
    const front = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: T.FrontSide })
    fronts.push(front)
    ;(front.userData as { slot: number }).slot = face.f.slot
    for (const material of [front, back!]) {
      const mesh = new T.Mesh(geometry, material)
      mesh.position.set(-ax, -ay, 0)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
    }
    parent.add(group)
    hinges.push({ group, axis, face })
    face.children.forEach(child => add(child, group, a))
  }
  // The roots hang off the scene's origin, the word's center
  tree.value.roots.forEach(root => add(root, scene!, [W.value / 2, H.value / 2]))
  paint()
  return true
}

// Colors from the tokens the lockup wears (--ori-1..4, the page's paper), read where the
// component sits so the family and project palettes apply
function paint() {
  if (!three || !box.value) return
  const cs = getComputedStyle(box.value)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  const fallback = ['#5d72e3', '#16213a', '#2f49d1', '#0b0f1a']
  for (const m of fronts) {
    const slot = (m.userData as { slot: number }).slot
    m.color.set(resolve(v(`--ori-${slot}`, fallback[slot - 1]!)))
  }
  back!.color.set(resolve(v('--bg', '#f3f4f1')))
}
// A token may be a color-mix(); the browser resolves it on a scratch element
let scratch: HTMLElement | undefined
function resolve(color: string) {
  if (/^#|^rgb/.test(color)) return color
  scratch ??= Object.assign(document.createElement('span'), { style: 'position:fixed;visibility:hidden' })
  box.value!.append(scratch)
  scratch.style.color = color
  const out = getComputedStyle(scratch).color
  scratch.remove()
  return out
}

function size() {
  if (!renderer || !camera || !canvas.value) return
  const r = canvas.value.getBoundingClientRect()
  renderer.setSize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)), false)
}

function pose(t: number) {
  for (const h of hinges) {
    const p = Math.min(1, Math.max(0, (t - h.face.at) / props.duration))
    h.group.quaternion.setFromAxisAngle(h.axis, h.face.closed * (1 - ease(p)))
  }
}

function render() {
  if (!renderer || !scene || !camera) return
  renderer.render(scene, camera)
}

let started = 0
function loop(now: number) {
  const t = now - started
  pose(t)
  render()
  if (t < tree.value.total) {
    frame = requestAnimationFrame(loop)
  }
  else {
    frame = 0
    land()
  }
}

// The 3D word lies flat: the SVG takes over under a short cross-fade
function land() {
  open.value = true
  landing.value = true
  emit('done')
  timer = setTimeout(() => { playing.value = false; landing.value = false }, 320)
}

async function play() {
  if (import.meta.server) return
  clearTimeout(timer)
  cancelAnimationFrame(frame)
  frame = 0
  landing.value = false
  open.value = false
  playing.value = true
  if (!(await build())) { show(); return }
  // The canvas is laid out only once `playing` has reached the DOM
  await nextTick()
  if (!playing.value) return
  paint()
  size()
  pose(0)
  render()
  started = performance.now()
  frame = requestAnimationFrame(loop)
}

// Open with no animation, for a wordmark that is already unfolded somewhere else on the page
function show() {
  if (import.meta.server) return
  clearTimeout(timer)
  cancelAnimationFrame(frame)
  frame = 0
  landing.value = false
  playing.value = false
  open.value = true
}

// Without JavaScript nothing ever plays, so the flat lockup is forced instead
useHead({ noscript: [{ key: 'origami-flat', innerHTML: '<style>.origami-3d .word{visibility:visible!important}</style>' }] })

onMounted(() => {
  if (!props.autoplay) { open.value = true; return }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { open.value = true; return }
  timer = setTimeout(play, props.delay)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  cancelAnimationFrame(frame)
  renderer?.dispose()
  renderer = undefined
})
defineExpose({ play, show, playing, open })
</script>

<template>
  <div
    ref="box"
    class="origami-3d"
    :class="{ playing, landing }"
    :style="{ 'aspect-ratio': `${W} / ${H}`, '--mx': `${MX / W * 100}%`, '--my': `${MY / H * 100}%` }"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  >
    <OrigamiWord :text="text" label="" class="word" :class="{ hidden: autoplay && !open }" />
    <canvas ref="canvas" class="scene" aria-hidden="true" />
  </div>
</template>

<style scoped>
.origami-3d { position: relative; width: 100%; }
.word { display: block; width: 100%; }
.word.hidden { visibility: hidden; }
/* The canvas is the word's box plus the bleed; it is only painted while the unfold plays */
.scene {
  position: absolute;
  inset: calc(-1 * var(--my)) calc(-1 * var(--mx));
  width: calc(100% + 2 * var(--mx));
  height: calc(100% + 2 * var(--my));
  display: none;
  pointer-events: none;
}
.playing .scene { display: block; }
.landing .scene { opacity: 0; transition: opacity .3s ease; }
</style>
