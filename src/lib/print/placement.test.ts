import { describe, expect, it } from "vitest";
import {
  boxFromWidth,
  clampCenterMm,
  fitWithin,
  rotatedHalfExtentsMm,
} from "./placement";

describe("fitWithin", () => {
  it("fills width when width is the binding constraint", () => {
    // aspect 2 (wide) inside 200x200 -> width 200, height 100
    const b = fitWithin(2, 200, 200);
    expect(b.widthMm).toBeCloseTo(200, 6);
    expect(b.heightMm).toBeCloseTo(100, 6);
  });

  it("fills height when height is the binding constraint", () => {
    // aspect 0.5 (tall) inside 200x200 -> height 200, width 100
    const b = fitWithin(0.5, 200, 200);
    expect(b.heightMm).toBeCloseTo(200, 6);
    expect(b.widthMm).toBeCloseTo(100, 6);
  });
});

describe("boxFromWidth", () => {
  it("keeps aspect and clamps when derived height overflows", () => {
    const b = boxFromWidth(200, 0.5, 200, 120);
    expect(b.heightMm).toBeCloseTo(120, 6);
    expect(b.widthMm).toBeCloseTo(60, 6); // 120 * 0.5
  });
});

describe("rotatedHalfExtentsMm", () => {
  it("equals half-size at 0deg", () => {
    const e = rotatedHalfExtentsMm(100, 60, 0);
    expect(e.rxMm).toBeCloseTo(50, 6);
    expect(e.ryMm).toBeCloseTo(30, 6);
  });

  it("swaps extents at 90deg", () => {
    const e = rotatedHalfExtentsMm(100, 60, 90);
    expect(e.rxMm).toBeCloseTo(30, 6);
    expect(e.ryMm).toBeCloseTo(50, 6);
  });
});

describe("clampCenterMm", () => {
  it("keeps an unrotated box inside the area", () => {
    // 100x60 box in 200x200 area: center X in [50,150], Y in [30,170]
    expect(clampCenterMm(10, 10, 100, 60, 0, 200, 200)).toEqual({
      xMm: 50,
      yMm: 30,
    });
    expect(clampCenterMm(300, 300, 100, 60, 0, 200, 200)).toEqual({
      xMm: 150,
      yMm: 170,
    });
  });

  it("centres a box larger than the area on that axis", () => {
    // 300 wide box in 200 area -> centred at 100
    const c = clampCenterMm(10, 100, 300, 60, 0, 200, 200);
    expect(c.xMm).toBeCloseTo(100, 6);
  });

  it("accounts for rotation when clamping", () => {
    // 100x20 rotated 90deg -> effective width 20, so X can go to [10,190]
    const c = clampCenterMm(5, 100, 100, 20, 90, 200, 200);
    expect(c.xMm).toBeCloseTo(10, 6);
  });
});
