"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { allowedTransitions, ORDER_STATE_LABELS, type OrderState } from "@/domain/orders";

export function StatusControl({ orderId, current }: { orderId: string; current: OrderState }) {
  const router = useRouter();
  const options = allowedTransitions(current);
  const [to, setTo] = useState<OrderState | "">(options[0] ?? "");
  const [note, setNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (options.length === 0) {
    return <p className="text-sm text-muted">This order is in a final state.</p>;
  }

  const shipping = to === "SHIPPED";

  async function apply() {
    if (!to) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          note: note || undefined,
          trackingNumber: shipping ? trackingNumber : undefined,
          trackingUrl: shipping ? trackingUrl || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't update status.");
      setNote("");
      setTrackingNumber("");
      setTrackingUrl("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select value={to} onChange={(e) => setTo(e.target.value as OrderState)} className="border-2 border-ink bg-paper px-3 py-2 text-sm font-semibold">
          {options.map((s) => (
            <option key={s} value={s}>{ORDER_STATE_LABELS[s]}</option>
          ))}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="min-w-0 flex-1 border-2 border-ink bg-paper px-3 py-2 text-sm" />
        <button type="button" disabled={busy || (shipping && !trackingNumber.trim())} onClick={apply} className="border-2 border-ink bg-accent px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "…" : "Apply"}
        </button>
      </div>
      {shipping && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="PUDO tracking number (required)"
            aria-label="Tracking number"
            className="border-2 border-ink bg-paper px-3 py-2 font-mono text-sm"
          />
          <input
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            placeholder="Tracking link https://… (optional)"
            aria-label="Tracking link"
            className="border-2 border-ink bg-paper px-3 py-2 text-sm"
          />
        </div>
      )}
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
