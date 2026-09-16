import Link from "next/link";
import { SEED_PRODUCTS } from "@/domain/products";

const STEPS = [
  {
    n: "01",
    title: "Upload anything",
    body: "A phone photo, a logo, a scribble. Any JPG, PNG, WEBP or SVG.",
  },
  {
    n: "02",
    title: "We make it print-ready",
    body: "We measure the real resolution at your print size and enhance it if it needs it.",
  },
  {
    n: "03",
    title: "See exactly what you get",
    body: "Position it on the real garment, on the real printable area, at true scale.",
  },
  {
    n: "04",
    title: "Order & receive locally",
    body: "Transparent pricing in Rands, delivered across South Africa.",
  },
];

export default function Home() {
  return (
    <main>
      {/* HERO */}
      <section className="border-b-2 border-ink">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <span className="badge-raw bg-volt text-ink">
              Custom apparel · printed in SA
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] sm:text-6xl">
              Upload anything.
              <br />
              <span className="bg-accent px-2 text-white">We make it</span>{" "}
              print-ready.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              No Photoshop. No DPI headaches. No design skills. Drop in an image,
              and we&apos;ll tell you honestly whether it&apos;ll print well —
              then put it on a garment you can actually order.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/studio" className="btn-raw text-base">
                Start your design →
              </Link>
              <Link
                href="/studio"
                className="border-2 border-ink bg-paper px-4 py-2.5 font-bold hover:bg-paper-2"
              >
                See a quality check
              </Link>
            </div>
          </div>

          {/* Asymmetric stacked cards, not a symmetric grid (§34C) */}
          <div className="relative min-h-[280px]">
            <div className="card-raw absolute right-0 top-0 w-56 rotate-2 p-4">
              <div className="badge-raw bg-ok text-white">Excellent</div>
              <p className="mt-2 font-mono text-xs text-muted">
                4000×5400px → 300 DPI at 30×40cm
              </p>
              <div className="mt-2 h-20 border-2 border-ink bg-[repeating-linear-gradient(45deg,#2b4cf0_0_10px,#f4f1ea_0_20px)]" />
            </div>
            <div className="card-raw absolute left-0 top-24 w-56 -rotate-3 p-4">
              <div className="badge-raw bg-warn text-ink">Needs enhancement</div>
              <p className="mt-2 font-mono text-xs text-muted">
                a little small — we&apos;ll boost it
              </p>
              <div className="mt-2 h-20 border-2 border-ink bg-[repeating-linear-gradient(45deg,#ff4d2e_0_10px,#f4f1ea_0_20px)]" />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          The hard part, handled.
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card-raw p-4">
              <span className="font-mono text-sm text-accent">{s.n}</span>
              <h3 className="mt-1 font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="border-t-2 border-ink bg-paper-2">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Start with a blank canvas
            </h2>
            <Link
              href="/studio"
              className="hidden font-bold underline underline-offset-4 sm:inline"
            >
              Open the studio →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {SEED_PRODUCTS.map((p) => (
              <Link
                key={p.id}
                href="/studio"
                className="card-raw flex items-center justify-between p-5 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
              >
                <div>
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted">
                    {p.description}
                  </p>
                  <p className="mt-3 badge-raw bg-paper">
                    from R{(p.basePriceCents / 100).toFixed(0)}
                  </p>
                </div>
                <span className="grid h-14 w-14 shrink-0 place-items-center border-2 border-ink bg-accent text-2xl text-white">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
