// The first model (doc 09): a square collapsed to the preliminary base, then the two kite folds
// on its front flap, the way the crane begins (docs/study/04-models-in-steps.md section 6, K2
// and K3). The engine sees the base from the side D10's amendment fixed: quadrant A lies on the
// page and quadrant C is the flap on top, so the kite folds are the study's K8 creases, made on
// the visitor's side. With t = tan(22.5 deg) / 2 of the side, qC = (1 - t, 1/2) on the midline
// O-m2 and pC = (1/2, 1 - t) on O-m3:
//
//  A        m1        B             step 1, collapse (D10, one coupled motion at O):
//  +--------+---------+               O-m1, O-qC + qC-m2, O-pC + pC-m3, O-m4   V 180
//  |\   T1  .   T2   /|               O-B, O-D (solved)                        M 180
//  |  \     .      /  |               O-A, O-C                                 F 0
//  |    \   .    / Tro|
//  | Tl   \ . / Tri . |             step 2, kite fold right: the flap's lower right edge to the
//  m4 - - - O - - qC- m2              centre line, through its two layers (Tro over Tr2o):
//  | Tl2  / . \ Tr2i .|               B-qC (in Tr), C-qC (in quadrant C), equal and opposite
//  |    / T7i  \  Tr2o|
//  |  /   pC .   \    |             step 3, kite fold left, the mirror: D-pC (in T7), C-pC
//  |/ T7o .  T8o  \   |               (in quadrant C)
//  +--------+---------+
//  D        m3        C             faces split by the kite creases: Tr = Tri + Tro,
//                                   Tr2 = Tr2i + Tr2o, T7 = T7i + T7o, T8 = T8i + T8o
//
// The hinge tree is the preliminary's (rooted on T1, O-C the closing crease of D10's closure),
// with each kite flap hung as a packet: Tro on Tri by the kite crease B-qC, Tr2o on Tro by the
// midline's outer half qC-m2, which the kite fold holds at 180; the kite crease in the top
// layer, C-qC, is left out of the tree and closes by the step's own target (a closure with no
// solved crease). Each kite vertex is degree 4 on the kite branch (study 04, section 1: p-A =
// -p-B, the midline held at 180), one degree of freedom, rigid.
//
// Fold order: collapse, kite right, kite left. Unfold order: the same backwards.
import type { Pt } from '../affine.ts'
import type { Crease, Fold } from '../fold.ts'
import { model, type Model, type Step } from '../model.ts'

const PI = Math.PI

/** The crease pattern of the preliminary base with both kite folds on its front flap, every crease as it ends. */
export function preliminaryKitePattern(size: number): Fold {
  const w = size, h = size
  const t = Math.tan(PI / 8) / 2
  const O: Pt = [w / 2, h / 2]
  const A: Pt = [0, 0], m1: Pt = [w / 2, 0], B: Pt = [w, 0], m2: Pt = [w, h / 2]
  const C: Pt = [w, h], m3: Pt = [w / 2, h], D: Pt = [0, h], m4: Pt = [0, h / 2]
  const qC: Pt = [w * (1 - t), h / 2], pC: Pt = [w / 2, h * (1 - t)]
  const c = (id: string, a: Pt, b: Pt, assignment: Crease['assignment'], parent: string, child: string, closing?: boolean): Crease =>
    ({ id, a, b, assignment, parent, child, closed: assignment === 'F' ? 0 : PI, ...(closing ? { closing: true } : {}) })
  return {
    name: 'preliminaryKite',
    sheet: { width: w, height: h },
    faces: [
      { id: 'T1', pts: [O, A, m1] }, { id: 'T2', pts: [O, m1, B] },
      { id: 'Tl', pts: [O, m4, A] }, { id: 'Tl2', pts: [O, D, m4] },
      { id: 'Tri', pts: [O, B, qC] }, { id: 'Tro', pts: [qC, B, m2] },
      { id: 'Tr2i', pts: [O, qC, C] }, { id: 'Tr2o', pts: [qC, m2, C] },
      { id: 'T7i', pts: [O, pC, D] }, { id: 'T7o', pts: [pC, m3, D] },
      { id: 'T8i', pts: [O, C, pC] }, { id: 'T8o', pts: [pC, C, m3] },
    ],
    creases: [
      c('OA', O, A, 'F', 'T1', 'Tl'),
      c('Om1', O, m1, 'V', 'T1', 'T2'),
      c('OB', O, B, 'M', 'T2', 'Tri'),
      c('OqC', O, qC, 'V', 'Tri', 'Tr2i'),
      c('BqC', B, qC, KITE_RIGHT[0] > 0 ? 'V' : 'M', 'Tri', 'Tro'),
      c('qCm2', qC, m2, 'V', 'Tro', 'Tr2o'),
      c('CqC', C, qC, KITE_RIGHT[1] > 0 ? 'V' : 'M', 'Tr2i', 'Tr2o', true),
      c('Om4', O, m4, 'V', 'Tl', 'Tl2'),
      c('OD', O, D, 'M', 'Tl2', 'T7i'),
      c('OpC', O, pC, 'V', 'T7i', 'T8i'),
      c('DpC', D, pC, KITE_LEFT[0] > 0 ? 'V' : 'M', 'T7i', 'T7o'),
      c('pCm3', pC, m3, 'V', 'T7o', 'T8o'),
      c('CpC', C, pC, KITE_LEFT[1] > 0 ? 'V' : 'M', 'T8i', 'T8o', true),
      c('OC', O, C, 'F', 'Tr2i', 'T8i', true),
    ],
    root: 'T1',
    closures: [
      { vertex: O, closing: 'OC', solved: ['OB', 'OD'], across: [Math.SQRT1_2, -Math.SQRT1_2] },
      { vertex: qC, closing: 'CqC', solved: [], across: [1, 0] },
      { vertex: pC, closing: 'CpC', solved: [], across: [0, 1] },
    ],
    suits: ['square'],
  }
}

/** The kite creases' signs, [the crease in the under layer, the crease in quadrant C]: the flap turns toward the visitor, over the top. */
const KITE_RIGHT: [number, number] = [1, -1]
const KITE_LEFT: [number, number] = [1, -1]

/** The steps: collapse to the preliminary base, then the right and the left kite fold. */
export function preliminaryKiteSteps(): Step[] {
  return [
    { name: 'collapse to the preliminary base', moves: { Om1: PI, OqC: PI, qCm2: PI, OpC: PI, pCm3: PI, Om4: PI, OB: -PI, OD: -PI } },
    { name: 'kite fold, right', moves: { BqC: KITE_RIGHT[0] * PI, CqC: KITE_RIGHT[1] * PI } },
    { name: 'kite fold, left', moves: { DpC: KITE_LEFT[0] * PI, CpC: KITE_LEFT[1] * PI } },
  ]
}

/** Square, preliminary base, the two kite folds on the front flap: the crane's first three steps the engine can close today. */
export function preliminaryKite(size = 240): Model {
  return model(preliminaryKitePattern(size), preliminaryKiteSteps())
}
