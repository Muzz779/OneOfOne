import { adminLogout } from "@/server/session";
import { fail, json } from "@/server/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await adminLogout();
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
