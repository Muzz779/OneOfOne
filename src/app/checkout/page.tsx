import { CheckoutClient } from "@/components/checkout/checkout-client";

export const metadata = { title: "Checkout — OneOfOne" };
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 font-display text-3xl font-bold">Checkout</h1>
      <CheckoutClient />
    </main>
  );
}
