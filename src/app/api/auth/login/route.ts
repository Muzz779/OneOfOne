import { customerLogin } from "@/server/session";
import { tooMany } from "@/server/errors";
import { clientKey, rateLimit } from "@/server/ratelimit";
import { fail, json, readJson } from "@/server/http";

export const runtime = "nodejs";

// POST /api/auth/login — customer sign in (§40, §41).
export async function POST(req: Request) {
  try {
    const rl = rateLimit(clientKey(req, "login"), 20, 60_000);
    if (!rl.ok) throw tooMany();
    const { email, password } = await readJson<{ email: string; password: string }>(req);
    const result = await customerLogin(email, password);
    return json(result, { status: result.ok ? 200 : 401 });
  } catch (e) {
    return fail(e);
  }
}
