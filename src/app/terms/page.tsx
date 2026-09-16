import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & content policy — OneOfOne",
  description: "Terms of service, acceptable-use and prohibited-content policy for OneOfOne custom apparel.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Terms &amp; content policy</h1>
      <p className="mt-2 text-sm text-muted">Development draft — not legal advice. Have this reviewed before launch.</p>

      <Section title="1. Your artwork, your responsibility">
        You confirm that you own or have the rights to use any image you upload, and
        that printing it does not infringe anyone&apos;s copyright, trademark, or other
        rights. You are responsible for the content you submit. We do not review or
        make legal determinations about ownership on your behalf.
      </Section>

      <Section title="2. Prohibited content">
        Do not upload material that is unlawful, hateful, harassing, sexually
        exploitative, incites violence, infringes intellectual property, or that you
        do not have the right to reproduce. We may decline or cancel any order whose
        artwork breaches this policy.
      </Section>

      <Section title="3. Reporting & takedowns">
        If you believe content on OneOfOne infringes your rights, contact{" "}
        <a href="mailto:support@oneofone.co.za" className="font-semibold underline underline-offset-4">support@oneofone.co.za</a>{" "}
        with details and we will review and, where appropriate, remove it.
      </Section>

      <Section title="4. Print previews">
        Mockups are illustrative previews. Actual print colour and garment appearance
        may vary slightly from what you see on screen.
      </Section>

      <Section title="5. Payments, delivery & refunds">
        Prices are shown in South African Rand. Payment is processed by our payment
        provider. Delivery is via our courier partners. Refunds and reprints are
        handled per our refund policy — contact support with your order number.
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 text-muted">{children}</p>
    </section>
  );
}
