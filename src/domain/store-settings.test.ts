import { describe, expect, it } from "vitest";
import { normaliseStoreSettings, toInternationalPhone } from "./store-settings";

const bank = {
  bankName: "  Capitec ",
  accountHolder: "T  Mokoena",
  accountNumber: "1234 5678 90",
  branchCode: "470-010",
  accountType: "Savings",
};

describe("normaliseStoreSettings", () => {
  it("cleans up a full set of bank details", () => {
    const r = normaliseStoreSettings({ ...bank, whatsapp: "082 123 4567" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.eft).toMatchObject({
      bankName: "Capitec",
      accountHolder: "T Mokoena",
      accountNumber: "1234567890",
      branchCode: "470010",
    });
    expect(r.value.whatsapp).toBe("27821234567");
  });

  it("allows everything blank (turns bank transfer off)", () => {
    expect(normaliseStoreSettings({}).ok).toBe(true);
  });

  it("rejects half-filled bank details", () => {
    const r = normaliseStoreSettings({ bankName: "FNB", accountNumber: "62000000000" });
    expect(r).toMatchObject({ ok: false });
  });

  it("rejects non-numeric account numbers and branch codes", () => {
    expect(normaliseStoreSettings({ ...bank, accountNumber: "12AB5678" }).ok).toBe(false);
    expect(normaliseStoreSettings({ ...bank, branchCode: "12" }).ok).toBe(false);
  });

  it("needs an account holder for PayShap-only setups", () => {
    expect(normaliseStoreSettings({ payShapId: "0821234567" }).ok).toBe(false);
    expect(normaliseStoreSettings({ payShapId: "0821234567", accountHolder: "T Mokoena" }).ok).toBe(true);
  });

  it("rejects a junk WhatsApp number", () => {
    expect(normaliseStoreSettings({ whatsapp: "123" }).ok).toBe(false);
  });
});

describe("toInternationalPhone", () => {
  it("converts SA local numbers and keeps international ones", () => {
    expect(toInternationalPhone("082 123 4567")).toBe("27821234567");
    expect(toInternationalPhone("+27 82 123 4567")).toBe("27821234567");
    expect(toInternationalPhone("0027821234567")).toBe("27821234567");
  });
});
