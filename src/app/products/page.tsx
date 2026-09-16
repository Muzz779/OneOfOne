import Link from "next/link";
import type { Metadata } from "next";
import { SEED_PRODUCTS } from "@/domain/products";
import { formatZar } from "@/domain/pricing";

export const metadata: Metadata = {
  title: "Custom apparel — OneOfOne",
  description:
    "Custom printed T-shirts and hoodies in South Africa. Upload any design, we make it print-ready, and you order it in minutes.",
  alternates: { canonical: "/products" },
};

export default function ProductsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Custom apparel</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Pick a blank, upload your design, and we&apos;ll make it print-ready. Printed and delivered across South Africa.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {SEED_PRODUCTS.filter((p) => p.active).map((p) => (
          <Link key={p.id} href={`/products/${p.slug}`} className="card-raw block p-5 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">{p.name}</h2>
                <p className="mt-1 max-w-sm text-sm text-muted">{p.description}</p>
              </div>
              <span className="badge-raw bg-paper">from {formatZar(p.basePriceCents)}</span>
            </div>
            <div className="mt-4 flex gap-1.5">
              {p.colours.map((c) => (
                <span key={c.name} className="h-6 w-6 border-2 border-ink" style={{ background: c.hex }} title={c.name} />
              ))}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
