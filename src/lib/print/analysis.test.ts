import { describe, expect, it } from "vitest";
import { DEFAULT_PRINTER_SPEC } from "@/config/printer";
import {
  analyzeArtwork,
  computeEffectiveDpi,
  maxPrintSizeAtDpi,
  type ImageFacts,
} from "./analysis";

const spec = DEFAULT_PRINTER_SPEC; // 300 dpi target, 150 min effective

function raster(widthPx: number, heightPx: number): ImageFacts {
  return {
    widthPx,
    heightPx,
    format: "JPEG",
    fileSizeBytes: 1_000_000,
    hasAlpha: false,
    isVector: false,
  };
}

describe("computeEffectiveDpi", () => {
  it("uses the limiting axis", () => {
    // width axis: 3000px / (300mm/25.4)=254 dpi; height axis: 1000px/(300mm/25.4)=85 dpi
    const dpi = computeEffectiveDpi(raster(3000, 1000), {
      widthMm: 300,
      heightMm: 300,
    });
    expect(dpi).toBeCloseTo(85, 0);
  });
});

describe("analyzeArtwork quality states", () => {
  it("EXCELLENT when effective DPI meets the target", () => {
    // 300mm needs 3544px @300dpi; provide plenty.
    const a = analyzeArtwork(raster(4000, 5400), { widthMm: 300, heightMm: 400 }, spec);
    expect(a.quality).toBe("EXCELLENT");
    expect(a.meetsTargetDpi).toBe(true);
    expect(a.enhancementRequired).toBe(false);
  });

  it("GOOD when between goodRatio and target", () => {
    // Aim for ~255 dpi at 100x100mm: 100mm/25.4=3.937in; 255dpi -> ~1004px
    const a = analyzeArtwork(raster(1004, 1004), { widthMm: 100, heightMm: 100 }, spec);
    expect(a.quality).toBe("GOOD");
    expect(a.enhancementRecommended).toBe(true);
  });

  it("NEEDS_ENHANCEMENT when between min and good", () => {
    // ~180 dpi at 100x100mm -> ~709px
    const a = analyzeArtwork(raster(709, 709), { widthMm: 100, heightMm: 100 }, spec);
    expect(a.quality).toBe("NEEDS_ENHANCEMENT");
    expect(a.enhancementRequired).toBe(true);
  });

  it("TOO_LOW below the minimum effective DPI", () => {
    // ~100 dpi at 100x100mm -> ~394px (< 150 min)
    const a = analyzeArtwork(raster(394, 394), { widthMm: 100, heightMm: 100 }, spec);
    expect(a.quality).toBe("TOO_LOW");
    expect(a.message).toMatch(/too small/i);
  });

  it("vector artwork is always EXCELLENT and resolution-independent", () => {
    const vector: ImageFacts = {
      widthPx: 64,
      heightPx: 64,
      format: "SVG",
      fileSizeBytes: 12_000,
      hasAlpha: true,
      isVector: true,
    };
    const a = analyzeArtwork(vector, { widthMm: 300, heightMm: 400 }, spec);
    expect(a.quality).toBe("EXCELLENT");
    expect(a.effectiveDpi).toBe(Infinity);
    expect(a.enhancementRecommended).toBe(false);
  });

  it("reports the production pixel dimensions required at the printer DPI", () => {
    const a = analyzeArtwork(raster(4000, 5400), { widthMm: 300, heightMm: 400 }, spec);
    expect(a.requiredWidthPx).toBe(3544);
    expect(a.requiredHeightPx).toBe(4725);
  });
});

describe("maxPrintSizeAtDpi", () => {
  it("returns the largest size that still meets the target DPI, clamped to the bed", () => {
    // 3544px at 300dpi -> exactly 300mm wide; height 4725px -> ~400mm, clamped to bed 400.
    const size = maxPrintSizeAtDpi(raster(3544, 4725), spec.dpi, spec);
    expect(size.widthMm).toBeCloseTo(300, 0);
    expect(size.heightMm).toBeLessThanOrEqual(spec.maxPrintHeightMm);
  });
});
