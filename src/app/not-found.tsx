import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid max-w-2xl place-items-center px-4 py-24 text-center">
      <div className="card-raw p-8">
        <p className="badge-raw bg-warn text-ink">404</p>
        <h1 className="mt-3 font-display text-3xl font-bold">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-muted">The link may be broken or the page may have moved.</p>
        <Link href="/" className="btn-raw mt-5 inline-flex">Back home</Link>
      </div>
    </main>
  );
}
