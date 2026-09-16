import { PayClient } from "@/components/checkout/pay-client";

export const metadata = { title: "Payment — OneOfOne", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MockPayPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; amount?: string }>;
}) {
  const sp = await searchParams;
  const orderId = sp.order ?? "";
  const amountCents = Number(sp.amount ?? "0");
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <PayClient orderId={orderId} amountCents={amountCents} />
    </main>
  );
}
