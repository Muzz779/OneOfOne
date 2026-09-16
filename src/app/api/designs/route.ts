import { uploadArtwork } from "@/server/app/designs";
import { badRequest, tooMany } from "@/server/errors";
import { clientKey, rateLimit } from "@/server/ratelimit";
import { fail, json } from "@/server/http";

export const runtime = "nodejs";

// POST /api/designs — upload artwork (§3, §28, §41).
export async function POST(req: Request) {
  try {
    const rl = rateLimit(clientKey(req, "upload"), 20, 60_000);
    if (!rl.ok) throw tooMany();

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Please choose a file to upload.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const dto = await uploadArtwork({
      buffer,
      mimeType: file.type,
      filename: file.name,
    });
    return json(dto, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
