import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, SEED_PRODUCTS } from "@/domain/products";
import { formatZar } from "@/domain/pricing";
import { GarmentSilhouette } from "@/components/studio/garment";

export function generateStaticParams() {
  return SEED_PRODUCTS.filter((p) => p.active).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Product — OneOfOne" };
  return {
    title: `Custom ${product.name} — OneOfOne`,
    description: `${product.description} Upload your design and we make it print-ready. From ${formatZar(product.basePriceCents)}.`,
    alternates: { canonical: `/products/${product.slug}` },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="card-raw p-6">
          <div className="relative mx-auto w-full max-w-sm" style={{ aspectRatio: "100 / 120" }}>
            <GarmentSilhouette category={product.category} hex={product.colours[0].hex} />
          </div>
        </div>
        <div>
          <span className="badge-raw bg-volt text-ink">{product.category}</span>
          <h1 className="mt-3 font-display text-4xl font-bold">{product.name}</h1>
          <p className="mt-2 text-lg text-muted">{product.description}</p>
          <p className="mt-4 font-display text-2xl font-bold">from {formatZar(product.basePriceCents)}</p>

          <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">Colours</h2>
          <div className="mt-2 flex gap-2">
            {product.colours.map((c) => (
              <span key={c.name} className="h-8 w-8 border-2 border-ink" style={{ background: c.hex }} title={c.name} />
            ))}
          </div>

          <h2 className="mt-5 text-sm font-bold uppercase tracking-wide text-muted">Sizes</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <span key={s} className="badge-raw bg-paper">{s}</span>
            ))}
          </div>

          <h2 className="mt-5 text-sm font-bold uppercase tracking-wide text-muted">Print areas</h2>
          <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
            {product.printAreas.map((a) => (
              <li key={a.side}>{a.label}: up to {(a.maxWidthMm / 10).toFixed(0)}×{(a.maxHeightMm / 10).toFixed(0)}cm</li>
            ))}
          </ul>

          <Link href="/studio" className="btn-raw mt-7 inline-flex text-base">Design this {product.name} →</Link>
        </div>
      </div>
    </main>
  );
}
