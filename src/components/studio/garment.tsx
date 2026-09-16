/**
 * Schematic garment silhouettes for the print-area editor (CLAUDE.md §11, §13).
 *
 * These are deliberately simple vector outlines, tinted by the selected garment
 * colour, used to communicate WHERE artwork prints and at what scale. They are
 * an illustrative layout preview — NOT a photographic mockup and NOT the
 * production artwork (§34C forbids AI-generated garment mockups; §13 requires a
 * clear "for illustration" disclaimer, shown by the editor).
 */

import type { Product } from "@/domain/products";

/** Shared viewBox so mockupBox fractions map consistently (§9). */
export const GARMENT_VIEWBOX = { w: 100, h: 120 };

function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance.
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

export function GarmentSilhouette({
  category,
  hex,
}: {
  category: Product["category"];
  hex: string;
}) {
  // On very light garments, add a faint seam so the shape reads on paper.
  const seam = isLight(hex) ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.22)";

  return (
    <svg
      viewBox={`0 0 ${GARMENT_VIEWBOX.w} ${GARMENT_VIEWBOX.h}`}
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {category === "hoodie" ? (
        <>
          <path
            d="M34 6 C40 16 60 16 66 6 L78 12 L94 30 L84 44 L74 38 L74 114 L26 114 L26 38 L16 44 L6 30 L22 12 Z"
            fill={hex}
            stroke="var(--ink)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {/* Hood */}
          <path
            d="M34 6 C40 20 60 20 66 6 C60 2 40 2 34 6 Z"
            fill={hex}
            stroke="var(--ink)"
            strokeWidth={2}
          />
          <path d="M50 16 L50 30" stroke={seam} strokeWidth={2} />
          {/* Kangaroo pocket */}
          <path
            d="M36 84 L64 84 L60 102 L40 102 Z"
            fill="none"
            stroke={seam}
            strokeWidth={2}
          />
          <path d="M42 70 L44 78 M58 70 L56 78" stroke={seam} strokeWidth={2} />
        </>
      ) : (
        <>
          <path
            d="M32 8 L20 14 L6 30 L16 42 L26 36 L26 114 L74 114 L74 36 L84 42 L94 30 L80 14 L68 8 C62 18 38 18 32 8 Z"
            fill={hex}
            stroke="var(--ink)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {/* Collar */}
          <path
            d="M32 8 C38 18 62 18 68 8"
            fill="none"
            stroke={seam}
            strokeWidth={2}
          />
        </>
      )}
    </svg>
  );
}
