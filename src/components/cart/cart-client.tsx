"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatZar } from "@/domain/pricing";
import type { CartViewDTO } from "@/lib/dto";

export function CartClient() {
  const [view, setView] = useState<CartViewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/cart");
        const data = await res.json();
        if (!alive) return;
        setView(data.breakdown ? (data as CartViewDTO) : { cartId: "", items: [], breakdown: data.breakdown });
      } catch {
        if (alive) setError("We couldn't load your cart.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setQty = useCallback(async (itemId: string, quantity: number) => {
    const res = await fetch(`/api/cart/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    if (res.ok) setView((await res.json()) as CartViewDTO);
  }, []);

  const remove = useCallback(async (itemId: string) => {
    const res = await fetch(`/api/cart/items/${itemId}`, { method: "DELETE" });
    if (res.ok) setView((await res.json()) as CartViewDTO);
  }, []);

  if (loading) return <p className="text-muted">Loading your cart…</p>;
  if (error) return <p className="border-2 border-danger bg-danger/10 px-3 py-2 font-semibold text-danger">{error}</p>;

  const items = view?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="card-raw p-8 text-center">
        <p className="font-display text-2xl font-bold">Your cart is empty</p>
        <p className="mt-2 text-muted">Design something one-of-one.</p>
        <Link href="/studio" className="btn-raw mt-5 inline-flex">Start a design →</Link>
      </div>
    );
  }

  const b = view!.breakdown;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.itemId} className="card-raw flex gap-4 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.thumbUrl} alt="" className="h-24 w-24 shrink-0 border-2 border-ink object-contain bg-paper" />
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold">{item.productName}</h3>
                  <p className="font-mono text-xs text-muted">{item.colour} · {item.size}</p>
                </div>
                <span className="font-display text-lg font-bold">{formatZar(item.unitPriceCents)}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center border-2 border-ink">
                  <button type="button" aria-label="Decrease" onClick={() => setQty(item.itemId, item.quantity - 1)} className="px-3 py-1 font-bold hover:bg-paper-2">−</button>
                  <span className="min-w-8 border-x-2 border-ink px-3 py-1 text-center font-mono">{item.quantity}</span>
                  <button type="button" aria-label="Increase" onClick={() => setQty(item.itemId, item.quantity + 1)} className="px-3 py-1 font-bold hover:bg-paper-2">+</button>
                </div>
                <button type="button" onClick={() => remove(item.itemId)} className="text-sm font-semibold text-danger underline underline-offset-4">Remove</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="card-raw h-fit p-5">
        <h2 className="font-display text-lg font-bold">Summary</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Subtotal" value={formatZar(b.subtotalCents)} />
          <Row label={`Delivery (${b.deliveryMethod === "COLLECTION" ? "Collection" : "PUDO"})`} value={formatZar(b.deliveryChargeCents)} />
          {b.discountCents > 0 && <Row label="Discount" value={`−${formatZar(b.discountCents)}`} />}
          <div className="flex items-baseline justify-between border-t-2 border-ink pt-2">
            <dt className="font-bold">Total</dt>
            <dd className="font-display text-2xl font-bold">{formatZar(b.totalCents)}</dd>
          </div>
        </dl>
        <Link href="/checkout" className="btn-raw mt-5 w-full">Checkout →</Link>
        <Link href="/studio" className="mt-2 block text-center text-sm font-semibold underline underline-offset-4">Add another design</Link>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
