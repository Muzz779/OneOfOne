"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { allowedTransitions, ORDER_STATE_LABELS, type OrderState } from "@/domain/orders";

export function StatusControl({ orderId, current }: { orderId: string; current: OrderState }) {
  const router = useRouter();
  const options = allowedTransitions(current);
  const [to, setTo] = useState<OrderState | "">(options[0] ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (options.length === 0) {
    return <p className="text-sm text-muted">This order is in a final state.</p>;
  }

  async function apply() {
    if (!to) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't update status.");
      setNote("");
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
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="flex-1 border-2 border-ink bg-paper px-3 py-2 text-sm" />
        <button type="button" disabled={busy} onClick={apply} className="border-2 border-ink bg-accent px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "…" : "Apply"}
        </button>
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
