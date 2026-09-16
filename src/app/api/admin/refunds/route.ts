import { requestRefund, resolveRefund } from "@/server/app/admin";
import { requireAdminApi } from "@/server/session";
import { fail, json, readJson } from "@/server/http";
import type { RefundReason } from "@/domain/entities";

export const runtime = "nodejs";

// POST /api/admin/refunds — request a refund (§30).
export async function POST(req: Request) {
  try {
    await requireAdminApi();
    const body = await readJson<{ orderId: string; amountCents: number; reason: RefundReason; note?: string }>(req);
    const refund = await requestRefund(body.orderId, body.amountCents, body.reason, body.note);
    return json({ ok: true, refundId: refund.id });
  } catch (e) {
    return fail(e);
  }
}

// PATCH /api/admin/refunds — approve/reject a refund (§30).
export async function PATCH(req: Request) {
  try {
    await requireAdminApi();
    const { refundId, approve } = await readJson<{ refundId: string; approve: boolean }>(req);
    const refund = await resolveRefund(refundId, approve);
    return json({ ok: true, status: refund.status });
  } catch (e) {
    return fail(e);
  }
}
