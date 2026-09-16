/**
 * Schematic garment silhouette for the print-area editor (CLAUDE.md §11, §13).
 *
 * Illustrative preview — NOT a photographic mockup and NOT the production
 * artwork (§34C). Shapes come from the shared `garment-shape` module so this
 * preview and the server mockup match (§4, §57.3).
 */

import {
  GARMENT_VIEWBOX,
  garmentPaths,
  isLightHex,
  type GarmentKind,
  type GarmentView,
} from "@/domain/garment-shape";

export function GarmentSilhouette({
  kind,
  hex,
  view = "front",
}: {
  kind: GarmentKind;
  hex: string;
  view?: GarmentView;
}) {
  const seam = isLightHex(hex) ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.24)";

  return (
    <svg
      viewBox={`0 0 ${GARMENT_VIEWBOX.w} ${GARMENT_VIEWBOX.h}`}
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {garmentPaths(kind, view).map((p, i) =>
        p.role === "body" ? (
          <path key={i} d={p.d} fill={hex} stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
        ) : (
          <path key={i} d={p.d} fill="none" stroke={seam} strokeWidth={1.6} strokeLinecap="round" />
        ),
      )}
    </svg>
  );
}
