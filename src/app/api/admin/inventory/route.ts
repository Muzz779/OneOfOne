import { setInventoryQty } from "@/server/app/admin";
import { requireAdminApi } from "@/server/session";
import { fail, json, readJson } from "@/server/http";

export const runtime = "nodejs";

// POST /api/admin/inventory — set stock for a variant (§15).
export async function POST(req: Request) {
  try {
    await requireAdminApi();
    const body = await readJson<{ productId: string; colour: string; size: string; quantity: number }>(req);
    await setInventoryQty(body.productId, body.colour, body.size, body.quantity);
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
