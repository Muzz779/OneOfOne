import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — OneOfOne",
  description: "How OneOfOne handles your uploaded artwork and personal information.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Privacy</h1>
      <p className="mt-2 text-sm text-muted">Development draft — not legal advice.</p>

      <Section title="Your artwork">
        Uploaded artwork is stored privately and accessed through short-lived signed
        links. It is used only to process and produce your order. We keep the original
        you uploaded separate from the print-ready file we generate. Designs are never
        made public unless you explicitly choose to share them.
      </Section>
      <Section title="Your information">
        We collect only what we need to fulfil your order — your name, contact details,
        and delivery address. We don&apos;t sell your personal information.
      </Section>
      <Section title="Contact">
        Questions or a data request? Email{" "}
        <a href="mailto:support@oneofone.co.za" className="font-semibold underline underline-offset-4">support@oneofone.co.za</a>.
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
