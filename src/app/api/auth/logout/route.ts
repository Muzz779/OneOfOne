import { customerLogout } from "@/server/session";
import { fail, json } from "@/server/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await customerLogout();
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
