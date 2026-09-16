"use client";

// Global error boundary (§45) — friendly message, no internal detail leaked.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto grid max-w-2xl place-items-center px-4 py-24 text-center">
      <div className="card-raw p-8">
        <p className="badge-raw bg-danger text-white">Something went wrong</p>
        <h1 className="mt-3 font-display text-3xl font-bold">That didn&apos;t work</h1>
        <p className="mt-2 text-muted">Please try again. If it keeps happening, contact support.</p>
        <button type="button" onClick={reset} className="btn-raw mt-5">Try again</button>
      </div>
    </main>
  );
}
