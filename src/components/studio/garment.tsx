/**
 * Schematic garment silhouette for the print-area editor (CLAUDE.md §11, §13).
 *
 * A simple vector outline tinted by the selected colour, used to communicate
 * WHERE artwork prints and at what scale. Illustrative layout preview — NOT a
 * photographic mockup and NOT the production artwork (§34C). Shapes come from
 * the shared `garment-shape` module so this preview and the server-derived
 * mockup are identical (§4, §57.3).
 */

import type { Product } from "@/domain/products";
import {
  GARMENT_VIEWBOX,
  garmentPaths,
  isLightHex,
} from "@/domain/garment-shape";

export function GarmentSilhouette({
  category,
  hex,
}: {
  category: Product["category"];
  hex: string;
}) {
  const seam = isLightHex(hex) ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.22)";

  return (
    <svg
      viewBox={`0 0 ${GARMENT_VIEWBOX.w} ${GARMENT_VIEWBOX.h}`}
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {garmentPaths(category).map((p, i) =>
        p.role === "body" ? (
          <path
            key={i}
            d={p.d}
            fill={hex}
            stroke="var(--ink)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ) : (
          <path key={i} d={p.d} fill="none" stroke={seam} strokeWidth={2} />
        ),
      )}
    </svg>
  );
}
