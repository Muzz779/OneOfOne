import { simulateProviderWebhook } from "@/server/app/payments";
import { fail, json, readJson } from "@/server/http";

export const runtime = "nodejs";

// POST /api/payments/simulate — DEV ONLY (§53). The mock hosted-payment page
// calls this to emit a real signed webhook for the chosen outcome.
export async function POST(req: Request) {
  try {
    const { orderId, success } = await readJson<{ orderId: string; success: boolean }>(req);
    const outcome = await simulateProviderWebhook(orderId, success);
    return json(outcome, { status: outcome.ok ? 200 : 400 });
  } catch (e) {
    return fail(e);
  }
}
