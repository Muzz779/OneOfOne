import { CheckoutClient, type PaymentOption } from "@/components/checkout/checkout-client";
import { availablePaymentMethods, paymentMode } from "@/server/env";

export const metadata = { title: "Checkout — OneOfOne" };
export const dynamic = "force-dynamic";

const CARD_HINTS: Record<string, string> = {
  paystack: "Card, Capitec Pay or instant EFT on Paystack's secure page.",
  yoco: "Card on Yoco's secure page.",
  mock: "Test gateway — no money is taken.",
};

export default function CheckoutPage() {
  const options: PaymentOption[] = availablePaymentMethods().map((id) =>
    id === "card"
      ? { id, label: "Pay online", hint: CARD_HINTS[paymentMode()] ?? "" }
      : { id, label: "Bank transfer (EFT)", hint: "Pay from your banking app. We start printing once it reflects." },
  );
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 font-display text-3xl font-bold">Checkout</h1>
      <CheckoutClient paymentOptions={options} />
    </main>
  );
}
