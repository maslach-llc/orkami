# Model sources, rights and the first library

Where the models' facts come from, what each source says about its own terms, the rule orkami
follows when it encodes a model, and the first library scoped model by model. Written 2026-11-08
with `04-models-in-steps.md` (sections 7 and 9 there point here). Every source below was read on
2026-11-08 unless marked otherwise.

## The rule

1. **Traditional models only, in our own words.** A model is encoded when it is traditional:
   anonymous, and marked Traditional by at least one source that marks credits (origami.guide's
   "Copyright" field, a book's credit line). Its steps are written as orkami's own script (D23) and
   its geometry is computed here (as `docs/study/scripts/crane.ts` computes the crane), never
   transcribed from a diagram.
2. **A credited designer's model is not encoded** without the designer's written permission, kept
   with the model's entry. A model whose origin is uncertain (one source names a possible designer)
   counts as credited until a source says otherwise.
3. **Nothing is copied**: no photo, diagram, caption, instruction text or crease-pattern file. Only
   facts are taken (the order of steps, which move a step is, where a crease runs), and the source
   of each is named in the model's entry.
4. **Crease-pattern files are references.** A test may check orkami's geometry against counts and
   coordinates read from Origami Simulator's assets (MIT) or Rabbit Ear's fixtures (GPL-3.0), with
   the URL in the test; neither is vendored (D8).

Why this rule holds. Robert Lang's position (langorigami.com/copyright): diagrams and "printed or
electronic instructions for folding the work, are all protected by copyright"; "an origami figure
is a creative expression ... protected by copyright law"; a figure "explicitly noted as a
traditional figure" may be used, commercially too. A Japanese court held a folding method
"comprises an idea and not a creative expression, and thus is not protected under the copyright
law" (Wikipedia, Origami, "Ethics and copyright", citing Keisen Associates, 2012-11-21), and the
same section calls crediting the original artist "good etiquette". The rule takes the cautious
side of both: traditional figures, our own expression, credit where credit exists. This is a
reading of those sources for an MIT repo, not legal advice.

## Sources

**Step-by-step tutorials** (step order, how a step reads; photos and diagrams, no data):

| source | what it gives | its terms |
|---|---|---|
| https://origami.guide/ | photo tutorials; each model has a "Copyright" field (Traditional, Unknown, Multiple, or a designer's name) | about page (https://origami.guide/?p=51): "All our tutorial contents are the property of Origami Guide"; "Tutorials marked 'Copyright: Traditional' are in the public domain", "no attribution is required"; "All of the origami tutorial photos on origami.guide are copyrighted". The crane (https://origami.guide/animals/birds/traditional-origami-crane/) is marked Traditional |
| https://www.origami-resource-center.com/ | free diagrams by category | "Copyright of the models lie with the origami creators and designers"; "Diagrams are intended for personal use" |
| https://www.giladorigami.com/ | book reviews, a book and magazine database, galleries, designers | "Website content and design ©2000-2026 Gilad Aharoni • All rights reserved." |
| https://www.origamiheaven.com/historyofthejumpingfrog.htm | the jumping frog's history | the business-card jumping frog "first appeared in" Lewis and Oppenheimer, *Folding Paper Toys* (1963), which "may possibly have" originated it |
| https://en.wikipedia.org/wiki/Orizuru | the crane's history ("the most classic of all Japanese origami"; *Hiden Senbazuru Orikata*, 1797) | CC BY-SA text; facts only taken |
| https://en.wikipedia.org/wiki/Action_origami | "The original traditional action model is the flapping bird" | as above |

**Crease patterns and geometry:**

| source | what it gives | licence |
|---|---|---|
| https://github.com/amandaghassaei/OrigamiSimulator `assets/Bases/` (birdBase, frogBase, squareBase, waterbombBase, boatBase, ...) and `assets/Origami/` (traditionalCrane, flat_crane, flappingBird, randlettflappingbird, ...) | SVG crease patterns: red mountain, blue valley, opacity the target angle (origamisimulator.org) | MIT (GitHub API licence endpoint). Patterns by named designers in the same folder (Lang's cardinal, dragon, orchid) are not traditional and are not used |
| https://github.com/rabbit-ear/rabbit-ear `tests/files/` (cp/bird-base.cp, fold/crane-cp.fold, crane-sequence.fold, crane-step.fold, bird-base-3d.fold, blintz-frames.fold) | FOLD fixtures; `crane-sequence.fold` is a "diagrams" file of about 30 frames | GPL-3.0: reference only, never vendored |
| https://github.com/edemaine/fold `examples/` | box, diagonal, simple, squaretwist | MIT; no models |
| https://github.com/oripa/oripa | the .opx and .cp formats | GPL-3.0 |

**Algorithms and notation** (read, not copied): Rabbit Ear's `src/axioms/axioms.js` and
`src/graph/fold/flatFold.js` (GPL-3.0); Wikipedia's Huzita-Hatori axioms and Yoshizawa-Randlett
system; FOLD spec 1.2; amkraft/origami-diagrams (no licence listed); yanda-dy/origami-dsl. Papers:
Tachi 2009 (https://origami.c.u-tokyo.ac.jp/~tachi/cg/), Ku and Demaine 2016
(https://arxiv.org/abs/1601.05747), Abel et al. 2016
(https://erikdemaine.org/papers/RigidOrigami_JoCG/), Akitaya et al. 2020
(https://erikdemaine.org/papers/RigidOrigamiHard_JoCG/), Ghassaei et al. 2018
(https://erikdemaine.org/papers/OrigamiSimulator_Origami7/).

**Not reachable this session:** rabbitear.org (TLS error); the PDF bodies of the papers above
(fetched but not extractable). GitHub code search needs a login.

## The first library

Traditional models, ordered by what each adds to the engine (doc 14 encodes them in this order).
Base, moves and step counts are from the traditional sequences as commonly diagrammed; the counts
are approximate and *unverified, from memory* except the crane's (computed, study 04 section 6).
Doc 14 confirms each model's sequence and its Traditional mark against a source in the table above
before encoding it, and records that source in the model's entry.

| # | model | base | moves | sink, bend or cut | steps | adds to the engine | verdict |
|---|---|---|---|---|---|---|---|
| 1 | fox (face) | diagonal fold (triangle) | valley folds through layers | none | about 5 | through-folds only (D22) | first library |
| 2 | cup | diagonal fold (triangle) | valley folds, a flap tucked into a pocket | none; it opens at the end (a held angle) | about 6 | choosing one layer of two (D22's selection), a held finishing angle (D19) | first library |
| 3 | swan | kite base (study 01, 3.9) | valley folds, outside reverse folds for neck and head | none | about 8 | a reverse fold on a flap whose spine ends free (D21's relaxed path at its simplest) | first library |
| 4 | fish | fish base (study 01, 3.10) | rabbit ears, valley folds | none | about 8 | rabbit ear, rigid (`degree4.ts`) | first library |
| 5 | flapping bird | bird base | petal folds (front and back), inside reverse folds for neck and tail, wings | none | about 11 | the petal (rigid, `petal.ts`); the crane without the narrowing | first library |
| 6 | crane | bird base | petal folds, narrowing, inside reverse folds for neck, tail and head, wings | none | 13 (section 6) | narrowing through four layers, three reverse folds in a deep stack | first library (doc 13) |
| 7 | frog | frog base (preliminary, all four flaps squashed, then petalled) | squash, petal, narrowing on eight flaps, reverse folds for the legs | none | about 25 | squash (not checked yet: doc 11) | first library, after doc 11 proves the squash |
| 8 | lily | frog base | petal-like folds pulling the petals down, narrowing | the petals are curled at the end: a bend | about 20 | many flaps at once | first library, ending before the curl; the curl out (D1) |
| 9 | paper boat | blintz-like hat | valley folds, then opening the hat inside out twice | none, but the opening turns every layer through the others | about 10 | an opening of every layer, which D21 shows as the whole model opening | later |
| 10 | tulip | waterbomb base | valley folds, a tuck | inflated at the end (strain, not a fold); its stem is a second sheet | about 10 | | later (one sheet only; no inflate) |
| 11 | penguin | diagonal fold | valley folds, an outside reverse fold for the head | none | about 8 | nothing past the swan | later: in once a source confirms a traditional version (many variants are credited) |
| 12 | jumping frog | business card (a rectangle) | waterbomb-base corners, valley folds, a pleat for the spring | the jump is the paper's spring | about 12 | | out: possibly credited (Lewis and Oppenheimer, 1963) and its point is a spring |

Out of the first library for the engine's reasons, not the rights': any model with a sink (study 01,
3.11), with a cut (kirigami: the model is uncut paper, D2 rules out `C` edges), or that is a
modular of several sheets.
