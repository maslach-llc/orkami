// orkami: the fold engine. The core is plain geometry and scheduling with no runtime
// dependency; the drivers (css, three) and the adapters (vue) are separate entry points. The
// glyphs are the wordmark's letters as folds, a demo of letters as paper.
export * from './core/index.ts'
export * from './glyphs/index.ts'
