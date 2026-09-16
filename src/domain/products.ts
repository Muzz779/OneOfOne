/**
 * Product & print-area domain model (CLAUDE.md §9, §14).
 *
 * Products are data-driven: nothing here is hard-coded into UI components.
 * Each product declares the garment's real printable regions (per side, in
 * millimetres) so the editor can constrain artwork to where it can actually be
 * printed — different garments have different print areas.
 *
 * This module is a typed, in-memory seed for the Phase-1 slice. It will be
 * backed by the database later (§38: products, product_variants, print_areas).
 */

export type PrintSide = "FRONT" | "BACK" | "LEFT_SLEEVE" | "RIGHT_SLEEVE";

/** A rectangular printable region on one side of a garment, in millimetres. */
export interface PrintArea {
  readonly side: PrintSide;
  /** Human label, e.g. "Front (A4)". */
  readonly label: string;
  /** Maximum printable box for this side. */
  readonly maxWidthMm: number;
  readonly maxHeightMm: number;
  /**
   * Offset of the print box from the garment mockup's top-left, as a fraction
   * (0–1) of the mockup image. Lets the editor overlay the boundary correctly
   * on each garment without hard-coding pixel positions.
   */
  readonly mockupBox: {
    readonly xPct: number;
    readonly yPct: number;
    readonly widthPct: number;
    readonly heightPct: number;
  };
}

export interface GarmentColour {
  readonly name: string;
  /** Display hex for swatches (mockup tint is separate art, §13). */
  readonly hex: string;
}

export type GarmentSize = "XS" | "S" | "M" | "L" | "XL" | "2XL" | "3XL";

export interface Product {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly category: "tshirt" | "hoodie" | "other";
  readonly description: string;
  /** Base garment price to the customer, in ZAR cents (server owns pricing §16). */
  readonly basePriceCents: number;
  /** Indicative internal supply cost, ZAR cents — configurable, never shown to
   *  customers (§16, §17, §55). Planning figure only. */
  readonly supplyCostCents: number;
  readonly sizes: readonly GarmentSize[];
  readonly colours: readonly GarmentColour[];
  readonly printSides: readonly PrintSide[];
  readonly printAreas: readonly PrintArea[];
  readonly active: boolean;
}

/** Look up the printable region for a given side of a product. */
export function getPrintArea(
  product: Product,
  side: PrintSide,
): PrintArea | undefined {
  return product.printAreas.find((a) => a.side === side);
}

const STANDARD_APPAREL_SIZES: readonly GarmentSize[] = [
  "S",
  "M",
  "L",
  "XL",
  "2XL",
];

const CORE_COLOURS: readonly GarmentColour[] = [
  { name: "Black", hex: "#111111" },
  { name: "White", hex: "#FAFAFA" },
  { name: "Sand", hex: "#D9C7A8" },
  { name: "Navy", hex: "#1B2A4A" },
];

/**
 * Seed catalogue for the vertical slice. Indicative supply costs from §55
 * (T-shirt ≈ R60, Hoodie ≈ R300) — planning figures, admin-configurable later.
 */
export const SEED_PRODUCTS: readonly Product[] = [
  {
    id: "prod_tshirt_classic",
    slug: "classic-tee",
    name: "Classic Tee",
    category: "tshirt",
    description:
      "180gsm combed-cotton crew neck. Print anything across the front or back.",
    basePriceCents: 19900, // R199.00 indicative retail
    supplyCostCents: 6000, // ≈ R60 (§55)
    sizes: STANDARD_APPAREL_SIZES,
    colours: CORE_COLOURS,
    printSides: ["FRONT", "BACK"],
    printAreas: [
      {
        side: "FRONT",
        label: "Front (A4)",
        maxWidthMm: 210,
        maxHeightMm: 297,
        mockupBox: { xPct: 0.31, yPct: 0.24, widthPct: 0.38, heightPct: 0.46 },
      },
      {
        side: "BACK",
        label: "Back (A3)",
        maxWidthMm: 297,
        maxHeightMm: 420,
        mockupBox: { xPct: 0.28, yPct: 0.2, widthPct: 0.44, heightPct: 0.56 },
      },
    ],
    active: true,
  },
  {
    id: "prod_hoodie_heavy",
    slug: "heavy-hoodie",
    name: "Heavyweight Hoodie",
    category: "hoodie",
    description:
      "350gsm brushed-fleece pullover hoodie. Bold prints, built to last.",
    basePriceCents: 54900, // R549.00 indicative retail
    supplyCostCents: 30000, // ≈ R300 (§55)
    sizes: STANDARD_APPAREL_SIZES,
    colours: CORE_COLOURS,
    printSides: ["FRONT", "BACK"],
    printAreas: [
      {
        side: "FRONT",
        label: "Front (A4, above pocket)",
        maxWidthMm: 210,
        maxHeightMm: 250,
        mockupBox: { xPct: 0.33, yPct: 0.26, widthPct: 0.34, heightPct: 0.34 },
      },
      {
        side: "BACK",
        label: "Back (A3)",
        maxWidthMm: 297,
        maxHeightMm: 420,
        mockupBox: { xPct: 0.28, yPct: 0.2, widthPct: 0.44, heightPct: 0.56 },
      },
    ],
    active: true,
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return SEED_PRODUCTS.find((p) => p.slug === slug && p.active);
}

export function getProductById(id: string): Product | undefined {
  return SEED_PRODUCTS.find((p) => p.id === id);
}
