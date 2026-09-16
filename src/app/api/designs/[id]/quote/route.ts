import { quoteDesign } from "@/server/app/pricing";
import { fail, json } from "@/server/http";
import type { DeliveryMethod } from "@/domain/pricing";

export const runtime = "nodejs";

// GET /api/designs/[id]/quote?method=PUDO — server-side price preview (§16).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const method = (new URL(req.url).searchParams.get("method") ?? "PUDO") as DeliveryMethod;
    return json(await quoteDesign(id, method === "COLLECTION" ? "COLLECTION" : "PUDO"));
  } catch (e) {
    return fail(e);
  }
}
