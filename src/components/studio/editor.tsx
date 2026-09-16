"use client";

import { useRef } from "react";
import {
  clampCenterMm,
  type Placement,
} from "@/lib/print/placement";
import type { PrintDimensionsMm } from "@/lib/print/analysis";
import type { PrintArea, Product } from "@/domain/products";
import { viewForSide } from "@/domain/garment-shape";
import { GarmentSilhouette } from "./garment";

type Mode = "move" | "resize" | "rotate";

interface DragCtx {
  mode: Mode;
  rectW: number;
  rectH: number;
  startClientX: number;
  startClientY: number;
  centerPxX: number;
  centerPxY: number;
  startDistPx: number;
  startAngleRad: number;
  start: Placement;
  /** Fit-to-area box (mm) for the current artwork aspect, so resize can map a
   *  new sizeFrac back to millimetres for clamping. */
  fitWidthMm: number;
  fitHeightMm: number;
}

const MIN_SIZE_FRAC = 0.12;

export function GarmentEditor({
  product,
  area,
  hex,
  previewUrl,
  maxWidthMm,
  maxHeightMm,
  printBox,
  placement,
  onChange,
}: {
  product: Product;
  area: PrintArea;
  hex: string;
  previewUrl: string | null;
  maxWidthMm: number;
  maxHeightMm: number;
  printBox: PrintDimensionsMm;
  placement: Placement;
  onChange: (next: Placement) => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragCtx | null>(null);

  const wFracArea = printBox.widthMm / maxWidthMm;
  const hFracArea = printBox.heightMm / maxHeightMm;
  const box = area.mockupBox;

  function reclamp(p: Placement, widthMm: number, heightMm: number): Placement {
    const { xMm, yMm } = clampCenterMm(
      p.posXFrac * maxWidthMm,
      p.posYFrac * maxHeightMm,
      widthMm,
      heightMm,
      p.rotationDeg,
      maxWidthMm,
      maxHeightMm,
    );
    return { ...p, posXFrac: xMm / maxWidthMm, posYFrac: yMm / maxHeightMm };
  }

  function onPointerMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();

    if (d.mode === "move") {
      const dxFrac = (e.clientX - d.startClientX) / d.rectW;
      const dyFrac = (e.clientY - d.startClientY) / d.rectH;
      onChange(
        reclamp(
          {
            ...d.start,
            posXFrac: d.start.posXFrac + dxFrac,
            posYFrac: d.start.posYFrac + dyFrac,
          },
          printBox.widthMm,
          printBox.heightMm,
        ),
      );
      return;
    }

    if (d.mode === "resize") {
      const curDist = Math.hypot(e.clientX - d.centerPxX, e.clientY - d.centerPxY);
      const factor = d.startDistPx > 0 ? curDist / d.startDistPx : 1;
      const sizeFrac = Math.min(1, Math.max(MIN_SIZE_FRAC, d.start.sizeFrac * factor));
      const widthMm = d.fitWidthMm * sizeFrac;
      const heightMm = d.fitHeightMm * sizeFrac;
      onChange(reclamp({ ...d.start, sizeFrac }, widthMm, heightMm));
      return;
    }

    // rotate
    const angleNow = Math.atan2(e.clientY - d.centerPxY, e.clientX - d.centerPxX);
    let deg = d.start.rotationDeg + ((angleNow - d.startAngleRad) * 180) / Math.PI;
    // Snap near cardinal angles for tidy alignment.
    const snapped = Math.round(deg / 90) * 90;
    if (Math.abs(deg - snapped) < 4) deg = snapped;
    onChange(reclamp({ ...d.start, rotationDeg: deg }, printBox.widthMm, printBox.heightMm));
  }

  function endDrag() {
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }

  function startDrag(mode: Mode, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const areaEl = areaRef.current;
    if (!areaEl) return;
    const rect = areaEl.getBoundingClientRect();
    const centerPxX = rect.left + placement.posXFrac * rect.width;
    const centerPxY = rect.top + placement.posYFrac * rect.height;
    drag.current = {
      mode,
      rectW: rect.width,
      rectH: rect.height,
      startClientX: e.clientX,
      startClientY: e.clientY,
      centerPxX,
      centerPxY,
      startDistPx: Math.hypot(e.clientX - centerPxX, e.clientY - centerPxY),
      startAngleRad: Math.atan2(e.clientY - centerPxY, e.clientX - centerPxX),
      start: placement,
      fitWidthMm: placement.sizeFrac > 0 ? printBox.widthMm / placement.sizeFrac : printBox.widthMm,
      fitHeightMm: placement.sizeFrac > 0 ? printBox.heightMm / placement.sizeFrac : printBox.heightMm,
    };
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }

  return (
    <div className="card-raw p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Position on garment</h2>
        <div className="flex gap-1.5">
          <ToolBtn
            label="Center"
            onClick={() => onChange({ ...placement, posXFrac: 0.5, posYFrac: 0.5 })}
          />
          <ToolBtn
            label="Rotate 90°"
            onClick={() =>
              onChange(
                reclamp(
                  { ...placement, rotationDeg: placement.rotationDeg + 90 },
                  printBox.widthMm,
                  printBox.heightMm,
                ),
              )
            }
          />
          <ToolBtn
            label="Reset"
            onClick={() =>
              onChange({ sizeFrac: 1, posXFrac: 0.5, posYFrac: 0.5, rotationDeg: 0 })
            }
          />
        </div>
      </div>

      <div className="flex justify-center">
        <div
          className="relative w-full max-w-[340px] select-none"
          style={{ aspectRatio: "100 / 120" }}
        >
          <GarmentSilhouette category={product.category} hex={hex} view={viewForSide(area.side)} />

          {/* Printable area boundary (subtle but clear, §11) */}
          <div
            ref={areaRef}
            className="absolute border-2 border-dashed border-ink/70"
            style={{
              left: `${box.xPct * 100}%`,
              top: `${box.yPct * 100}%`,
              width: `${box.widthPct * 100}%`,
              height: `${box.heightPct * 100}%`,
            }}
          >
            {/* Artwork */}
            {previewUrl && (
              <div
                className="absolute touch-none"
                onPointerDown={(e) => startDrag("move", e)}
                style={{
                  left: `${(placement.posXFrac - wFracArea / 2) * 100}%`,
                  top: `${(placement.posYFrac - hFracArea / 2) * 100}%`,
                  width: `${wFracArea * 100}%`,
                  height: `${hFracArea * 100}%`,
                  transform: `rotate(${placement.rotationDeg}deg)`,
                  transformOrigin: "center",
                  cursor: "move",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Your artwork positioned on the garment"
                  className="pointer-events-none h-full w-full object-contain outline outline-1 outline-accent/70"
                  draggable={false}
                />
                {/* Rotate handle (top) */}
                <button
                  type="button"
                  aria-label="Rotate artwork"
                  onPointerDown={(e) => startDrag("rotate", e)}
                  className="absolute left-1/2 top-0 grid h-5 w-5 -translate-x-1/2 -translate-y-[160%] place-items-center border-2 border-ink bg-volt text-[10px] font-bold touch-none"
                >
                  ⟳
                </button>
                {/* Resize handle (bottom-right) */}
                <button
                  type="button"
                  aria-label="Resize artwork"
                  onPointerDown={(e) => startDrag("resize", e)}
                  className="absolute bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 border-2 border-ink bg-accent touch-none"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 text-center font-mono text-[11px] text-muted">
        Drag to move · corner to resize · top handle to rotate. Preview for
        illustration — actual print colour &amp; garment may vary slightly.
      </p>
    </div>
  );
}

function ToolBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-2 border-ink bg-paper px-2 py-1 text-xs font-bold hover:bg-paper-2"
    >
      {label}
    </button>
  );
}
