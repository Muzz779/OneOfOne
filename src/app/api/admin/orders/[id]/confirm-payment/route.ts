import { confirmBankTransfer } from "@/server/app/payments";
import { requireAdminApi } from "@/server/session";
import { fail, json, readJson } from "@/server/http";

export const runtime = "nodejs";

// POST /api/admin/orders/[id]/confirm-payment — the owner confirms a bank
// transfer has reflected. Amount must match the order total (§19, §40).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const { amountCents, note } = await readJson<{ amountCents: number; note?: string }>(req);
    await confirmBankTransfer(id, Number(amountCents), note);
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
