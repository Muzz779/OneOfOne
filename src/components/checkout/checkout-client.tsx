"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatZar } from "@/domain/pricing";
import type { CartViewDTO } from "@/lib/dto";
import type { DeliveryMethod } from "@/domain/pricing";

export function CheckoutClient() {
  const router = useRouter();
  const [cart, setCart] = useState<CartViewDTO | null>(null);
  const [method, setMethod] = useState<DeliveryMethod>("PUDO");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    line1: "",
    city: "",
    province: "",
    postalCode: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/cart");
      const data = await res.json();
      if (data.breakdown) setCart(data as CartViewDTO);
    })();
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        customer: { name: form.name, email: form.email, phone: form.phone },
        deliveryMethod: method,
        deliveryAddress:
          method === "PUDO"
            ? {
                line1: form.line1,
                city: form.city,
                province: form.province,
                postalCode: form.postalCode,
              }
            : undefined,
      };
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed.");
      router.push(data.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (cart && cart.items.length === 0) {
    return (
      <div className="card-raw p-8 text-center">
        <p className="font-display text-xl font-bold">Your cart is empty</p>
        <Link href="/studio" className="btn-raw mt-4 inline-flex">Start a design →</Link>
      </div>
    );
  }

  const deliveryCents = method === "COLLECTION" ? 0 : (cart?.breakdown.deliveryChargeCents ?? 6000);
  const subtotal = cart?.breakdown.subtotalCents ?? 0;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <fieldset className="card-raw p-5">
          <legend className="px-2 font-display text-lg font-bold">Your details</legend>
          <div className="space-y-3">
            <Input label="Full name" value={form.name} onChange={set("name")} required />
            <Input label="Email" type="email" value={form.email} onChange={set("email")} required />
            <Input label="Contact number" value={form.phone} onChange={set("phone")} required />
          </div>
        </fieldset>

        <fieldset className="card-raw p-5">
          <legend className="px-2 font-display text-lg font-bold">Delivery</legend>
          <div className="mb-4 flex gap-2">
            {(["PUDO", "COLLECTION"] as DeliveryMethod[]).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMethod(m)}
                className={`flex-1 border-2 border-ink px-3 py-2 font-bold ${method === m ? "bg-ink text-paper" : "bg-paper hover:bg-paper-2"}`}
              >
                {m === "PUDO" ? "PUDO delivery" : "Collect in store"}
              </button>
            ))}
          </div>
          {method === "PUDO" && (
            <div className="space-y-3">
              <Input label="Street address" value={form.line1} onChange={set("line1")} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" value={form.city} onChange={set("city")} required />
                <Input label="Province" value={form.province} onChange={set("province")} required />
              </div>
              <Input label="Postal code" value={form.postalCode} onChange={set("postalCode")} required />
            </div>
          )}
        </fieldset>
      </div>

      <aside className="card-raw h-fit p-5">
        <h2 className="font-display text-lg font-bold">Summary</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="font-semibold">{formatZar(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="font-semibold">{formatZar(deliveryCents)}</dd></div>
          <div className="flex items-baseline justify-between border-t-2 border-ink pt-2">
            <dt className="font-bold">Total</dt>
            <dd className="font-display text-2xl font-bold">{formatZar(subtotal + deliveryCents)}</dd>
          </div>
        </dl>
        {error && <p className="mt-3 border-2 border-danger bg-danger/10 px-2 py-1 text-sm font-semibold text-danger">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-raw mt-4 w-full disabled:bg-muted">
          {submitting ? "Creating order…" : "Continue to payment →"}
        </button>
        <p className="mt-2 text-center font-mono text-[11px] text-muted">Payment is confirmed securely on our server.</p>
      </aside>
    </form>
  );
}

function Input({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        {...props}
        className="w-full border-2 border-ink bg-paper px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </label>
  );
}
