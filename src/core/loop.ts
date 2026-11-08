// A loop: a sequence of real folds on one sheet that meet at flat (docs/design/01-decisions.md
// D18; docs/study/01-how-paper-folds.md section 5). Real paper cannot morph from one base into
// another, so each step is played whole: fold-in (t 1 -> 0, the unfold played backwards, so the
// first crease undone is the last one made), a hold at closed, the unfold (t 0 -> 1), then a gap
// at flat before the next step folds in. Every step passes through the same flat sheet, which is
// where a driver swaps one step's flaps for the next and where a stop lands.
//
// Pure functions over milliseconds: no timers, no clock. A driver keeps the clock and asks
// `at(ms)` for the step and its t, and `nextFlat(ms)` for where a stop lands.
import { validate, type Fold } from './fold.ts'
import { named, type NamedFold } from './folds/index.ts'
import { together, type Schedule } from './schedule.ts'

export interface LoopStep {
  fold: Fold
  /** The unfold schedule; the fold's own, else every crease together. */
  schedule?: Schedule
  /** Milliseconds for each of the fold-in and the unfold; the schedule's total by default. */
  duration?: number
}

/** A step with its schedule and duration resolved, and where it sits on the loop's clock. */
export interface LoopStepResolved {
  fold: Fold
  schedule: Schedule
  duration: number
  /** Where the step starts on the loop's clock, ms from the loop's start. */
  start: number
  /** The step's length: fold-in + hold + unfold + gap. */
  length: number
}

export type LoopPhase = 'fold-in' | 'hold' | 'unfold' | 'gap'

export interface LoopAt {
  /** The index of the step playing. */
  step: number
  /** The step's t: 1 flat, 0 closed. */
  t: number
  phase: LoopPhase
  /** How many whole loops have played before this moment. */
  cycle: number
}

export interface LoopOptions {
  /** Milliseconds held at closed between a step's fold-in and its unfold. */
  hold?: number
  /** Milliseconds lying flat between one step's unfold and the next one's fold-in. */
  gap?: number
}

export interface Loop {
  readonly steps: readonly LoopStepResolved[]
  readonly hold: number
  readonly gap: number
  /** One whole loop, ms: every step's length. */
  readonly period: number
  /** The step and its t at `ms` from the loop's start; wraps past the period. */
  at(ms: number): LoopAt
  /** The first moment at or after `ms` when the sheet lies flat: `ms` itself when it is flat, else the end of the playing step's unfold. Never more than one step away. */
  nextFlat(ms: number): number
}

/** Held at closed, ms: long enough to read as a pause, short enough not to read as a stall. */
export const LOOP_HOLD = 240
/** Flat between steps, ms: the sheet rests a beat, and a driver gets a flat frame to swap on. */
export const LOOP_GAP = 160
/** The study's square bases, the default loop (docs/study/01-how-paper-folds.md section 5). */
export const LOOP_BASES: readonly NamedFold[] = ['waterbomb', 'preliminary', 'blintz']

/** The named folds as loop steps on a size x size square (the bases need a square). */
export function loopSteps(size: number, names: readonly NamedFold[] = LOOP_BASES): LoopStep[] {
  return names.map(n => ({ fold: named[n](size, size) }))
}

/** A loop over `steps`, which must be valid folds on one sheet (the same width and height). */
export function loop(steps: readonly LoopStep[], { hold = LOOP_HOLD, gap = LOOP_GAP }: LoopOptions = {}): Loop {
  if (steps.length === 0) throw new Error('a loop needs at least one step')
  if (!(hold >= 0) || !(gap >= 0)) throw new Error('hold and gap must be zero or more')
  const { width, height } = steps[0]!.fold.sheet
  let start = 0
  const resolved: LoopStepResolved[] = steps.map((s, i) => {
    const errors = validate(s.fold)
    if (errors.length) throw new Error(`step ${i} is not a valid fold: ${errors.join('; ')}`)
    const { sheet } = s.fold
    if (sheet.width !== width || sheet.height !== height) {
      throw new Error(`step ${i} is on a ${sheet.width} x ${sheet.height} sheet, not the loop's ${width} x ${height}: a loop is one sheet`)
    }
    const schedule = s.schedule ?? s.fold.schedule ?? together(s.fold)
    const duration = s.duration ?? schedule.total
    if (!(duration > 0)) throw new Error(`step ${i} needs a duration over 0`)
    const length = 2 * duration + hold + gap
    const r = { fold: s.fold, schedule, duration, start, length }
    start += length
    return r
  })
  const period = start

  /** The step playing at `local` ms into one loop (0 <= local < period). */
  const stepAt = (local: number) => {
    let i = resolved.length - 1
    while (i > 0 && resolved[i]!.start > local) i--
    return i
  }

  const at = (ms: number): LoopAt => {
    const cycle = Math.floor(ms / period)
    const local = ms - cycle * period
    const step = stepAt(local)
    const s = resolved[step]!
    let x = local - s.start
    if (x < s.duration) return { step, t: 1 - x / s.duration, phase: 'fold-in', cycle }
    x -= s.duration
    if (x < hold) return { step, t: 0, phase: 'hold', cycle }
    x -= hold
    if (x < s.duration) return { step, t: x / s.duration, phase: 'unfold', cycle }
    return { step, t: 1, phase: 'gap', cycle }
  }

  const nextFlat = (ms: number): number => {
    const a = at(ms)
    if (a.t === 1) return ms
    const s = resolved[a.step]!
    // The end of this step's unfold, where its gap (or, with no gap, the next step) begins
    return a.cycle * period + s.start + 2 * s.duration + hold
  }

  return { steps: resolved, hold, gap, period, at, nextFlat }
}
