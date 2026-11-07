"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StoreSettingsInput } from "@/domain/store-settings";

type Field = keyof Required<StoreSettingsInput>;

const BANK_FIELDS: { key: Field; label: string; hint?: string; inputMode?: "numeric" | "tel"; list?: string }[] = [
  { key: "bankName", label: "Bank", list: "sa-banks" },
  { key: "accountHolder", label: "Account holder name", hint: "Exactly as it appears on your bank account." },
  { key: "accountNumber", label: "Account number", inputMode: "numeric" },
  { key: "branchCode", label: "Branch code", hint: "Most banks use a universal branch code.", inputMode: "numeric" },
  { key: "accountType", label: "Account type (optional)", list: "account-types" },
  { key: "payShapId", label: "PayShap ShapID (optional)", hint: "Usually your cellphone number — lets customers pay instantly.", inputMode: "tel" },
];

const BANKS = ["Absa", "African Bank", "Capitec", "Discovery Bank", "FNB", "Investec", "Nedbank", "Standard Bank", "TymeBank"];
const ACCOUNT_TYPES = ["Savings", "Cheque / Current", "Transmission"];

export function SettingsForm({ initial }: { initial: Required<StoreSettingsInput> }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: Field, v: string) {
    setValues((s) => ({ ...s, [key]: v }));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your details.");
      const s = data.settings;
      setValues({ ...s.eft, whatsapp: s.whatsapp });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your details.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full border-2 border-ink bg-paper px-3 py-2 font-mono";
  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <fieldset className="border-2 border-ink p-4">
        <legend className="px-1 font-display font-bold">Bank account</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {BANK_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-sm font-semibold">{f.label}</span>
              <input
                value={values[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                inputMode={f.inputMode}
                list={f.list}
                autoComplete="off"
                className={input}
              />
              {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
            </label>
          ))}
        </div>
        <datalist id="sa-banks">{BANKS.map((b) => <option key={b} value={b} />)}</datalist>
        <datalist id="account-types">{ACCOUNT_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
      </fieldset>

      <fieldset className="border-2 border-ink p-4">
        <legend className="px-1 font-display font-bold">Customer support</legend>
        <label className="block max-w-sm">
          <span className="mb-1 block text-sm font-semibold">WhatsApp number (optional)</span>
          <input
            value={values.whatsapp}
            onChange={(e) => set("whatsapp", e.target.value)}
            inputMode="tel"
            placeholder="082 123 4567"
            className={input}
          />
          <span className="mt-1 block text-xs text-muted">
            Turns on the WhatsApp button on the support page and lets customers tell you they&apos;ve paid.
          </span>
        </label>
      </fieldset>

      <div role="status" aria-live="polite">
        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
        {saved && <p className="text-sm font-semibold text-ok">Saved — checkout uses these details from now on.</p>}
      </div>
      <button type="submit" disabled={busy} className="btn-raw disabled:bg-muted">
        {busy ? "Saving…" : "Save payment details"}
      </button>
    </form>
  );
}
