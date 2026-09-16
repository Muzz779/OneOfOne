/**
 * Physical ↔ pixel unit conversions (CLAUDE.md §10).
 *
 * All print maths is done in millimetres internally. These helpers are the
 * ONLY place inches/DPI arithmetic lives, so the "how many pixels does this
 * physical size need" question has exactly one answer (§57.8 — no scattered
 * magic numbers).
 */

export const MM_PER_INCH = 25.4;

/** Millimetres → inches. */
export function mmToInch(mm: number): number {
  return mm / MM_PER_INCH;
}

/** Inches → millimetres. */
export function inchToMm(inch: number): number {
  return inch * MM_PER_INCH;
}

/** Centimetres → millimetres. */
export function cmToMm(cm: number): number {
  return cm * 10;
}

/** Millimetres → centimetres. */
export function mmToCm(mm: number): number {
  return mm / 10;
}

/**
 * Pixels required to reproduce a physical length at a given DPI, rounded up so
 * we never under-provision resolution for production.
 *
 * e.g. mmToPx(400, 300) → ceil(400/25.4 * 300) = 4724 px  (matches §1.1 example)
 */
export function mmToPx(mm: number, dpi: number): number {
  return Math.ceil(mmToInch(mm) * dpi);
}

/** Physical length (mm) that a pixel count spans at a given DPI. */
export function pxToMm(px: number, dpi: number): number {
  return inchToMm(px / dpi);
}

/**
 * The effective DPI a given pixel count achieves when stretched across a
 * physical length. Lower physical size or more pixels → higher effective DPI.
 */
export function effectiveDpiForDimension(px: number, mm: number): number {
  if (mm <= 0) return 0;
  return px / mmToInch(mm);
}
