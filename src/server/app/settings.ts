/**
 * Owner-editable store settings: the bank details customers pay into and the
 * support WhatsApp number. Entered by the owner in /admin/settings and stored
 * in the DB (service-role only — never exposed through a public API). Env vars
 * are only a fallback until the owner saves something.
 */

import "server-only";
import { getRepo } from "@/server/container";
import { badRequest } from "@/server/errors";
import {
  envEftDetails,
  envWhatsapp,
  isEftComplete,
  paymentMode,
  type EftDetails,
  type PaymentMethodId,
} from "@/server/env";
import { normaliseStoreSettings, type StoreSettingsInput } from "@/domain/store-settings";

export interface StoreSettings {
  readonly eft: EftDetails;
  /** Digits only, international format (e.g. 27821234567) — ready for wa.me. */
  readonly whatsapp: string;
  /** Where the values came from — "admin" once the owner has saved them. */
  readonly source: "admin" | "env";
  readonly updatedAt?: string;
}

interface StoredSettings {
  eft: EftDetails;
  whatsapp: string;
  updatedAt: string;
  updatedBy: string;
}

const KEY = "store";

export async function getStoreSettings(): Promise<StoreSettings> {
  const saved = await getRepo().getSetting<StoredSettings>(KEY);
  if (saved) {
    return { eft: saved.eft, whatsapp: saved.whatsapp, source: "admin", updatedAt: saved.updatedAt };
  }
  const env = normaliseStoreSettings({ ...envEftDetails(), whatsapp: envWhatsapp() });
  return { eft: env.ok ? env.value.eft : envEftDetails(), whatsapp: env.ok ? env.value.whatsapp : "", source: "env" };
}

export async function saveStoreSettings(input: StoreSettingsInput, adminEmail: string): Promise<StoreSettings> {
  const result = normaliseStoreSettings(input);
  if (!result.ok) throw badRequest(result.error);
  const stored: StoredSettings = {
    ...result.value,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  };
  await getRepo().setSetting(KEY, stored);
  return { eft: stored.eft, whatsapp: stored.whatsapp, source: "admin", updatedAt: stored.updatedAt };
}

export async function getEftDetails(): Promise<EftDetails> {
  return (await getStoreSettings()).eft;
}

export async function isEftReady(): Promise<boolean> {
  return isEftComplete(await getEftDetails());
}

export async function getSupportWhatsapp(): Promise<string> {
  return (await getStoreSettings()).whatsapp;
}

/** Payment methods checkout can offer right now. */
export async function availablePaymentMethods(): Promise<PaymentMethodId[]> {
  const methods: PaymentMethodId[] = [];
  if (paymentMode() !== "disabled") methods.push("card");
  if (await isEftReady()) methods.push("eft");
  return methods;
}
