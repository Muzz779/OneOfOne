import { enhanceDesign } from "@/server/app/designs";
import { tooMany } from "@/server/errors";
import { clientKey, rateLimit } from "@/server/ratelimit";
import { fail, json, readJson } from "@/server/http";
import type { PrintSide } from "@/domain/products";

export const runtime = "nodejs";

// POST /api/designs/[id]/enhance — image enhancement for a side (§6, §41, §42).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rl = rateLimit(clientKey(req, "enhance"), 10, 60_000);
    if (!rl.ok) throw tooMany();
    const { id } = await params;
    const { side } = await readJson<{ side: PrintSide }>(req);
    return json(await enhanceDesign(id, side));
  } catch (e) {
    return fail(e);
  }
}
