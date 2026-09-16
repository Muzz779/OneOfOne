import { getStorage } from "@/server/container";
import { isAdmin } from "@/server/session";
import { fail } from "@/server/http";
import { forbidden, notFound } from "@/server/errors";
import type { StorageBucket } from "@/domain/entities";

export const runtime = "nodejs";

const BUCKETS: StorageBucket[] = ["originals", "working", "production", "mockups", "exports"];

// GET /api/files/[bucket]?key=&exp=&sig= — serve a private asset via signed URL (§27).
export async function GET(req: Request, { params }: { params: Promise<{ bucket: string }> }) {
  try {
    const { bucket } = await params;
    if (!BUCKETS.includes(bucket as StorageBucket)) throw notFound("Unknown bucket.");
    const b = bucket as StorageBucket;

    const url = new URL(req.url);
    const key = url.searchParams.get("key") ?? "";
    const exp = Number(url.searchParams.get("exp") ?? "0");
    const sig = url.searchParams.get("sig") ?? "";

    const storage = getStorage();
    if (!key || !storage.verifySignature(b, key, exp, sig)) {
      throw forbidden("This link is invalid or has expired.");
    }

    // §27 — production files are downloadable by admins only.
    if (b === "production" && !(await isAdmin())) {
      throw forbidden("Production files are restricted.");
    }

    if (!(await storage.exists(b, key))) throw notFound("File not found.");
    const bytes = await storage.get(b, key);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": storage.contentTypeFor(key),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
