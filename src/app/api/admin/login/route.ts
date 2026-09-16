import { adminLogin } from "@/server/session";
import { tooMany } from "@/server/errors";
import { clientKey, rateLimit } from "@/server/ratelimit";
import { fail, json, readJson } from "@/server/http";

export const runtime = "nodejs";

// POST /api/admin/login — mock admin auth (§40, §41).
export async function POST(req: Request) {
  try {
    const rl = rateLimit(clientKey(req, "admin-login"), 10, 60_000);
    if (!rl.ok) throw tooMany();
    const { email, password } = await readJson<{ email: string; password: string }>(req);
    const result = await adminLogin(email, password);
    return json(result, { status: result.ok ? 200 : 401 });
  } catch (e) {
    return fail(e);
  }
}
