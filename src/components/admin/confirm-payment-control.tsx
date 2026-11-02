"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatZar } from "@/domain/pricing";

/** Owner confirms a bank transfer by typing the amount they see in their bank. */
export function ConfirmPaymentControl({
  orderId,
  totalCents,
  reference,
}: {
  orderId: string;
  totalCents: number;
  reference: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    const rands = Number(amount.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(rands) || rands <= 0) {
      setError("Type the amount you can see in your bank account.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: Math.round(rands * 100), note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't confirm payment.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't confirm payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <p>
        Waiting for a bank transfer of <strong>{formatZar(totalCents)}</strong> with reference{" "}
        <span className="font-mono font-bold">{reference}</span>.
      </p>
      <p className="border-2 border-ink bg-warn/30 px-2 py-1 text-xs">
        Only confirm once the money shows in your <strong>banking app</strong>. Never confirm from a screenshot or
        &ldquo;proof of payment&rdquo; alone — fake ones are common.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">Amount received (R)</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={(totalCents / 100).toFixed(2)}
          className="w-full border-2 border-ink bg-paper px-3 py-2 font-mono font-semibold"
        />
      </label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional), e.g. FNB, 14:02"
        className="w-full border-2 border-ink bg-paper px-3 py-2"
      />
      {error && <p className="font-semibold text-danger">{error}</p>}
      <button
        type="button"
        disabled={busy || !amount.trim()}
        onClick={confirm}
        className="w-full border-2 border-ink bg-ok px-3 py-2 font-bold text-white disabled:opacity-50"
      >
        {busy ? "Confirming…" : "Confirm payment received"}
      </button>
      <p className="text-xs text-muted">This marks the order paid, updates stock, emails the customer and creates the print files.</p>
    </div>
  );
}
