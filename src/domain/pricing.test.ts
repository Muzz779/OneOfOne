import { describe, expect, it } from "vitest";
import {
  areaCm2FromMm,
  computeMargin,
  computePrice,
  DEFAULT_PRICING_CONFIG,
  formatZar,
  type PricingLineInput,
} from "./pricing";

const tee: PricingLineInput = {
  garmentRetailCents: 19900, // R199
  garmentSupplyCents: 6000, // R60
  quantity: 2,
  prints: [{ areaCm2: areaCm2FromMm(200, 280) }], // ~560 cm²
};

describe("computePrice", () => {
  it("adds a capped print charge to the garment retail per unit", () => {
    const b = computePrice([tee], { deliveryMethod: "PUDO" });
    const line = b.lines[0];
    // print charge is capped at R100
    expect(line.printChargeCents).toBeLessThanOrEqual(
      DEFAULT_PRICING_CONFIG.printChargeMaxCents,
    );
    expect(line.unitPriceCents).toBe(19900 + line.printChargeCents);
    expect(line.lineTotalCents).toBe(line.unitPriceCents * 2);
    expect(b.subtotalCents).toBe(line.lineTotalCents);
    expect(b.deliveryChargeCents).toBe(6000);
    expect(b.totalCents).toBe(b.subtotalCents + 6000);
  });

  it("charges no delivery for collection", () => {
    const b = computePrice([tee], { deliveryMethod: "COLLECTION" });
    expect(b.deliveryChargeCents).toBe(0);
  });

  it("applies a discount but never below zero subtotal", () => {
    const b = computePrice([tee], { deliveryMethod: "PUDO", discountCents: 999999 });
    expect(b.discountCents).toBe(b.subtotalCents);
    expect(b.totalCents).toBe(b.deliveryChargeCents);
  });
});

describe("computeMargin", () => {
  it("computes internal cost, gross profit and margin", () => {
    const b = computePrice([tee], { deliveryMethod: "PUDO" });
    const m = computeMargin([tee], b);
    expect(m.garmentCostCents).toBe(6000 * 2);
    expect(m.totalCostCents).toBe(
      m.garmentCostCents +
        m.printCostCents +
        m.packagingCostCents +
        m.deliveryCostCents +
        m.paymentFeeCents,
    );
    expect(m.grossProfitCents).toBe(b.totalCents - m.totalCostCents);
    expect(m.grossMarginPercent).toBeGreaterThan(0);
    expect(m.grossMarginPercent).toBeCloseTo(
      (m.grossProfitCents / b.totalCents) * 100,
      6,
    );
  });
});

describe("formatZar", () => {
  it("formats cents to Rands", () => {
    expect(formatZar(19900)).toBe("R199.00");
    expect(formatZar(0)).toBe("R0.00");
  });
});
