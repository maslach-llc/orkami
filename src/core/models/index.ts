// The library of models folded in steps (D19). The first is the opening of the crane the engine
// can close today; doc 13 adds the crane and doc 14 the traditional creatures.
import { preliminaryKite, preliminaryKitePattern, preliminaryKiteSteps } from './preliminary-kite.ts'

export { preliminaryKite, preliminaryKitePattern, preliminaryKiteSteps }

/** The named models, each a factory from the square's side. */
export const models = {
  preliminaryKite,
}

export type NamedModel = keyof typeof models
