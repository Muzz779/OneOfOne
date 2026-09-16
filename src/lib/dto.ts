/**
 * Client-facing DTOs (shared, no server imports).
 *
 * The shapes the API returns to the browser. Deliberately excludes any internal
 * cost/margin data (§17) and storage keys (§27) — only signed URLs cross the
 * boundary.
 */

import type { ImageFacts } from "./print/analysis";
import type { Placement } from "./print/placement";
import type { PrintSide } from "@/domain/products";
import type { PriceBreakdown } from "@/domain/pricing";

export interface ProcessingNote {
  readonly kind: "ENHANCE" | "BG_REMOVE";
  readonly provider: string;
  readonly note: string;
  readonly removedFraction?: number;
  readonly noop?: boolean;
}

export interface SideArtworkDTO {
  readonly side: PrintSide;
  readonly facts: ImageFacts;
  readonly placement: Placement;
  readonly version: number;
  /** Signed URL of the current (working) artwork for preview. */
  readonly workingUrl: string;
  /** Set on the side that was just enhanced / background-removed. */
  readonly lastProcessing?: ProcessingNote;
}

export interface DesignDTO {
  readonly id: string;
  readonly productId: string;
  readonly colour: string;
  readonly size: string;
  readonly activeSide: PrintSide;
  /** Only sides that have artwork. */
  readonly sides: readonly SideArtworkDTO[];
  readonly status: "DRAFT" | "READY";
  readonly updatedAt: string;
}

export interface CartItemDTO {
  readonly itemId: string;
  readonly designId: string;
  readonly productName: string;
  readonly colour: string;
  readonly size: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly thumbUrl: string;
}

export interface CartViewDTO {
  readonly cartId: string;
  readonly items: readonly CartItemDTO[];
  readonly breakdown: PriceBreakdown;
}
