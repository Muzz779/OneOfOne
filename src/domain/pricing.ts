/**
 * Pricing engine (CLAUDE.md §16, §17, §55).
 *
 * Pure, server-authoritative pricing. Separates the CUSTOMER PRICE from the
 * INTERNAL COST + MARGIN (§17 — margin data must never reach the client). All
 * money is integer ZAR cents. Rates live in a configurable {@link PricingConfig}
 * (§55 — nothing hard-coded; the admin can change supplier/printer costs).
 */

export type DeliveryMethod = "PUDO" | "COLLECTION";

export interface PricingConfig {
  readonly currency: "ZAR";

  // Customer-facing print charge as a function of print area (cm²), capped.
  readonly printChargeBaseCents: number;
  readonly printChargePerCm2Cents: number;
  readonly printChargeMinCents: number;
  readonly printChargeMaxCents: number; // ~R100 cap (§16)

  // Internal print cost (admin-only, §17).
  readonly printCostBaseCents: number;
  readonly printCostPerCm2Cents: number;
  readonly printCostMaxCents: number;

  readonly packagingCostCents: number;
  readonly paymentFeePercent: number;
  readonly paymentFeeFixedCents: number;

  // Delivery: what the customer pays vs what it costs us.
  readonly deliveryChargeCents: number;
  readonly deliveryCostCents: number;
  readonly collectionChargeCents: number;
  readonly collectionCostCents: number;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  currency: "ZAR",
  printChargeBaseCents: 3000, // R30 base
  printChargePerCm2Cents: 12, // ~R0.12 per cm²
  printChargeMinCents: 3000,
  printChargeMaxCents: 10000, // R100 cap (§16)
  printCostBaseCents: 2000, // R20
  printCostPerCm2Cents: 8, // ~R0.08 per cm²
  printCostMaxCents: 10000,
  packagingCostCents: 1500, // R15
  paymentFeePercent: 2.9,
  paymentFeeFixedCents: 200, // R2
  deliveryChargeCents: 6000, // R60 PUDO
  deliveryCostCents: 5000, // R50
  collectionChargeCents: 0,
  collectionCostCents: 0,
};

/** One printed side's physical print area, in cm². */
export interface PrintSpecInput {
  readonly areaCm2: number;
}

export interface PricingLineInput {
  /** Admin-set retail price of the garment (product.basePriceCents). */
  readonly garmentRetailCents: number;
  /** Indicative supply cost of the garment (product.supplyCostCents). */
  readonly garmentSupplyCents: number;
  readonly quantity: number;
  /** One entry per printed side. */
  readonly prints: readonly PrintSpecInput[];
}

export interface PricingLineResult {
  readonly quantity: number;
  readonly garmentRetailCents: number;
  readonly printChargeCents: number;
  readonly unitPriceCents: number;
  readonly lineTotalCents: number;
}

/** Internal cost + margin block — ADMIN ONLY, never sent to customers (§17). */
export interface MarginBreakdown {
  readonly garmentCostCents: number;
  readonly printCostCents: number;
  readonly packagingCostCents: number;
  readonly deliveryCostCents: number;
  readonly paymentFeeCents: number;
  readonly totalCostCents: number;
  readonly grossProfitCents: number;
  readonly grossMarginPercent: number;
}

export interface PriceBreakdown {
  readonly currency: "ZAR";
  readonly lines: readonly PricingLineResult[];
  readonly subtotalCents: number;
  readonly deliveryMethod: DeliveryMethod;
  readonly deliveryChargeCents: number;
  readonly discountCents: number;
  readonly totalCents: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function printCharge(areaCm2: number, c: PricingConfig): number {
  const raw = c.printChargeBaseCents + areaCm2 * c.printChargePerCm2Cents;
  return Math.round(clamp(raw, c.printChargeMinCents, c.printChargeMaxCents));
}

function printCost(areaCm2: number, c: PricingConfig): number {
  const raw = c.printCostBaseCents + areaCm2 * c.printCostPerCm2Cents;
  return Math.round(clamp(raw, 0, c.printCostMaxCents));
}

export interface PriceOptions {
  readonly deliveryMethod: DeliveryMethod;
  readonly discountCents?: number;
}

/** Compute the customer-facing price for a set of lines. */
export function computePrice(
  lines: readonly PricingLineInput[],
  opts: PriceOptions,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): PriceBreakdown {
  const resultLines: PricingLineResult[] = lines.map((line) => {
    const printChargeCents = line.prints.reduce(
      (sum, p) => sum + printCharge(p.areaCm2, config),
      0,
    );
    const unitPriceCents = line.garmentRetailCents + printChargeCents;
    return {
      quantity: line.quantity,
      garmentRetailCents: line.garmentRetailCents,
      printChargeCents,
      unitPriceCents,
      lineTotalCents: unitPriceCents * line.quantity,
    };
  });

  const subtotalCents = resultLines.reduce((s, l) => s + l.lineTotalCents, 0);
  const deliveryChargeCents =
    opts.deliveryMethod === "COLLECTION"
      ? config.collectionChargeCents
      : config.deliveryChargeCents;
  const discountCents = Math.max(0, Math.min(opts.discountCents ?? 0, subtotalCents));
  const totalCents = subtotalCents + deliveryChargeCents - discountCents;

  return {
    currency: config.currency,
    lines: resultLines,
    subtotalCents,
    deliveryMethod: opts.deliveryMethod,
    deliveryChargeCents,
    discountCents,
    totalCents,
  };
}

/**
 * Compute internal cost + margin for an order (§17). Requires the same inputs
 * plus the customer total from {@link computePrice}. Returned to admins only.
 */
export function computeMargin(
  lines: readonly PricingLineInput[],
  breakdown: PriceBreakdown,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): MarginBreakdown {
  let garmentCostCents = 0;
  let printCostCents = 0;
  let packagingCostCents = 0;

  for (const line of lines) {
    garmentCostCents += line.garmentSupplyCents * line.quantity;
    printCostCents +=
      line.prints.reduce((s, p) => s + printCost(p.areaCm2, config), 0) *
      line.quantity;
    packagingCostCents += config.packagingCostCents * line.quantity;
  }

  const deliveryCostCents =
    breakdown.deliveryMethod === "COLLECTION"
      ? config.collectionCostCents
      : config.deliveryCostCents;

  const paymentFeeCents = Math.round(
    (breakdown.totalCents * config.paymentFeePercent) / 100 +
      config.paymentFeeFixedCents,
  );

  const totalCostCents =
    garmentCostCents +
    printCostCents +
    packagingCostCents +
    deliveryCostCents +
    paymentFeeCents;

  const grossProfitCents = breakdown.totalCents - totalCostCents;
  const grossMarginPercent =
    breakdown.totalCents > 0
      ? (grossProfitCents / breakdown.totalCents) * 100
      : 0;

  return {
    garmentCostCents,
    printCostCents,
    packagingCostCents,
    deliveryCostCents,
    paymentFeeCents,
    totalCostCents,
    grossProfitCents,
    grossMarginPercent,
  };
}

/** Format ZAR cents as a display string, e.g. 19900 → "R199.00". */
export function formatZar(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

/** Area in cm² from a print box in millimetres. */
export function areaCm2FromMm(widthMm: number, heightMm: number): number {
  return (widthMm / 10) * (heightMm / 10);
}
