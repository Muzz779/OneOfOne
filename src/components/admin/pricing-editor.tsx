"use client";

import { useState } from "react";
import type { PricingConfig } from "@/domain/pricing";

type Kind = "rands" | "cents" | "percent";
const FIELDS: { key: keyof PricingConfig; label: string; kind: Kind }[] = [
  { key: "printChargeBaseCents", label: "Print charge — base", kind: "rands" },
  { key: "printChargePerCm2Cents", label: "Print charge — per cm² (cents)", kind: "cents" },
  { key: "printChargeMaxCents", label: "Print charge — cap", kind: "rands" },
  { key: "printCostBaseCents", label: "Print cost — base", kind: "rands" },
  { key: "printCostPerCm2Cents", label: "Print cost — per cm² (cents)", kind: "cents" },
  { key: "packagingCostCents", label: "Packaging cost", kind: "rands" },
  { key: "paymentFeePercent", label: "Payment fee (%)", kind: "percent" },
  { key: "paymentFeeFixedCents", label: "Payment fee — fixed", kind: "rands" },
  { key: "deliveryChargeCents", label: "Delivery charge (PUDO)", kind: "rands" },
  { key: "deliveryCostCents", label: "Delivery cost", kind: "rands" },
];

export function PricingEditor({ initial }: { initial: PricingConfig }) {
  const [config, setConfig] = useState<PricingConfig>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function display(kind: Kind, v: number): string {
    return kind === "rands" ? (v / 100).toFixed(2) : String(v);
  }
  function parse(kind: Kind, s: string): number {
    const n = Number(s) || 0;
    return kind === "rands" ? Math.round(n * 100) : n;
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save pricing.");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save pricing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm font-semibold">{f.label}</span>
            <input
              value={display(f.kind, config[f.key] as number)}
              onChange={(e) => setConfig((c) => ({ ...c, [f.key]: parse(f.kind, e.target.value) }))}
              className="w-full border-2 border-ink bg-paper px-3 py-2 font-mono"
            />
          </label>
        ))}
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      {saved && <p className="text-sm font-semibold text-ok">Pricing saved.</p>}
      <button type="button" onClick={save} disabled={busy} className="btn-raw disabled:bg-muted">
        {busy ? "Saving…" : "Save pricing"}
      </button>
    </div>
  );
}
