import { describe, expect, it } from "vitest";
import { eftReference } from "./payments";

describe("eftReference", () => {
  it("turns an order number into a bank-safe reference", () => {
    expect(eftReference("#1042")).toBe("PAY1042");
    expect(eftReference("#1042")).toMatch(/^[A-Z0-9]{1,20}$/);
  });

  it("never uses letters that look like digits", () => {
    expect(eftReference("#1042")).not.toMatch(/[OIL]/);
  });
});
