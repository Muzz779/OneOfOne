/**
 * Funnel analytics (CLAUDE.md §44).
 *
 * A minimal event model tracking the conversion funnel without collecting
 * unnecessary personal information (§44). Events carry a type and small,
 * non-identifying props only.
 */

export const FUNNEL_STEPS = [
  "LANDING",
  "UPLOAD",
  "QUALITY_ANALYSIS",
  "ENHANCEMENT",
  "BACKGROUND_REMOVAL",
  "PRODUCT_SELECTED",
  "DESIGN_COMPLETED",
  "ADD_TO_CART",
  "CHECKOUT_STARTED",
  "PAYMENT_SUCCESS",
  "ORDER_COMPLETED",
  "PREFLIGHT_FAILED",
  "REFUND",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export interface AnalyticsEvent {
  readonly id: string;
  readonly type: FunnelStep;
  readonly at: string;
  /** Small non-PII properties (product id, quality state, size bucket, ...). */
  readonly props?: Record<string, string | number | boolean>;
}
