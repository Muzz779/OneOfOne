/**
 * Shared garment vector shapes (CLAUDE.md §13, §57.3).
 *
 * One source of truth for the schematic garment outlines, consumed by BOTH the
 * client React silhouette and the server-side SVG mockup builder — so the
 * customer preview and the derived mockup are the same shape (§4).
 *
 * Shapes are keyed by a `GarmentKind` (decoupled from product category so, e.g.,
 * three jacket products can share or vary the drawing). Each kind has FRONT and
 * BACK views.
 */

import type { PrintSide } from "./products";

export const GARMENT_VIEWBOX = { w: 100, h: 120 } as const;

export type GarmentKind = "tee" | "hoodie" | "jacket" | "puffer";
export type GarmentView = "front" | "back";

export interface GarmentPath {
  readonly d: string;
  /** body = fill with garment colour + ink stroke; seam = stroke only. */
  readonly role: "body" | "seam";
}

/** Sleeve prints render on the front-facing view. */
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

// --- Jacket / Puffer -------------------------------------------------------
const JACKET_BODY =
  "M40 15 L60 15 L74 17 L94 24 L99 38 L89 49 L78 42 L78 112 L22 112 L22 42 L11 49 L1 38 L6 24 L26 17 Z";
const JACKET_COLLAR = "M40 15 L46 23 L50 19 L54 23 L60 15";
const JACKET_STAND_COLLAR = "M42 15 L44 8 L56 8 L58 15";
const JACKET_ZIP = "M50 19 L50 112";
const JACKET_ZIP_PUFFER = "M50 15 L50 112";
const JACKET_POCKET_L = "M27 80 L41 80 L41 95 L27 95 Z";
const JACKET_POCKET_R = "M59 80 L73 80 L73 95 L59 95 Z";
const JACKET_CUFF_L = "M1 38 L11 43";
const JACKET_CUFF_R = "M99 38 L89 43";
const JACKET_HEM = "M22 106 L78 106";
const JACKET_YOKE_BACK = "M26 27 L74 27";
const JACKET_BACKSEAM = "M50 27 L50 112";
const PUFFER_QUILT = [46, 60, 74, 88, 100].map((y) => `M22 ${y} L78 ${y}`);

export function garmentPaths(
  kind: GarmentKind,
  view: GarmentView = "front",
): GarmentPath[] {
  if (kind === "hoodie") {
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

  if (kind === "jacket" || kind === "puffer") {
    const paths: GarmentPath[] = [
      { role: "body", d: JACKET_BODY },
      { role: "seam", d: JACKET_HEM },
      { role: "seam", d: JACKET_CUFF_L },
      { role: "seam", d: JACKET_CUFF_R },
    ];
    if (view === "front") {
      paths.push({ role: "seam", d: kind === "puffer" ? JACKET_STAND_COLLAR : JACKET_COLLAR });
      paths.push({ role: "seam", d: kind === "puffer" ? JACKET_ZIP_PUFFER : JACKET_ZIP });
      if (kind === "jacket") {
        paths.push({ role: "seam", d: JACKET_POCKET_L }, { role: "seam", d: JACKET_POCKET_R });
      }
    } else {
      paths.push({ role: "seam", d: JACKET_YOKE_BACK }, { role: "seam", d: JACKET_BACKSEAM });
    }
    if (kind === "puffer") {
      for (const q of PUFFER_QUILT) paths.push({ role: "seam", d: q });
    }
    return paths;
  }

  // Tee
  return [
    { role: "body", d: TEE_BODY },
    { role: "seam", d: TEE_HEM },
    { role: "seam", d: TEE_SLEEVE_L },
    { role: "seam", d: TEE_SLEEVE_R },
    { role: "seam", d: view === "back" ? TEE_YOKE_BACK : TEE_COLLAR_FRONT },
  ];
}

/** Build a standalone SVG document string (for server-side rasterisation). */
export function garmentSvgString(
  kind: GarmentKind,
  hex: string,
  widthPx: number,
  heightPx: number,
  view: GarmentView = "front",
): string {
  const seam = isLightHex(hex) ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.24)";
  const ink = "#121212";
  const paths = garmentPaths(kind, view)
    .map((p) =>
      p.role === "body"
        ? `<path d="${p.d}" fill="${hex}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>`
        : `<path d="${p.d}" fill="none" stroke="${seam}" stroke-width="1.6" stroke-linecap="round"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${GARMENT_VIEWBOX.w} ${GARMENT_VIEWBOX.h}">${paths}</svg>`;
}
