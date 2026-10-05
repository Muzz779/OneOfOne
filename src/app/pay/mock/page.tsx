import Link from "next/link";
import { PayClient } from "@/components/checkout/pay-client";
import { mockPaymentsAllowed } from "@/server/env";

export const metadata = { title: "Payment — OneOfOne", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MockPayPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; amount?: string }>;
}) {
  if (!mockPaymentsAllowed()) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="card-raw p-6 text-center">
          <h1 className="font-display text-2xl font-bold">Payment page unavailable</h1>
          <p className="mt-2 text-muted">This test payment page is switched off on the live store.</p>
          <Link href="/" className="btn-raw mt-5 inline-flex">Back home</Link>
        </div>
      </main>
    );
  }
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <PayClient orderId={sp.order ?? ""} amountCents={Number(sp.amount ?? "0")} />
    </main>
  );
}
