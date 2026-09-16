/**
 * Shared garment vector shapes (CLAUDE.md §13, §57.3).
 *
 * One source of truth for the schematic garment outlines, consumed by BOTH the
 * client React silhouette and the server-side SVG mockup builder — so the
 * customer preview and the derived mockup are the same shape (§4).
 */

import type { Product } from "./products";

export const GARMENT_VIEWBOX = { w: 100, h: 120 } as const;

export interface GarmentPath {
  readonly d: string;
  /** body = fill with garment colour + ink stroke; seam = stroke only. */
  readonly role: "body" | "seam";
}

export function isLightHex(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

export function garmentPaths(category: Product["category"]): GarmentPath[] {
  if (category === "hoodie") {
    return [
      {
        role: "body",
        d: "M34 6 C40 16 60 16 66 6 L78 12 L94 30 L84 44 L74 38 L74 114 L26 114 L26 38 L16 44 L6 30 L22 12 Z",
      },
      { role: "body", d: "M34 6 C40 20 60 20 66 6 C60 2 40 2 34 6 Z" },
      { role: "seam", d: "M50 16 L50 30" },
      { role: "seam", d: "M36 84 L64 84 L60 102 L40 102 Z" },
      { role: "seam", d: "M42 70 L44 78 M58 70 L56 78" },
    ];
  }
  return [
    {
      role: "body",
      d: "M32 8 L20 14 L6 30 L16 42 L26 36 L26 114 L74 114 L74 36 L84 42 L94 30 L80 14 L68 8 C62 18 38 18 32 8 Z",
    },
    { role: "seam", d: "M32 8 C38 18 62 18 68 8" },
  ];
}

/** Build a standalone SVG document string (for server-side rasterisation). */
export function garmentSvgString(
  category: Product["category"],
  hex: string,
  widthPx: number,
  heightPx: number,
): string {
  const seam = isLightHex(hex) ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.22)";
  const ink = "#121212";
  const paths = garmentPaths(category)
    .map((p) =>
      p.role === "body"
        ? `<path d="${p.d}" fill="${hex}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>`
        : `<path d="${p.d}" fill="none" stroke="${seam}" stroke-width="2"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${GARMENT_VIEWBOX.w} ${GARMENT_VIEWBOX.h}">${paths}</svg>`;
}
