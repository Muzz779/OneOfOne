/**
 * Shared garment vector shapes (CLAUDE.md §13, §57.3).
 *
 * One source of truth for the schematic garment outlines, consumed by BOTH the
 * client React silhouette and the server-side SVG mockup builder — so the
 * customer preview and the derived mockup are the same shape (§4).
 *
 * Each garment has a FRONT and BACK view: same body outline, but the front
 * shows collar rib / hood opening / pocket / drawstrings, while the back shows a
 * yoke seam / full hood dome and no pocket.
 */

import type { Product } from "./products";
import type { PrintSide } from "./products";

export const GARMENT_VIEWBOX = { w: 100, h: 120 } as const;

export type GarmentView = "front" | "back";

export interface GarmentPath {
  readonly d: string;
  /** body = fill with garment colour + ink stroke; seam = stroke only. */
  readonly role: "body" | "seam";
}

export function viewForSide(side: PrintSide): GarmentView {
  return side === "BACK" ? "back" : "front";
}

export function isLightHex(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

// --- Tee -------------------------------------------------------------------

// Body outline with set-in sleeves and a gentle crew neck. Shared front/back.
const TEE_BODY =
  "M42 13 C45 18 55 18 58 13 L70 13 L90 20 L96 33 L86 44 L76 37 L76 112 L24 112 L24 37 L14 44 L4 33 L10 20 L30 13 Z";
const TEE_COLLAR_FRONT = "M40 13 C44 19 56 19 60 13";
const TEE_YOKE_BACK = "M30 14 L70 14";
const TEE_HEM = "M24 106 L76 106";
const TEE_SLEEVE_L = "M8 31 L16 40";
const TEE_SLEEVE_R = "M92 31 L84 40";

// --- Hoodie ----------------------------------------------------------------

const HOODIE_BODY =
  "M42 16 C45 24 55 24 58 16 L72 16 L92 23 L98 37 L88 48 L77 41 L77 112 L23 112 L23 41 L12 48 L2 37 L8 23 L28 16 Z";
const HOODIE_HOOD_FRONT =
  "M30 17 C27 1 73 1 70 17 C64 11 60 13 58 16 C55 23 45 23 42 16 C40 13 36 11 30 17 Z";
const HOODIE_HOOD_BACK = "M28 18 C24 -3 76 -3 72 18 C62 9 38 9 28 18 Z";
const HOODIE_POCKET = "M35 78 L65 78 L61 98 L39 98 Z";
const HOODIE_POCKET_L = "M35 78 L40 84";
const HOODIE_POCKET_R = "M65 78 L60 84";
const HOODIE_STRING_L = "M46 19 L45 31";
const HOODIE_STRING_R = "M54 19 L55 31";
const HOODIE_HEM = "M23 104 L77 104";
const HOODIE_CUFF_L = "M2 37 L12 42";
const HOODIE_CUFF_R = "M98 37 L88 42";

export function garmentPaths(
  category: Product["category"],
  view: GarmentView = "front",
): GarmentPath[] {
  if (category === "hoodie") {
    const paths: GarmentPath[] = [
      { role: "body", d: view === "back" ? HOODIE_HOOD_BACK : HOODIE_HOOD_FRONT },
      { role: "body", d: HOODIE_BODY },
      { role: "seam", d: HOODIE_HEM },
      { role: "seam", d: HOODIE_CUFF_L },
      { role: "seam", d: HOODIE_CUFF_R },
    ];
    if (view === "front") {
      paths.push(
        { role: "seam", d: HOODIE_POCKET },
        { role: "seam", d: HOODIE_POCKET_L },
        { role: "seam", d: HOODIE_POCKET_R },
        { role: "seam", d: HOODIE_STRING_L },
        { role: "seam", d: HOODIE_STRING_R },
      );
    }
    return paths;
  }

  // Tee
  const paths: GarmentPath[] = [
    { role: "body", d: TEE_BODY },
    { role: "seam", d: TEE_HEM },
    { role: "seam", d: TEE_SLEEVE_L },
    { role: "seam", d: TEE_SLEEVE_R },
    { role: "seam", d: view === "back" ? TEE_YOKE_BACK : TEE_COLLAR_FRONT },
  ];
  return paths;
}

/** Build a standalone SVG document string (for server-side rasterisation). */
export function garmentSvgString(
  category: Product["category"],
  hex: string,
  widthPx: number,
  heightPx: number,
  view: GarmentView = "front",
): string {
  const seam = isLightHex(hex) ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.24)";
  const ink = "#121212";
  const paths = garmentPaths(category, view)
    .map((p) =>
      p.role === "body"
        ? `<path d="${p.d}" fill="${hex}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>`
        : `<path d="${p.d}" fill="none" stroke="${seam}" stroke-width="1.6" stroke-linecap="round"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${GARMENT_VIEWBOX.w} ${GARMENT_VIEWBOX.h}">${paths}</svg>`;
}
