import { customerSignup } from "@/server/session";
import { tooMany } from "@/server/errors";
import { clientKey, rateLimit } from "@/server/ratelimit";
import { fail, json, readJson } from "@/server/http";

export const runtime = "nodejs";

// POST /api/auth/signup — create a customer account (§40, §41).
export async function POST(req: Request) {
  try {
    const rl = rateLimit(clientKey(req, "signup"), 10, 60_000);
    if (!rl.ok) throw tooMany();
    const { email, name, password } = await readJson<{ email: string; name: string; password: string }>(req);
    const result = await customerSignup(email, name, password);
    return json(result, { status: result.ok ? 200 : 409 });
  } catch (e) {
    return fail(e);
  }
}
