// The CSS driver's loop (D18): a core `Loop` played on one element. The playing step is a
// `mount` of its fold, driven by `set(t)` on requestAnimationFrame (a loop has no end state for a
// CSS transition to aim at), so the shadows are painted from the pose every frame and breathe as
// the paper rises and lands. When the clock crosses into the next step the mounted flaps are
// swapped for the next step's: that happens after the gap, where the last frame drawn was the
// flat sheet, which every step shares, so the swap does not show. `stop()` lets the step run to
// the loop's next flat moment and lands there; nothing fades or cuts mid-fold.
import type { Loop } from '../core/loop.ts'
import { mount, type Handle, type MountOptions } from './driver.ts'

export interface LoopMountOptions extends Omit<MountOptions, 'at' | 'schedule' | 'still' | 'drive' | 'delay'> {
  /** The clock, ms; `performance.now` by default (a test passes a fake). */
  now?: () => number
  /** Called when a new step's flaps are mounted, with its index. */
  onStep?: (step: number) => void
}

export interface LoopHandle {
  readonly el: HTMLElement
  readonly loop: Loop
  /** The index of the mounted step. */
  readonly step: number
  /** The mounted step's t: 1 flat, 0 closed. */
  readonly t: number
  readonly running: boolean
  /** The mounted step's handle from `mount`; undefined once destroyed. */
  readonly handle: Handle | undefined
  /** Starts the loop from its beginning. Under reduced motion nothing moves: the first step lies flat. */
  start(): void
  /** Lets the playing step run to the next flat moment and resolves there, flat; at once when not running. */
  stop(): Promise<void>
  /** Cancels the loop and removes everything the driver added, leaving the element as it was. */
  destroy(): void
}

/** Mounts `loop`'s first step flat on `el`; nothing moves until `start()`. */
export function mountLoop(el: HTMLElement, loop: Loop, options: LoopMountOptions = {}): LoopHandle {
  const { now: clock, onStep, ...rest } = options
  const win = el.ownerDocument.defaultView
  const now = clock ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
  const reduced = !!win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  let step = 0
  let handle: Handle | undefined
  let running = false
  let t0 = 0
  let stopAt: number | undefined
  let stopped: (() => void) | undefined
  let raf = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const show = (i: number) => {
    handle?.destroy()
    step = i
    const s = loop.steps[i]!
    handle = mount(el, s.fold, { ...rest, schedule: s.schedule, at: 1, drive: 'frame' })
    onStep?.(i)
  }
  show(0)

  const request = (fn: () => void) => {
    if (win?.requestAnimationFrame) raf = win.requestAnimationFrame(fn)
    else timer = setTimeout(fn, 16)
  }
  const cancel = () => {
    if (raf && win?.cancelAnimationFrame) win.cancelAnimationFrame(raf)
    if (timer) clearTimeout(timer)
    raf = 0
    timer = undefined
  }
  const finish = () => {
    cancel()
    running = false
    stopAt = undefined
    const done = stopped
    stopped = undefined
    done?.()
  }

  const tick = () => {
    if (!handle) return
    const ms = now() - t0
    if (stopAt !== undefined && ms >= stopAt) {
      // The flat moment the stop aimed at: the step it was playing lands, whatever the frame rate
      handle.set(1)
      finish()
      return
    }
    const a = loop.at(ms)
    if (a.step !== step) show(a.step)
    handle!.set(a.t)
    request(tick)
  }

  return {
    el,
    loop,
    get step() { return step },
    get t() { return handle?.t ?? 1 },
    get running() { return running },
    get handle() { return handle },
    start() {
      if (running || !handle || reduced) return
      if (step !== 0) show(0)
      running = true
      t0 = now()
      request(tick)
    },
    stop() {
      if (!running) return Promise.resolve()
      if (stopAt === undefined) stopAt = loop.nextFlat(now() - t0)
      return new Promise<void>((resolve) => {
        const prev = stopped
        stopped = () => { prev?.(); resolve() }
      })
    },
    destroy() {
      finish()
      handle?.destroy()
      handle = undefined
    },
  }
}
