import { CartClient } from "@/components/cart/cart-client";

export const metadata = { title: "Cart — OneOfOne" };
export const dynamic = "force-dynamic";

export default function CartPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 font-display text-3xl font-bold">Your cart</h1>
      <CartClient />
    </main>
  );
}
