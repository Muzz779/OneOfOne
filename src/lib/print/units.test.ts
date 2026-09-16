import { describe, expect, it } from "vitest";
import {
  cmToMm,
  effectiveDpiForDimension,
  inchToMm,
  mmToInch,
  mmToPx,
  pxToMm,
} from "./units";

describe("units", () => {
  it("converts mm <-> inch", () => {
    expect(mmToInch(25.4)).toBeCloseTo(1, 6);
    expect(inchToMm(1)).toBeCloseTo(25.4, 6);
  });

  it("converts cm to mm", () => {
    expect(cmToMm(30)).toBe(300);
    expect(cmToMm(40)).toBe(400);
  });

  it("computes required pixels for a physical size at a DPI (§1.1 example)", () => {
    // 30 x 40 cm at 300 DPI ≈ 3543 x 4724 px (ceil-rounded here).
    expect(mmToPx(300, 300)).toBe(3544);
    expect(mmToPx(400, 300)).toBe(4725);
  });

  it("rounds pixels up so resolution is never under-provisioned", () => {
    // 10.01mm at 300dpi = 118.2px -> 119
    expect(mmToPx(10.01, 300)).toBe(119);
  });

  it("round-trips px -> mm within the DPI grid", () => {
    expect(pxToMm(300, 300)).toBeCloseTo(25.4, 6);
  });

  it("computes effective DPI for a dimension", () => {
    // 3000px across 254mm (10in) -> 300 dpi
    expect(effectiveDpiForDimension(3000, 254)).toBeCloseTo(300, 6);
    expect(effectiveDpiForDimension(100, 0)).toBe(0);
  });
});
