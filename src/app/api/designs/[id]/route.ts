import { getDesignDTO, saveDesign, type SavePatch } from "@/server/app/designs";
import { fail, json, readJson } from "@/server/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/designs/[id] — resume a design (§12).
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return json(await getDesignDTO(id));
  } catch (e) {
    return fail(e);
  }
}

// PATCH /api/designs/[id] — autosave editor state (§12).
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const patch = await readJson<SavePatch>(req);
    return json(await saveDesign(id, patch));
  } catch (e) {
    return fail(e);
  }
}
