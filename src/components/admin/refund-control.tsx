"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatZar } from "@/domain/pricing";
import type { RefundReason } from "@/domain/entities";

const REASONS: RefundReason[] = [
  "WRONG_SIZE",
  "CUSTOMER_ARTWORK_ERROR",
  "PRINTER_DEFECT",
  "DAMAGED",
  "WRONG_ITEM",
  "LOST_SHIPMENT",
  "CUSTOMER_CANCELLATION",
  "OTHER",
];

export function RefundControl({
  orderId,
  totalCents,
  pendingRefundId,
}: {
  orderId: string;
  totalCents: number;
  pendingRefundId?: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState((totalCents / 100).toFixed(2));
  const [reason, setReason] = useState<RefundReason>("PRINTER_DEFECT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, amountCents: Math.round(Number(amount) * 100), reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't request refund.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't request refund.");
    } finally {
      setBusy(false);
    }
  }

  async function resolve(approve: boolean) {
    if (!pendingRefundId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/refunds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundId: pendingRefundId, approve }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't resolve refund.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't resolve refund.");
    } finally {
      setBusy(false);
    }
  }

  if (pendingRefundId) {
    return (
      <div className="space-y-2">
        <p className="text-sm">A refund is pending approval.</p>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => resolve(true)} className="border-2 border-ink bg-ok px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Approve &amp; refund</button>
          <button type="button" disabled={busy} onClick={() => resolve(false)} className="border-2 border-ink bg-paper px-3 py-2 text-sm font-bold disabled:opacity-50">Reject</button>
        </div>
        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 border-2 border-ink bg-paper px-3 py-2 text-sm" />
        <select value={reason} onChange={(e) => setReason(e.target.value as RefundReason)} className="border-2 border-ink bg-paper px-3 py-2 text-sm">
          {REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ").toLowerCase()}</option>)}
        </select>
        <button type="button" disabled={busy} onClick={request} className="border-2 border-ink bg-paper px-3 py-2 text-sm font-bold hover:bg-paper-2 disabled:opacity-50">Request refund</button>
      </div>
      <p className="font-mono text-xs text-muted">Max {formatZar(totalCents)}</p>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
