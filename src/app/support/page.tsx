import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — OneOfOne",
  description: "Get help with your OneOfOne order — WhatsApp and email support.",
};

// Configure a real number to switch the WhatsApp button on (digits only, incl.
// country code, e.g. 27821234567). Until then we show an honest "coming soon".
const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "");

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="badge-raw bg-volt text-ink">We&apos;re here to help</p>
      <h1 className="mt-3 font-display text-3xl font-bold">Support</h1>
      <p className="mt-2 text-muted">
        Questions about a design, an order, delivery or a refund? Reach us here —
        have your order number handy.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card-raw p-5">
          <h2 className="font-display text-lg font-bold">WhatsApp</h2>
          {WHATSAPP ? (
            <>
              <p className="mt-1 text-sm text-muted">Chat with us for the fastest reply.</p>
              <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="btn-raw mt-4 inline-flex">
                Chat on WhatsApp →
              </a>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">Our WhatsApp support line is coming soon.</p>
              <span className="badge-raw mt-4 inline-flex bg-warn text-ink">Coming soon</span>
            </>
          )}
        </div>

        <div className="card-raw p-5">
          <h2 className="font-display text-lg font-bold">Email</h2>
          <p className="mt-1 text-sm text-muted">We reply within one business day.</p>
          <a href="mailto:support@oneofone.co.za" className="mt-4 inline-flex border-2 border-ink bg-paper px-4 py-2.5 font-bold hover:bg-paper-2">
            support@oneofone.co.za
          </a>
        </div>
      </div>

      <p className="mt-6 font-mono text-xs text-muted">
        Signed in? Your orders and their status live under{" "}
        <a href="/account" className="underline underline-offset-4">My account</a>.
      </p>
    </main>
  );
}
