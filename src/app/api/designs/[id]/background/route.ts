import { removeBackground } from "@/server/app/designs";
import { tooMany } from "@/server/errors";
import { clientKey, rateLimit } from "@/server/ratelimit";
import { fail, json } from "@/server/http";

export const runtime = "nodejs";

// POST /api/designs/[id]/background — background removal (§8, §41).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rl = rateLimit(clientKey(req, "bg"), 10, 60_000);
    if (!rl.ok) throw tooMany();
    const { id } = await params;
    return json(await removeBackground(id));
  } catch (e) {
    return fail(e);
  }
}
