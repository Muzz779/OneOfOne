import { ensureSeeded } from "@/server/seed";
import { fail, json } from "@/server/http";
import { forbidden } from "@/server/errors";

export const runtime = "nodejs";

// POST /api/setup?token=... — one-time inventory seed for a fresh deployment.
// Gated by ONEOFONE_SETUP_TOKEN so it can't be triggered by strangers. Idempotent.
export async function POST(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    const expected = process.env.ONEOFONE_SETUP_TOKEN;
    if (!expected || token !== expected) throw forbidden("Invalid setup token.");
    const result = await ensureSeeded();
    return json({ ok: true, ...result });
  } catch (e) {
    return fail(e);
  }
}
