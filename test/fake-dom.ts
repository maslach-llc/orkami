// Test helper: the least DOM the CSS driver touches, as plain objects (no jsdom: not an
// approved dependency). An element has a style, classes, attributes, a dataset, children and a
// size; a document creates elements; a window has a computed style, a clock and a media query.
// Not a test file itself.

export class FakeStyle {
  private props = new Map<string, string>()
  setProperty(name: string, value: string) { this.props.set(name, value) }
  removeProperty(name: string) { this.props.delete(name) }
  getPropertyValue(name: string) { return this.props.get(name) ?? '' }
  /** Every property set, camel-cased ones included, for assertions. */
  get entries() { return [...this.props.entries()] }
  get size() { return this.props.size }
}

const camelToKebab = (s: string) => s.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)

/** A style whose camel-cased members (`style.clipPath = ...`) land in the same map as `setProperty`. */
function makeStyle(): FakeStyle & Record<string, string> {
  const s = new FakeStyle()
  return new Proxy(s, {
    get(target, key: string | symbol) {
      if (typeof key === 'symbol' || key in target) return Reflect.get(target, key)
      return target.getPropertyValue(camelToKebab(key))
    },
    set(target, key: string | symbol, value) {
      if (typeof key === 'symbol' || key in target) return Reflect.set(target, key, value)
      target.setProperty(camelToKebab(key), String(value))
      return true
    },
  }) as FakeStyle & Record<string, string>
}

export class FakeClassList {
  set = new Set<string>()
  add(...names: string[]) { names.forEach(n => this.set.add(n)) }
  remove(...names: string[]) { names.forEach(n => this.set.delete(n)) }
  contains(n: string) { return this.set.has(n) }
  toggle(n: string, force?: boolean) {
    const on = force ?? !this.set.has(n)
    if (on) this.set.add(n)
    else this.set.delete(n)
    return on
  }
  toString() { return [...this.set].join(' ') }
  [Symbol.iterator]() { return this.set.values() }
}

export class FakeElement {
  tagName: string
  style = makeStyle()
  classList = new FakeClassList()
  dataset: Record<string, string> = {}
  attributes = new Map<string, string>()
  children: FakeElement[] = []
  parentNode: FakeElement | null = null
  ownerDocument: FakeDocument
  offsetWidth: number
  offsetHeight: number
  offsetLeft = 0
  offsetTop = 0
  clientLeft = 0
  clientTop = 0
  offsetParent: FakeElement | null = null
  listeners = new Map<string, ((e: unknown) => void)[]>()

  constructor(doc: FakeDocument, tagName: string, width = 0, height = 0) {
    this.ownerDocument = doc
    this.tagName = tagName.toUpperCase()
    this.offsetWidth = width
    this.offsetHeight = height
  }
  get clientWidth() { return this.offsetWidth }
  get clientHeight() { return this.offsetHeight }
  get className() { return this.classList.toString() }
  set className(v: string) { this.classList = new FakeClassList(); this.classList.add(...v.split(/\s+/).filter(Boolean)) }
  get childNodes() { return this.children }
  get firstChild() { return this.children[0] ?? null }
  setAttribute(n: string, v: string) { this.attributes.set(n, v) }
  getAttribute(n: string) { return this.attributes.get(n) ?? null }
  removeAttribute(n: string) { this.attributes.delete(n) }
  /** A copy with its style, classes, attributes and dataset (and children, deep). */
  cloneNode(deep = false): FakeElement {
    const c = new FakeElement(this.ownerDocument, this.tagName, this.offsetWidth, this.offsetHeight)
    for (const [k, v] of this.style.entries) c.style.setProperty(k, v)
    c.classList.add(...this.classList.set)
    for (const [k, v] of this.attributes) c.attributes.set(k, v)
    c.dataset = { ...this.dataset }
    c.textContent = this.textContent
    if (deep) for (const k of this.children) c.appendChild(k.cloneNode(true))
    return c
  }
  textContent = ''
  // An <img>: `src`, the natural size the document gives its images, and decode()
  src = ''
  decoding = ''
  get naturalWidth() { return this.ownerDocument.imageSize[0] }
  get naturalHeight() { return this.ownerDocument.imageSize[1] }
  decode(): Promise<void> { return this.ownerDocument.imageFails ? Promise.reject(new Error(`could not decode ${this.src}`)) : Promise.resolve() }
  appendChild(c: FakeElement) { c.remove(); c.parentNode = this; this.children.push(c); return c }
  append(...cs: FakeElement[]) { cs.forEach(c => this.appendChild(c)) }
  prepend(...cs: FakeElement[]) { cs.forEach(c => c.remove()); cs.forEach(c => { c.parentNode = this }); this.children.unshift(...cs) }
  insertBefore(c: FakeElement, ref: FakeElement | null) {
    c.remove()
    c.parentNode = this
    const i = ref ? this.children.indexOf(ref) : -1
    if (i < 0) this.children.push(c)
    else this.children.splice(i, 0, c)
    return c
  }
  remove() {
    if (!this.parentNode) return
    const i = this.parentNode.children.indexOf(this)
    if (i >= 0) this.parentNode.children.splice(i, 1)
    this.parentNode = null
  }
  getBoundingClientRect() { return { top: this.offsetTop, left: this.offsetLeft, bottom: this.offsetTop + this.offsetHeight, right: this.offsetLeft + this.offsetWidth, width: this.offsetWidth, height: this.offsetHeight } }
  addEventListener(type: string, fn: (e: unknown) => void) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]) }
  removeEventListener(type: string, fn: (e: unknown) => void) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(f => f !== fn)) }
  /** Every descendant, depth first. */
  all(): FakeElement[] { return this.children.flatMap(c => [c, ...c.all()]) }
  /** `.class`, `tag`, `[attr]` and `[attr=value]` selectors, or a comma list of them. */
  querySelectorAll(selector: string): FakeElement[] {
    const tests = selector.split(',').map(s => s.trim()).map((s): ((e: FakeElement) => boolean) => {
      const m = /^([a-z]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/i.exec(s)
      if (!m) throw new Error(`fake dom: unsupported selector ${s}`)
      const tag = m[1]!.toUpperCase()
      const classes = m[2]!.split('.').filter(Boolean)
      const attrs = [...m[3]!.matchAll(/\[([\w-]+)(?:="?([^"\]]*)"?)?\]/g)].map(a => [a[1]!, a[2]] as const)
      return e => (!tag || e.tagName === tag)
        && classes.every(c => e.classList.contains(c))
        && attrs.every(([n, v]) => v === undefined ? e.attributes.has(n) || n.startsWith('data-') && e.dataset[n.slice(5)] !== undefined : (e.attributes.get(n) ?? (n.startsWith('data-') ? e.dataset[n.slice(5)] : undefined)) === v)
    })
    return this.all().filter(e => tests.some(t => t(e)))
  }
  querySelector(selector: string): FakeElement | null { return this.querySelectorAll(selector)[0] ?? null }
}

export interface FakeComputed { position: string; backgroundColor: string; backgroundImage: string; backgroundSize: string; backgroundPosition: string; backgroundRepeat: string; getPropertyValue(name: string): string }

export class FakeWindow {
  scrollX = 0
  scrollY = 0
  innerWidth = 1200
  innerHeight = 800
  reducedMotion = false
  /** Whether `CSS.registerProperty` exists (the driver's cue for CSS transitions). */
  registered = true
  listeners = new Map<string, ((e: unknown) => void)[]>()
  frames: (() => void)[] = []
  computed = new Map<FakeElement, Partial<FakeComputed>>()
  document!: FakeDocument
  get CSS() { return this.registered ? { registerProperty: () => {} } : {} }
  matchMedia(q: string) { return { matches: q.includes('reduced-motion') && this.reducedMotion, addEventListener() {} } }
  getComputedStyle(el: FakeElement): FakeComputed {
    const c = this.computed.get(el) ?? {}
    return {
      position: c.position ?? 'static',
      backgroundColor: c.backgroundColor ?? 'rgba(0, 0, 0, 0)',
      backgroundImage: c.backgroundImage ?? 'none',
      backgroundSize: c.backgroundSize ?? 'auto',
      backgroundPosition: c.backgroundPosition ?? '0% 0%',
      backgroundRepeat: c.backgroundRepeat ?? 'repeat',
      getPropertyValue: (name: string) => el.style.getPropertyValue(name),
    }
  }
  addEventListener(type: string, fn: (e: unknown) => void) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]) }
  requestAnimationFrame(fn: () => void) { this.frames.push(fn); return this.frames.length }
  cancelAnimationFrame() { this.frames = [] }
  /** Runs the queued animation frames once. */
  tick() { const fs = this.frames; this.frames = []; fs.forEach(f => f()) }
}

export class FakeDocument {
  defaultView: FakeWindow
  documentElement: FakeElement
  body: FakeElement
  /** The natural size every image decodes to, and whether decoding fails. */
  imageSize: [number, number] = [0, 0]
  imageFails = false
  constructor(win = new FakeWindow()) {
    this.defaultView = win
    win.document = this
    this.documentElement = new FakeElement(this, 'html', win.innerWidth, win.innerHeight)
    this.body = new FakeElement(this, 'body', win.innerWidth, win.innerHeight)
    this.documentElement.appendChild(this.body)
  }
  createElement(tag: string) { return new FakeElement(this, tag) }
  createElementNS(_ns: string, tag: string) { return new FakeElement(this, tag) }
}

/** A document with one element of the given size in its body, as a page block. */
export function block(width: number, height: number, computed: Partial<FakeComputed> = {}) {
  const doc = new FakeDocument()
  const el = new FakeElement(doc, 'section', width, height)
  doc.body.appendChild(el)
  doc.defaultView.computed.set(el, computed)
  return { doc, win: doc.defaultView, el: el as unknown as HTMLElement & FakeElement }
}
