import { reconcilePaymentOnReturn } from "@/server/app/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/payments/return?order=<id> — where the hosted payment page sends the
// customer back. Confirms the payment with the provider server-to-server (in
// case the webhook is slow), then shows the order. The redirect itself is
// never trusted as proof of payment (§19).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order") ?? "";
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(orderId)) {
    return Response.redirect(new URL("/cart", url), 303);
  }
  try {
    await reconcilePaymentOnReturn(orderId);
  } catch (err) {
    // The webhook will still confirm it; just show the order as it stands.
    console.error("[payments/return] reconcile failed", err);
  }
  return Response.redirect(new URL(`/orders/${orderId}`, url), 303);
}
