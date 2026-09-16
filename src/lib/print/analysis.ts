/**
 * Artwork quality analysis & production-resolution calculation
 * (CLAUDE.md §5, §10, §51, §59).
 *
 * Pure functions: given the intrinsic properties of an uploaded image and the
 * physical size the customer wants it printed at, decide whether it is suitable
 * for printing and what resolution the production file must be.
 *
 * This is the intellectual core of the platform's promise ("make it
 * print-ready") and is deliberately framework-agnostic and unit-tested.
 */

import {
  DEFAULT_QUALITY_THRESHOLDS,
  type PrinterSpec,
  type QualityThresholds,
} from "@/config/printer";
import { effectiveDpiForDimension, mmToPx, pxToMm } from "./units";

/** Intrinsic properties of an uploaded asset (measured server-side, §28). */
export interface ImageFacts {
  /** Intrinsic pixel dimensions of the raster. For vectors these may be the
   *  natural/viewBox size and are not the limiting factor. */
  readonly widthPx: number;
  readonly heightPx: number;
  /** Normalised upload format. */
  readonly format: "JPEG" | "PNG" | "SVG" | "PDF" | "TIFF" | "WEBP" | "OTHER";
  readonly fileSizeBytes: number;
  /** Whether the asset carries an alpha channel / real transparency. */
  readonly hasAlpha: boolean;
  /** True for scalable vector artwork (SVG, and vector-only PDFs). */
  readonly isVector: boolean;
}

/** A physical print target in millimetres. */
export interface PrintDimensionsMm {
  readonly widthMm: number;
  readonly heightMm: number;
}

export type QualityState =
  | "EXCELLENT"
  | "GOOD"
  | "NEEDS_ENHANCEMENT"
  | "TOO_LOW";

/** Customer-facing copy for each quality state (§5 — no technical jargon). */
export const QUALITY_MESSAGES: Record<QualityState, string> = {
  EXCELLENT: "Your image is high enough quality for this print size.",
  GOOD: "Your image should print well at this size.",
  NEEDS_ENHANCEMENT:
    "Your image is a little small for this print size. We recommend enhancing it.",
  TOO_LOW: "This image is too small to reliably print at this size.",
};

export interface ArtworkAnalysis {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly aspectRatio: number;
  readonly format: ImageFacts["format"];
  readonly fileSizeBytes: number;
  readonly hasAlpha: boolean;
  readonly isVector: boolean;

  /** Effective DPI achieved at the requested physical size (limiting axis). */
  readonly effectiveDpi: number;
  /** Pixel dimensions the production file must be at the printer's target DPI. */
  readonly requiredWidthPx: number;
  readonly requiredHeightPx: number;

  readonly quality: QualityState;
  readonly message: string;
  /** Enhancement is offered when it would meaningfully help (§6). */
  readonly enhancementRecommended: boolean;
  /** Enhancement is required to reach printable quality at all. */
  readonly enhancementRequired: boolean;
  /** True once effectiveDpi is at/above the printer target (headroom to spare). */
  readonly meetsTargetDpi: boolean;
}

/**
 * Effective DPI of a raster at a physical print size. Uses the LIMITING axis
 * (the smaller of the two per-axis DPIs) so we never overstate quality when the
 * artwork's aspect ratio differs from the print area.
 */
export function computeEffectiveDpi(
  facts: Pick<ImageFacts, "widthPx" | "heightPx">,
  print: PrintDimensionsMm,
): number {
  const dpiX = effectiveDpiForDimension(facts.widthPx, print.widthMm);
  const dpiY = effectiveDpiForDimension(facts.heightPx, print.heightMm);
  return Math.min(dpiX, dpiY);
}

/**
 * Analyse an uploaded asset against a chosen print size and the active printer
 * spec. Vector artwork short-circuits to EXCELLENT because it scales without
 * resolution loss (§7).
 */
export function analyzeArtwork(
  facts: ImageFacts,
  print: PrintDimensionsMm,
  spec: PrinterSpec,
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS,
): ArtworkAnalysis {
  const requiredWidthPx = mmToPx(print.widthMm, spec.dpi);
  const requiredHeightPx = mmToPx(print.heightMm, spec.dpi);
  const aspectRatio =
    facts.heightPx > 0 ? facts.widthPx / facts.heightPx : 0;

  // Vector artwork: resolution-independent — always print-ready.
  if (facts.isVector) {
    return {
      widthPx: facts.widthPx,
      heightPx: facts.heightPx,
      aspectRatio,
      format: facts.format,
      fileSizeBytes: facts.fileSizeBytes,
      hasAlpha: facts.hasAlpha,
      isVector: true,
      effectiveDpi: Infinity,
      requiredWidthPx,
      requiredHeightPx,
      quality: "EXCELLENT",
      message: QUALITY_MESSAGES.EXCELLENT,
      enhancementRecommended: false,
      enhancementRequired: false,
      meetsTargetDpi: true,
    };
  }

  const effectiveDpi = computeEffectiveDpi(facts, print);
  const excellentAt = spec.dpi * thresholds.excellentRatio;
  const goodAt = spec.dpi * thresholds.goodRatio;

  let quality: QualityState;
  if (effectiveDpi >= excellentAt) quality = "EXCELLENT";
  else if (effectiveDpi >= goodAt) quality = "GOOD";
  else if (effectiveDpi >= spec.minEffectiveDpi) quality = "NEEDS_ENHANCEMENT";
  else quality = "TOO_LOW";

  return {
    widthPx: facts.widthPx,
    heightPx: facts.heightPx,
    aspectRatio,
    format: facts.format,
    fileSizeBytes: facts.fileSizeBytes,
    hasAlpha: facts.hasAlpha,
    isVector: false,
    effectiveDpi,
    requiredWidthPx,
    requiredHeightPx,
    quality,
    message: QUALITY_MESSAGES[quality],
    // Offer enhancement whenever we are below the printer target but the source
    // is not hopeless; require it only when it is the only path to printable.
    enhancementRecommended:
      quality === "NEEDS_ENHANCEMENT" || quality === "GOOD",
    enhancementRequired: quality === "NEEDS_ENHANCEMENT",
    meetsTargetDpi: effectiveDpi >= excellentAt,
  };
}

/**
 * Largest physical print size (mm) at which a raster still meets a target DPI,
 * constrained to the printer's max bed. Useful to tell a customer "this image
 * is good up to N cm" and to clamp the editor.
 */
export function maxPrintSizeAtDpi(
  facts: Pick<ImageFacts, "widthPx" | "heightPx">,
  targetDpi: number,
  spec: PrinterSpec,
): PrintDimensionsMm {
  if (targetDpi <= 0) {
    return { widthMm: spec.maxPrintWidthMm, heightMm: spec.maxPrintHeightMm };
  }
  return {
    widthMm: Math.min(pxToMm(facts.widthPx, targetDpi), spec.maxPrintWidthMm),
    heightMm: Math.min(pxToMm(facts.heightPx, targetDpi), spec.maxPrintHeightMm),
  };
}
