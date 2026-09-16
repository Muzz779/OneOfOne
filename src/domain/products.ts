/**
 * Product & print-area domain model (CLAUDE.md §9, §14).
 *
 * Products are data-driven: nothing here is hard-coded into UI components.
 * Each product declares the garment's real printable regions per side (front,
 * back and sleeves) in millimetres so the editor can constrain artwork to where
 * it can actually be printed — different garments have different print areas.
 */

import type { GarmentKind } from "./garment-shape";

export type PrintSide = "FRONT" | "BACK" | "LEFT_SLEEVE" | "RIGHT_SLEEVE";

/** A rectangular printable region on one side of a garment, in millimetres. */
export interface PrintArea {
  readonly side: PrintSide;
  readonly label: string;
  readonly maxWidthMm: number;
  readonly maxHeightMm: number;
  /** Offset of the print box on the garment mockup, as fractions (0–1). */
  readonly mockupBox: {
    readonly xPct: number;
    readonly yPct: number;
    readonly widthPct: number;
    readonly heightPct: number;
  };
}

export interface GarmentColour {
  readonly name: string;
  readonly hex: string;
}

export type GarmentSize = "XS" | "S" | "M" | "L" | "XL" | "2XL" | "3XL";

export interface Product {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly category: "tshirt" | "hoodie" | "jacket" | "other";
  /** Which schematic silhouette to draw (decoupled from category). */
  readonly silhouette: GarmentKind;
  readonly description: string;
  readonly basePriceCents: number;
  readonly supplyCostCents: number;
  readonly sizes: readonly GarmentSize[];
  readonly colours: readonly GarmentColour[];
  readonly printSides: readonly PrintSide[];
  readonly printAreas: readonly PrintArea[];
  readonly active: boolean;
}

export function getPrintArea(product: Product, side: PrintSide): PrintArea | undefined {
  return product.printAreas.find((a) => a.side === side);
}

const STANDARD_SIZES: readonly GarmentSize[] = ["S", "M", "L", "XL", "2XL"];

const CORE_COLOURS: readonly GarmentColour[] = [
  { name: "Black", hex: "#111111" },
  { name: "White", hex: "#FAFAFA" },
  { name: "Sand", hex: "#D9C7A8" },
  { name: "Navy", hex: "#1B2A4A" },
];

const JACKET_COLOURS: readonly GarmentColour[] = [
  ...CORE_COLOURS,
  { name: "Olive", hex: "#4B5320" },
];

/** Left/right sleeve printable areas (small, upper-sleeve). */
function sleeveArea(side: "LEFT_SLEEVE" | "RIGHT_SLEEVE"): PrintArea {
  const left = side === "LEFT_SLEEVE";
  return {
    side,
    label: left ? "Left sleeve" : "Right sleeve",
    maxWidthMm: 90,
    maxHeightMm: 110,
    mockupBox: left
      ? { xPct: 0.06, yPct: 0.21, widthPct: 0.14, heightPct: 0.12 }
      : { xPct: 0.8, yPct: 0.21, widthPct: 0.14, heightPct: 0.12 },
  };
}

const SLEEVE_SIDES: readonly PrintSide[] = ["LEFT_SLEEVE", "RIGHT_SLEEVE"];
const SLEEVE_AREAS: readonly PrintArea[] = [sleeveArea("LEFT_SLEEVE"), sleeveArea("RIGHT_SLEEVE")];

export const SEED_PRODUCTS: readonly Product[] = [
  {
    id: "prod_tshirt_classic",
    slug: "classic-tee",
    name: "Classic Tee",
    category: "tshirt",
    silhouette: "tee",
    description: "180gsm combed-cotton crew neck. Print the front, back or sleeves.",
    basePriceCents: 19900,
    supplyCostCents: 6000,
    sizes: STANDARD_SIZES,
    colours: CORE_COLOURS,
    printSides: ["FRONT", "BACK", ...SLEEVE_SIDES],
    printAreas: [
      { side: "FRONT", label: "Front (A4)", maxWidthMm: 210, maxHeightMm: 297, mockupBox: { xPct: 0.31, yPct: 0.24, widthPct: 0.38, heightPct: 0.46 } },
      { side: "BACK", label: "Back (A3)", maxWidthMm: 297, maxHeightMm: 420, mockupBox: { xPct: 0.28, yPct: 0.2, widthPct: 0.44, heightPct: 0.56 } },
      ...SLEEVE_AREAS,
    ],
    active: true,
  },
  {
    id: "prod_hoodie_heavy",
    slug: "heavy-hoodie",
    name: "Heavyweight Hoodie",
    category: "hoodie",
    silhouette: "hoodie",
    description: "350gsm brushed-fleece pullover hoodie. Bold prints, built to last.",
    basePriceCents: 54900,
    supplyCostCents: 30000,
    sizes: STANDARD_SIZES,
    colours: CORE_COLOURS,
    printSides: ["FRONT", "BACK", ...SLEEVE_SIDES],
    printAreas: [
      { side: "FRONT", label: "Front (A4, above pocket)", maxWidthMm: 210, maxHeightMm: 250, mockupBox: { xPct: 0.33, yPct: 0.26, widthPct: 0.34, heightPct: 0.34 } },
      { side: "BACK", label: "Back (A3)", maxWidthMm: 297, maxHeightMm: 420, mockupBox: { xPct: 0.28, yPct: 0.2, widthPct: 0.44, heightPct: 0.56 } },
      ...SLEEVE_AREAS,
    ],
    active: true,
  },
  {
    id: "prod_jacket_cotton",
    slug: "cotton-jacket",
    name: "Cotton Jacket",
    category: "jacket",
    silhouette: "jacket",
    description: "Structured cotton-twill zip jacket. Clean lines, easy to brand.",
    basePriceCents: 69900,
    supplyCostCents: 35000,
    sizes: STANDARD_SIZES,
    colours: JACKET_COLOURS,
    printSides: ["FRONT", "BACK", ...SLEEVE_SIDES],
    printAreas: [
      { side: "FRONT", label: "Front (A5, chest)", maxWidthMm: 180, maxHeightMm: 240, mockupBox: { xPct: 0.34, yPct: 0.26, widthPct: 0.32, heightPct: 0.4 } },
      { side: "BACK", label: "Back (A3)", maxWidthMm: 297, maxHeightMm: 420, mockupBox: { xPct: 0.27, yPct: 0.22, widthPct: 0.46, heightPct: 0.56 } },
      ...SLEEVE_AREAS,
    ],
    active: true,
  },
  {
    id: "prod_jacket_softshell",
    slug: "softshell-jacket",
    name: "Softshell Jacket",
    category: "jacket",
    silhouette: "jacket",
    description: "Water-resistant bonded softshell. Warm, weatherproof, corporate-ready.",
    basePriceCents: 89900,
    supplyCostCents: 48000,
    sizes: STANDARD_SIZES,
    colours: JACKET_COLOURS,
    printSides: ["FRONT", "BACK", ...SLEEVE_SIDES],
    printAreas: [
      { side: "FRONT", label: "Front (A5, chest)", maxWidthMm: 180, maxHeightMm: 240, mockupBox: { xPct: 0.34, yPct: 0.26, widthPct: 0.32, heightPct: 0.4 } },
      { side: "BACK", label: "Back (A3)", maxWidthMm: 297, maxHeightMm: 420, mockupBox: { xPct: 0.27, yPct: 0.22, widthPct: 0.46, heightPct: 0.56 } },
      ...SLEEVE_AREAS,
    ],
    active: true,
  },
  {
    id: "prod_jacket_puffer",
    slug: "puffer-jacket",
    name: "Puffer Jacket",
    category: "jacket",
    silhouette: "puffer",
    description: "Insulated quilted puffer. Statement outerwear for cold-weather drops.",
    basePriceCents: 109900,
    supplyCostCents: 62000,
    sizes: STANDARD_SIZES,
    colours: JACKET_COLOURS,
    printSides: ["FRONT", "BACK", ...SLEEVE_SIDES],
    printAreas: [
      { side: "FRONT", label: "Front (A5, chest)", maxWidthMm: 170, maxHeightMm: 220, mockupBox: { xPct: 0.35, yPct: 0.26, widthPct: 0.3, heightPct: 0.34 } },
      { side: "BACK", label: "Back (A3)", maxWidthMm: 297, maxHeightMm: 420, mockupBox: { xPct: 0.27, yPct: 0.22, widthPct: 0.46, heightPct: 0.54 } },
      ...SLEEVE_AREAS,
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
