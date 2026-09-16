"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatZar } from "@/domain/pricing";

export function PayClient({ orderId, amountCents }: { orderId: string; amountCents: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(success: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, success }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.reason ?? "Payment failed.");
      router.push(`/orders/${orderId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card-raw p-6">
        <span className="badge-raw bg-warn text-ink">Development payment · mock gateway</span>
        <h1 className="mt-4 font-display text-2xl font-bold">Confirm payment</h1>
        <p className="mt-1 text-muted">
          This is a simulated hosted-payment page standing in for Yoco. It posts a
          real signed webhook to our server — no card is charged.
        </p>
        <p className="mt-4 flex items-baseline justify-between border-y-2 border-ink py-3">
          <span className="font-semibold">Amount</span>
          <span className="font-display text-3xl font-bold">{formatZar(amountCents)}</span>
        </p>
        {error && <p className="mt-3 border-2 border-danger bg-danger/10 px-2 py-1 text-sm font-semibold text-danger">{error}</p>}
        <button type="button" disabled={busy} onClick={() => pay(true)} className="btn-raw mt-4 w-full disabled:bg-muted">
          {busy ? "Processing…" : "Pay successfully"}
        </button>
        <button type="button" disabled={busy} onClick={() => pay(false)} className="mt-2 w-full border-2 border-ink bg-paper px-4 py-2.5 font-bold hover:bg-paper-2 disabled:opacity-50">
          Simulate a failed payment
        </button>
      </div>
    </div>
  );
}
