// The loader's timing, as a pure function so it can be tested without a DOM (FoldLoader.vue,
// D18). Times are ms since the loader mounted; `readyAt` is undefined until `ready` turns true.
//
//   ready within skipWithin  -> 'skip'  (never rendered: a page that is ready at once gets no loader)
//   before skipWithin        -> 'wait'  (nothing rendered yet)
//   not ready, or ready but shown for less than minMs -> 'loop'
//   ready and shown for minMs -> 'stop'  (the loop lands flat at its next flat moment)

export interface LoaderTiming {
  /** Once shown, the loader shows at least this long, ms, so it never flashes. */
  minMs?: number
  /** Ready within this many ms of mounting: the loader renders nothing at all. */
  skipWithin?: number
}

export type LoaderPhase = 'wait' | 'skip' | 'loop' | 'stop'

export interface LoaderPlan {
  phase: LoaderPhase
  /** When the phase next changes by itself (ms since mount), if it will without `ready` changing. */
  next?: number
}

export const LOADER_MIN_MS = 600
export const LOADER_SKIP_WITHIN = 150

export function loaderPlan(readyAt: number | undefined, now: number, { minMs = LOADER_MIN_MS, skipWithin = LOADER_SKIP_WITHIN }: LoaderTiming = {}): LoaderPlan {
  if (readyAt !== undefined && readyAt <= skipWithin) return { phase: 'skip' }
  if (now < skipWithin) return { phase: 'wait', next: skipWithin }
  if (readyAt === undefined) return { phase: 'loop' }
  const stopAt = Math.max(readyAt, skipWithin + minMs)
  return now >= stopAt ? { phase: 'stop' } : { phase: 'loop', next: stopAt }
}
