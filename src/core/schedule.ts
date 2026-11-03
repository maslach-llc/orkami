// The schedule: per crease, a start, a duration and an easing over a global time t in [0, 1]
// (docs/design/01-decisions.md D4; docs/study/01-how-paper-folds.md section 4).
//
//     angle_c(t) = closed_c * (1 - ease_c(clamp((t - start_c) / duration_c, 0, 1)))
//
// A schedule is built in milliseconds (a crease's duration scales with its flap's reach) and
// normalized to t, keeping the whole motion's length in `total` so a driver can map t to the
// clock. Simultaneous (`together`), a hand's sequence with overlap (`sequence`) and a true step
// by step (`stepwise`) are the three the study names; a stagger is `sequence` over sibling flaps.
import { crease as creaseOf, sign, treeCreases, type CreaseId, type Fold } from './fold.ts'
import { hingeTree, reach } from './tree.ts'

export type Ease = (x: number) => number

export interface Entry {
  /** In units of t. */
  start: number
  /** In units of t. */
  duration: number
  /** Defaults to `paper`. Not a public option in the first release (D4). */
  ease?: Ease
  /**
   * The crease is coupled to another instead of keeping its own time (D17): its folded fraction
   * (|angle| / closed) is `ratio` times the other crease's, capped at fully folded. `start`,
   * `duration` and `ease` are then not read. A pleat's inner creases follow its first at 2, so
   * the panels zigzag with their low creases on the table (docs/study/01-how-paper-folds.md 3.6).
   * The crease followed keeps its own time; a chain of follows is refused.
   */
  follow?: { crease: CreaseId; ratio: number }
}

export interface Schedule {
  creases: Record<CreaseId, Entry>
  /** The whole motion's length in milliseconds at the default pace. */
  total: number
}

/** A CSS cubic-bezier(x1, y1, x2, y2) timing function, solved numerically so WebGL lands where CSS does. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let s = x
    for (let i = 0; i < 8; i++) {
      const d = sampleX(s) - x
      if (Math.abs(d) < 1e-9) return sampleY(s)
      const k = slopeX(s)
      if (Math.abs(k) < 1e-9) break
      s -= d / k
    }
    let lo = 0, hi = 1
    s = x
    while (hi - lo > 1e-9) {
      s = (lo + hi) / 2
      if (sampleX(s) < x) lo = s
      else hi = s
    }
    return sampleY(s)
  }
}

/** The one easing for all paper: a fast start and a long decelerating tail, no overshoot (the seed's curve). */
export const paper: Ease = cubicBezier(0.22, 0.75, 0.25, 1)

/** The owner's base duration, ms, for a flap whose reach is REACH px. */
export const BASE = 640
export const REACH = 240
/** The default step between creases in a sequence, ms (small against the duration: the motion overlaps and reads as one gesture). */
export const STEP = 60

/** A crease's duration in ms from its flap's reach: base * clamp(sqrt(reach / 240), 0.6, 1.6). A design rule, not a physical law. */
export function creaseDuration(reach: number, base = BASE): number {
  return base * Math.min(1.6, Math.max(0.6, Math.sqrt(reach / REACH)))
}

/** The eased progress of an entry at t, in [0, 1]. */
export function progress(entry: Entry, t: number): number {
  const x = entry.duration > 0 ? (t - entry.start) / entry.duration : t >= entry.start ? 1 : 0
  return (entry.ease ?? paper)(Math.min(1, Math.max(0, x)))
}

/** A crease's folded fraction at t, in [0, 1]: 1 closed, 0 flat; a coupled crease's from the one it follows. */
export function foldedAt(schedule: Schedule, creaseId: CreaseId, t: number): number {
  const entry = schedule.creases[creaseId] ?? { start: 0, duration: 1 }
  if (entry.follow) {
    const lead = schedule.creases[entry.follow.crease]
    if (lead?.follow) throw new Error(`crease ${creaseId} follows ${entry.follow.crease}, which follows another`)
    return Math.min(1, Math.max(0, entry.follow.ratio * (1 - progress(lead ?? { start: 0, duration: 1 }, t))))
  }
  return 1 - progress(entry, t)
}

/** A crease's signed angle at t, in radians: closed * (1 - ease(progress)), valley positive. A crease the schedule does not list moves over the whole of t. */
export function angleAt(fold: Fold, creaseId: CreaseId, schedule: Schedule, t: number): number {
  const c = creaseOf(fold, creaseId)
  return sign(c.assignment) * c.closed * foldedAt(schedule, creaseId, t)
}

/** Whether every crease keeps its own time on the one easing, so a CSS transition per crease can play the schedule (no follows, no custom ease). */
export const transitionable = (schedule: Schedule) => Object.values(schedule.creases).every(e => !e.follow && !e.ease)

interface Options {
  /** The base duration in ms (BASE). */
  base?: number
}

/** Durations in ms per tree crease, from reach. */
function durations(fold: Fold, base: number): Map<CreaseId, number> {
  const tree = hingeTree(fold)
  return new Map(treeCreases(fold).map(c => [c.id, creaseDuration(reach(fold, c.id, tree), base)]))
}

function normalize(starts: Map<CreaseId, number>, durs: Map<CreaseId, number>, base: number): Schedule {
  let total = 0
  for (const [id, start] of starts) total = Math.max(total, start + (durs.get(id) ?? 0))
  if (total <= 0) total = base
  const creases: Schedule['creases'] = {}
  for (const [id, start] of starts) creases[id] = { start: start / total, duration: (durs.get(id) ?? 0) / total }
  return { creases, total }
}

/**
 * Creases starting at given times, in ms from the start of the motion (a crease not listed
 * starts at 0), each running for its reach's duration: the builder the three above are cases
 * of, for a choreography of its own (the wordmark's letters, D13).
 */
export function timed(fold: Fold, starts: Record<CreaseId, number>, { base = BASE }: Options = {}): Schedule {
  const durs = durations(fold, base)
  const at = new Map([...durs.keys()].map(id => [id, 0]))
  for (const [id, ms] of Object.entries(starts)) {
    if (!durs.has(id)) throw new Error(`no tree crease ${id}`)
    at.set(id, ms)
  }
  return normalize(at, durs, base)
}

/** Every crease at once, Origami Simulator's slider: each starts at 0 and runs for its own duration. */
export function together(fold: Fold, { base = BASE }: Options = {}): Schedule {
  const durs = durations(fold, base)
  const starts = new Map([...durs.keys()].map(id => [id, 0]))
  return normalize(starts, durs, base)
}

/**
 * A hand's sequence: the creases in `order` (the unfold order from the study: the outermost
 * flap first) start one `step` ms apart and overlap. Creases not in `order` start at 0. The
 * seed's stagger is this over sibling flaps.
 */
export function sequence(fold: Fold, order: CreaseId[], { step = STEP, base = BASE }: Options & { step?: number } = {}): Schedule {
  const durs = durations(fold, base)
  const starts = new Map([...durs.keys()].map(id => [id, 0]))
  order.forEach((id, k) => { if (!durs.has(id)) throw new Error(`no tree crease ${id}`); starts.set(id, k * step) })
  return normalize(starts, durs, base)
}

/** A true step by step: each crease in `order` starts when the one before it has finished, plus `gap` ms. A list of steps read one by one. */
export function stepwise(fold: Fold, order: CreaseId[], { gap = 0, base = BASE }: Options & { gap?: number } = {}): Schedule {
  const durs = durations(fold, base)
  const starts = new Map([...durs.keys()].map(id => [id, 0]))
  let at = 0
  for (const id of order) {
    const d = durs.get(id)
    if (d === undefined) throw new Error(`no tree crease ${id}`)
    starts.set(id, at)
    at += d + gap
  }
  return normalize(starts, durs, base)
}
