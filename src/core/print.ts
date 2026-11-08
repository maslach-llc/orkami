// Printing on the faces (D17): a picture lies on the sheet in sheet coordinates, and each face
// carries exactly the part of it that lies under the face when the paper is flat. Folding moves
// the face and its part of the picture together, so at t = 1 the faces join into the whole picture
// with no seam, and at t = 0 the picture is folded inside the paper like ink on a real sheet.
//
// The drivers only apply what this module computes: the CSS driver turns `facePrint` into a front
// side's `background-size` / `background-position` (the same arithmetic as the sheet paint's
// `--ori-sx/--ori-sy`, an offset that puts sheet point (0, 0) where it belongs), the WebGL driver
// turns `printUv` into each front's UVs. Pure math: no DOM, no image decoding.
import type { Pt } from './affine.ts'
import { face as faceOf, type FaceId, type Fold } from './fold.ts'

/** How a picture fits the sheet: scaled to cover it (cropped), to fit inside it (bands of paper), or stretched to it. */
export type PrintFit = 'cover' | 'contain' | 'fill'

/** An image printed on the sheet's front. `position` is where the picture sits when it does not match the sheet's shape, as fractions [x, y] (0 left / top, 1 right / bottom), the center by default, as CSS `background-position` percentages. */
export interface ImagePrint {
  image: string
  fit?: PrintFit
  position?: [number, number]
}

/** A rectangle in sheet px. */
export interface Rect { x: number; y: number; w: number; h: number }

/** The bounding box of a polygon. */
export function boundsOf(pts: readonly Pt[]): Rect {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/**
 * Where a picture of `image` size lies on the sheet, in sheet px. Without a size (not decoded yet,
 * or an SVG with no intrinsic size) or with `fit: 'fill'` it is the sheet itself.
 */
export function printRect(sheet: { width: number; height: number }, image?: { width: number; height: number }, fit: PrintFit = 'cover', position: readonly [number, number] = [0.5, 0.5]): Rect {
  const W = sheet.width, H = sheet.height
  if (!image || !(image.width > 0) || !(image.height > 0) || fit === 'fill') return { x: 0, y: 0, w: W, h: H }
  const s = fit === 'cover' ? Math.max(W / image.width, H / image.height) : Math.min(W / image.width, H / image.height)
  const w = image.width * s, h = image.height * s
  return { x: (W - w) * position[0], y: (H - h) * position[1], w, h }
}

/**
 * A face's part of the print, for a driver that draws each face in a box of its own bounds:
 * `box` (the face's bounds in sheet px), `size` (the picture's size) and `offset` (where the
 * picture's top left corner lies in the box: `rect` less the box's origin). With the picture
 * matching the sheet, `offset` is `-box`, the sheet's (0, 0) at the picture's top left.
 */
export function facePrint(fold: Fold, faceId: FaceId, rect: Rect = printRect(fold.sheet)): { box: Rect; size: [number, number]; offset: [number, number] } {
  const box = boundsOf(faceOf(fold, faceId).pts)
  return { box, size: [rect.w, rect.h], offset: [rect.x - box.x, rect.y - box.y] }
}

/** The texture coordinate of a sheet point in the picture lying at `rect`, in three's convention (u right, v up from the picture's bottom). Outside [0, 1] is paper with no print. */
export function printUv([x, y]: Pt, rect: Rect): [number, number] {
  return [(x - rect.x) / rect.w, 1 - (y - rect.y) / rect.h]
}

/** The part of the picture a face carries: its polygon in the picture's own fractions (x right, y down). The faces' parts tile the picture where it covers the sheet. */
export function printPolygon(fold: Fold, faceId: FaceId, rect: Rect = printRect(fold.sheet)): Pt[] {
  return faceOf(fold, faceId).pts.map(([x, y]) => [(x - rect.x) / rect.w, (y - rect.y) / rect.h])
}

/** Whether a print mode is an image. */
export const isImagePrint = (p: unknown): p is ImagePrint => typeof p === 'object' && p !== null && typeof (p as ImagePrint).image === 'string'
