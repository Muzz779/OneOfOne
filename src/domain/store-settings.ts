/**
 * Validation + normalisation for the owner's store settings (bank details for
 * EFT/PayShap and the support WhatsApp number). Pure — no I/O — so it can be
 * unit-tested and reused for both the admin form and env fallbacks.
 */

export interface StoreSettingsInput {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  branchCode?: string;
  accountType?: string;
  payShapId?: string;
  whatsapp?: string;
}

export interface NormalisedStoreSettings {
  eft: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    branchCode: string;
    accountType: string;
    payShapId: string;
  };
  whatsapp: string;
}

export type SettingsResult =
  | { ok: true; value: NormalisedStoreSettings }
  | { ok: false; error: string };

const text = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

const digits = (v: unknown): string => (typeof v === "string" ? v.replace(/[\s-]/g, "") : "");

/** SA cellphone → international digits for wa.me (0821234567 → 27821234567). */
export function toInternationalPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = `27${d.slice(1)}`;
  return d;
}

export function normaliseStoreSettings(input: StoreSettingsInput): SettingsResult {
  const bankName = text(input.bankName, 60);
  const accountHolder = text(input.accountHolder, 80);
  const accountNumber = digits(input.accountNumber);
  const branchCode = digits(input.branchCode);
  const accountType = text(input.accountType, 30);
  const payShapId = text(input.payShapId, 40);
  const whatsappRaw = text(input.whatsapp, 30);
  const whatsapp = whatsappRaw ? toInternationalPhone(whatsappRaw) : "";

  if (accountNumber && !/^\d{6,16}$/.test(accountNumber)) {
    return { ok: false, error: "The account number should be 6–16 digits." };
  }
  if (branchCode && !/^\d{4,8}$/.test(branchCode)) {
    return { ok: false, error: "The branch code should be 4–8 digits." };
  }
  if (whatsapp && !/^\d{9,15}$/.test(whatsapp)) {
    return { ok: false, error: "The WhatsApp number doesn't look right — use e.g. 082 123 4567." };
  }
  const anyBank = Boolean(bankName || accountNumber || branchCode);
  const fullBank = Boolean(bankName && accountHolder && accountNumber && branchCode);
  if (anyBank && !fullBank) {
    return {
      ok: false,
      error: "For bank transfers, fill in the bank, account holder, account number and branch code together.",
    };
  }
  if (payShapId && !accountHolder) {
    return { ok: false, error: "Add the account holder name so customers know who they're paying." };
  }

  return {
    ok: true,
    value: {
      eft: { bankName, accountHolder, accountNumber, branchCode, accountType, payShapId },
      whatsapp,
    },
  };
}
