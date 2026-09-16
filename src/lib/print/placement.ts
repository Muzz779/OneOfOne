/**
 * Placement geometry helpers (CLAUDE.md §9, §10, §11).
 *
 * Pure helpers for fitting artwork inside a garment's printable area while
 * preserving aspect ratio. Shared by the studio editor and (later) the
 * production-artwork generator so preview and output agree (§52).
 */

import type { PrintDimensionsMm } from "./analysis";

export interface Box {
  readonly widthMm: number;
  readonly heightMm: number;
}

/**
 * Placement of artwork within a printable area, stored relative to the area so
 * it survives product/side/size changes:
 *  - sizeFrac  : artwork size as a fraction (0–1) of the fit-to-area box
 *  - posXFrac  : artwork centre X as a fraction (0–1) of the area width
 *  - posYFrac  : artwork centre Y as a fraction (0–1) of the area height
 *  - rotationDeg
 */
export interface Placement {
  readonly sizeFrac: number;
  readonly posXFrac: number;
  readonly posYFrac: number;
  readonly rotationDeg: number;
}

export const DEFAULT_PLACEMENT: Placement = {
  sizeFrac: 1,
  posXFrac: 0.5,
  posYFrac: 0.5,
  rotationDeg: 0,
};

/**
 * Axis-aligned half-extents of a rotated rectangle. Used to keep a rotated
 * artwork's bounding box inside the printable area (§9).
 */
export function rotatedHalfExtentsMm(
  widthMm: number,
  heightMm: number,
  rotationDeg: number,
): { rxMm: number; ryMm: number } {
  const r = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  const hw = widthMm / 2;
  const hh = heightMm / 2;
  return {
    rxMm: hw * cos + hh * sin,
    ryMm: hw * sin + hh * cos,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  if (lo > hi) return (lo + hi) / 2; // artwork larger than area on this axis → centre
  return Math.min(Math.max(v, lo), hi);
}

/**
 * Clamp an artwork centre (in mm, area-local coords) so the rotated bounding
 * box stays inside a maxWidthMm × maxHeightMm printable area.
 */
export function clampCenterMm(
  centerXmm: number,
  centerYmm: number,
  widthMm: number,
  heightMm: number,
  rotationDeg: number,
  maxWidthMm: number,
  maxHeightMm: number,
): { xMm: number; yMm: number } {
  const { rxMm, ryMm } = rotatedHalfExtentsMm(widthMm, heightMm, rotationDeg);
  return {
    xMm: clamp(centerXmm, rxMm, maxWidthMm - rxMm),
    yMm: clamp(centerYmm, ryMm, maxHeightMm - ryMm),
  };
}

/** Largest box with the given aspect ratio (w/h) that fits inside maxW×maxH. */
export function fitWithin(
  aspectRatio: number,
  maxWidthMm: number,
  maxHeightMm: number,
): PrintDimensionsMm {
  if (aspectRatio <= 0) {
    return { widthMm: maxWidthMm, heightMm: maxHeightMm };
  }
  // Try full width first.
  let widthMm = maxWidthMm;
  let heightMm = widthMm / aspectRatio;
  if (heightMm > maxHeightMm) {
    heightMm = maxHeightMm;
    widthMm = heightMm * aspectRatio;
  }
  return { widthMm, heightMm };
}

/**
 * Derive a print box from a chosen width, keeping aspect ratio and clamping to
 * the printable-area maximums. If the derived height overflows, the width is
 * reduced so the box still fits.
 */
export function boxFromWidth(
  widthMm: number,
  aspectRatio: number,
  maxWidthMm: number,
  maxHeightMm: number,
): PrintDimensionsMm {
  const w = Math.min(Math.max(widthMm, 1), maxWidthMm);
  let heightMm = aspectRatio > 0 ? w / aspectRatio : maxHeightMm;
  let finalWidth = w;
  if (heightMm > maxHeightMm) {
    heightMm = maxHeightMm;
    finalWidth = aspectRatio > 0 ? heightMm * aspectRatio : w;
  }
  return { widthMm: finalWidth, heightMm };
}
