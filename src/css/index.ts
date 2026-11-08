// orkami/css: the CSS driver and the sheet paint. Imports cleanly without a DOM (nothing here
// touches `document` or `window` until it is called), so a server can render a page that uses
// it; `orkami/orkami.css` carries the rules the flaps rely on.
export { mount, castShadow, grainUrl, sidePolygon, fits, CONTENT_FACES, type Handle, type MountOptions, type Drive, type State, type Print } from './driver.ts'
export { paintSheet, trackSheet, measureSheet, paintOffset, resolveSheet, pageColors, type SheetSpec, type SheetMode, type PaintOptions } from './sheet.ts'
export * from './sheets/folded.ts'
