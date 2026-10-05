import { simulateProviderWebhook } from "@/server/app/payments";
import { mockPaymentsAllowed } from "@/server/env";
import { forbidden } from "@/server/errors";
import { fail, json, readJson } from "@/server/http";

export const runtime = "nodejs";

// POST /api/payments/simulate — DEV ONLY (§53). The mock hosted-payment page
// calls this to emit a signed webhook. Disabled in production so nobody can
// mark an order paid without paying.
export async function POST(req: Request) {
  try {
    if (!mockPaymentsAllowed()) throw forbidden("Mock payments are disabled.");
    const { orderId, success } = await readJson<{ orderId: string; success: boolean }>(req);
    const outcome = await simulateProviderWebhook(orderId, success);
    return json(outcome, { status: outcome.ok ? 200 : 400 });
  } catch (e) {
    return fail(e);
  }
}
