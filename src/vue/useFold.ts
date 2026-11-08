// useFold(el, fold, options): the CSS driver's handle as refs for a component. Mounts on
// `onMounted` (client only: a server never builds the flaps), destroys on unmount, and exposes
// the time, the state and the landing as reactive values. `open()` waits for the print to be
// ready (`Handle.ready`, a picture decoded) before the paper moves.
import { onBeforeUnmount, onMounted, ref, shallowRef, unref, type Ref, type ShallowRef } from 'vue'
import { mount, type Handle, type MountOptions, type State } from '../css/driver.ts'
import { foldFor, type FoldSpec } from './unfold.ts'

export interface UseFold {
  /** The driver handle once mounted, null before and after. */
  handle: ShallowRef<Handle | null>
  /** The current time, 0 closed to 1 flat. */
  t: Ref<number>
  state: Ref<State>
  /** True once the paper has lain flat. */
  landed: Ref<boolean>
  open: () => Promise<void>
  close: () => Promise<void>
  set: (t: number) => void
}

export function useFold(el: Ref<HTMLElement | null | undefined> | HTMLElement, fold: FoldSpec | Ref<FoldSpec>, options: MountOptions = {}): UseFold {
  const handle = shallowRef<Handle | null>(null)
  const t = ref(options.at ?? 0)
  const state = ref<State>('closed')
  const landed = ref(false)
  const sync = () => {
    const h = handle.value
    if (!h) return
    t.value = h.t
    state.value = h.state
  }
  onMounted(() => {
    const target = unref(el)
    if (!target) return
    const h = mount(target, foldFor(unref(fold)), options)
    handle.value = h
    sync()
    void h.landed.then(() => { landed.value = true; sync() })
  })
  onBeforeUnmount(() => {
    handle.value?.destroy()
    handle.value = null
  })
  const after = async (p: Promise<void> | undefined) => { await p; sync() }
  /** Opens once the print is ready (a picture decoded); a picture that fails is reported and the paper opens without it. */
  const open = async () => {
    const h = handle.value
    if (!h) return
    try { await h.ready } catch (e) { console.error('useFold: the print did not decode', e) }
    if (handle.value !== h) return
    const p = h.open()
    sync()
    await after(p)
  }
  return {
    handle,
    t,
    state,
    landed,
    open,
    close: () => { const p = handle.value?.close(); sync(); return after(p) },
    set: (at: number) => { handle.value?.set(at); sync() },
  }
}
