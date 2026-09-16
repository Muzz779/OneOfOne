import { handlePaymentWebhook } from "@/server/app/payments";
import { tooMany } from "@/server/errors";
import { clientKey, rateLimit } from "@/server/ratelimit";
import { fail, json } from "@/server/http";

export const runtime = "nodejs";

// POST /api/payments/webhook — server-side payment confirmation (§19, §41).
// Verifies signature + idempotency; never trusts client success screens.
export async function POST(req: Request) {
  try {
    const rl = rateLimit(clientKey(req, "webhook"), 120, 60_000);
    if (!rl.ok) throw tooMany();

    const raw = await req.text();
    const signature = req.headers.get("x-oneofone-signature");
    const outcome = await handlePaymentWebhook(raw, signature);
    return json(outcome, { status: outcome.ok ? 200 : 400 });
  } catch (e) {
    return fail(e);
  }
}
