import { setPricing } from "@/server/app/admin";
import { requireAdminApi } from "@/server/session";
import { fail, json, readJson } from "@/server/http";
import type { PricingConfig } from "@/domain/pricing";

export const runtime = "nodejs";

// POST /api/admin/pricing — update pricing rules (§16).
export async function POST(req: Request) {
  try {
    await requireAdminApi();
    const config = await readJson<PricingConfig>(req);
    const saved = await setPricing(config);
    return json({ ok: true, config: saved });
  } catch (e) {
    return fail(e);
  }
}
