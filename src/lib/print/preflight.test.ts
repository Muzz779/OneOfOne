import { describe, expect, it } from "vitest";
import { DEFAULT_PRINTER_SPEC } from "@/config/printer";
import { getProductById } from "@/domain/products";
import type { ImageFacts } from "./analysis";
import { runPreflight, type ProductionPlan } from "./preflight";

const spec = DEFAULT_PRINTER_SPEC;
const tee = getProductById("prod_tshirt_classic")!;

function raster(widthPx: number, heightPx: number, hasAlpha = true): ImageFacts {
  return {
    widthPx,
    heightPx,
    format: "PNG",
    fileSizeBytes: 2_000_000,
    hasAlpha,
    isVector: false,
  };
}

const goodPlan: ProductionPlan = {
  side: "FRONT",
  print: { widthMm: 200, heightMm: 280 },
  outputFormat: "PNG",
};

describe("runPreflight", () => {
  it("PASSes a well-formed, high-resolution front print", () => {
    // 200x280mm @300dpi needs ~2362x3307px; provide more.
    const res = runPreflight(raster(2500, 3500), goodPlan, tee, spec);
    expect(res.result).toBe("PASS");
    expect(res.failureReasons).toHaveLength(0);
  });

  it("FAILs when artwork resolution is below the minimum", () => {
    const res = runPreflight(raster(400, 560), goodPlan, tee, spec);
    expect(res.result).toBe("FAIL");
    expect(res.failureReasons.join(" ")).toMatch(/below the minimum/i);
  });

  it("FAILs when the print exceeds the product's printable area", () => {
    const oversized: ProductionPlan = {
      side: "FRONT",
      print: { widthMm: 250, heightMm: 350 }, // front area is 210x297
      outputFormat: "PNG",
    };
    const res = runPreflight(raster(4000, 5000), oversized, tee, spec);
    expect(res.result).toBe("FAIL");
    expect(res.failureReasons.join(" ")).toMatch(/exceeds the/i);
  });

  it("FAILs when the output format does not match the printer spec", () => {
    const res = runPreflight(
      raster(2500, 3500),
      { ...goodPlan, outputFormat: "PDF" },
      tee,
      spec,
    );
    expect(res.result).toBe("FAIL");
    expect(res.failureReasons.join(" ")).toMatch(/printer requires png/i);
  });

  it("WARNs (but passes) when resolution is printable yet below target DPI", () => {
    // ~200 dpi at 200x280mm: 200mm/25.4*200 = ~1575px
    const res = runPreflight(raster(1575, 2205), goodPlan, tee, spec);
    const dpiCheck = res.checks.find((c) => c.id === "effective_dpi");
    expect(dpiCheck?.status).toBe("WARN");
    expect(res.result).toBe("PASS");
  });

  it("FAILs a production file that exceeds the max file size", () => {
    const res = runPreflight(
      raster(2500, 3500),
      { ...goodPlan, productionFileSizeBytes: spec.maxFileSizeBytes + 1 },
      tee,
      spec,
    );
    expect(res.result).toBe("FAIL");
    expect(res.failureReasons.join(" ")).toMatch(/exceeds the .*limit/i);
  });

  it("passes vector artwork on resolution regardless of pixel size", () => {
    const vector: ImageFacts = {
      widthPx: 64,
      heightPx: 64,
      format: "SVG",
      fileSizeBytes: 10_000,
      hasAlpha: true,
      isVector: true,
    };
    const res = runPreflight(vector, goodPlan, tee, spec);
    const dpiCheck = res.checks.find((c) => c.id === "effective_dpi");
    expect(dpiCheck?.status).toBe("PASS");
  });
});
