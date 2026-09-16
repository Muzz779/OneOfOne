import { productionDownloadUrl } from "@/server/app/admin";
import { requireAdminApi } from "@/server/session";
import { fail } from "@/server/http";
import { badRequest } from "@/server/errors";

export const runtime = "nodejs";

// GET /api/admin/download?assetId= — redirect to a signed production-file URL (§26).
export async function GET(req: Request) {
  try {
    await requireAdminApi();
    const assetId = new URL(req.url).searchParams.get("assetId");
    if (!assetId) throw badRequest("Missing asset id.");
    const url = await productionDownloadUrl(assetId);
    return Response.redirect(new URL(url, req.url), 302);
  } catch (e) {
    return fail(e);
  }
}
