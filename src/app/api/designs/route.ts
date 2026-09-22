import { registerUploadedArtwork, uploadArtwork } from "@/server/app/designs";
import { badRequest, tooMany } from "@/server/errors";
import { clientKey, rateLimit } from "@/server/ratelimit";
import { fail, json, readJson } from "@/server/http";
import type { PrintSide } from "@/domain/products";

export const runtime = "nodejs";

// POST /api/designs (§3, §28, §41).
// JSON body { designId, side, key } → register an artwork uploaded directly to
// storage (production). Multipart (file) → upload through the server (dev/small).
export async function POST(req: Request) {
  try {
    const rl = rateLimit(clientKey(req, "upload"), 30, 60_000);
    if (!rl.ok) throw tooMany();

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await readJson<{ designId: string; side: PrintSide; key: string }>(req);
      if (!body.designId || !body.side || !body.key) throw badRequest("That upload wasn't valid.");
      const dto = await registerUploadedArtwork({
        designId: body.designId,
        side: body.side,
        key: body.key,
      });
      return json(dto, { status: 201 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Please choose a file to upload.");
    const designId = form.get("designId");
    const side = form.get("side");

    const buffer = Buffer.from(await file.arrayBuffer());
    const dto = await uploadArtwork({
      buffer,
      mimeType: file.type,
      filename: file.name,
      designId: typeof designId === "string" && designId ? designId : undefined,
      side: side === "BACK" || side === "FRONT" || side === "LEFT_SLEEVE" || side === "RIGHT_SLEEVE" ? side : undefined,
    });
    return json(dto, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
