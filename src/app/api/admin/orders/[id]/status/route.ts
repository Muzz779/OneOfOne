import { updateOrderStatus } from "@/server/app/admin";
import { requireAdminApi } from "@/server/session";
import { fail, json, readJson } from "@/server/http";
import type { OrderState } from "@/domain/orders";

export const runtime = "nodejs";

// POST /api/admin/orders/[id]/status — validated status transition (§25).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const { to, note } = await readJson<{ to: OrderState; note?: string }>(req);
    const order = await updateOrderStatus(id, to, note);
    return json({ ok: true, status: order.status });
  } catch (e) {
    return fail(e);
  }
}
