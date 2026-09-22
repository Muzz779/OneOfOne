import { prepareUpload } from "@/server/app/designs";
import { tooMany } from "@/server/errors";
import { clientKey, rateLimit } from "@/server/ratelimit";
import { fail, json, readJson } from "@/server/http";
import type { PrintSide } from "@/domain/products";

export const runtime = "nodejs";

// POST /api/uploads/prepare — get a direct-to-storage upload URL (production) or
// a signal to fall back to multipart (dev). Avoids the serverless body limit.
export async function POST(req: Request) {
  try {
    const rl = rateLimit(clientKey(req, "prepare"), 40, 60_000);
    if (!rl.ok) throw tooMany();
    const body = await readJson<{ contentType: string; side?: PrintSide; designId?: string }>(req);
    const result = await prepareUpload({
      contentType: body.contentType,
      side: body.side,
      designId: body.designId,
    });
    return json(result);
  } catch (e) {
    return fail(e);
  }
}
