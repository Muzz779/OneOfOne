/**
 * Shared design geometry (CLAUDE.md §52).
 *
 * One place that turns (artwork aspect + placement + product/side + printer
 * spec) into the physical print box and area maximums — used by BOTH the client
 * editor and the server production/enhancement pipeline so preview and output
 * always agree.
 */

import type { PrinterSpec } from "@/config/printer";
import { getPrintArea, type PrintArea, type PrintSide, type Product } from "@/domain/products";
import type { ImageFacts, PrintDimensionsMm } from "./analysis";
import type { Placement } from "./placement";
import { fitWithin } from "./placement";

export interface AreaBounds {
  readonly area: PrintArea;
  readonly maxWidthMm: number;
  readonly maxHeightMm: number;
}

/** Effective printable maximums = min(product area, printer bed). */
export function areaBounds(
  product: Product,
  side: PrintSide,
  spec: PrinterSpec,
): AreaBounds {
  const area = getPrintArea(product, side) ?? product.printAreas[0];
  return {
    area,
    maxWidthMm: Math.min(area.maxWidthMm, spec.maxPrintWidthMm),
    maxHeightMm: Math.min(area.maxHeightMm, spec.maxPrintHeightMm),
  };
}

export function aspectOf(facts: Pick<ImageFacts, "widthPx" | "heightPx">): number {
  return facts.heightPx > 0 ? facts.widthPx / facts.heightPx : 1;
}

/** Physical print box (mm) for the given size fraction, preserving aspect. */
export function printBoxFor(
  aspect: number,
  sizeFrac: number,
  maxWidthMm: number,
  maxHeightMm: number,
): PrintDimensionsMm {
  const fit = fitWithin(aspect, maxWidthMm, maxHeightMm);
  return { widthMm: fit.widthMm * sizeFrac, heightMm: fit.heightMm * sizeFrac };
}

/** Convenience: resolve the print box for a full design placement. */
export function designPrintBox(
  facts: ImageFacts,
  placement: Placement,
  product: Product,
  side: PrintSide,
  spec: PrinterSpec,
): { printBox: PrintDimensionsMm; bounds: AreaBounds } {
  const bounds = areaBounds(product, side, spec);
  const printBox = printBoxFor(
    aspectOf(facts),
    placement.sizeFrac,
    bounds.maxWidthMm,
    bounds.maxHeightMm,
  );
  return { printBox, bounds };
}
