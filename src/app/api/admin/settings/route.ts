import { saveStoreSettings } from "@/server/app/settings";
import { requireAdminApi } from "@/server/session";
import { fail, json, readJson } from "@/server/http";
import type { StoreSettingsInput } from "@/domain/store-settings";

export const runtime = "nodejs";

// POST /api/admin/settings — owner updates bank details + WhatsApp number.
export async function POST(req: Request) {
  try {
    const admin = await requireAdminApi();
    const input = await readJson<StoreSettingsInput>(req);
    const saved = await saveStoreSettings(input, admin.email);
    return json({ ok: true, settings: saved });
  } catch (e) {
    return fail(e);
  }
}
