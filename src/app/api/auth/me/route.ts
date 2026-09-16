import { getCurrentUser } from "@/server/session";
import { fail, json } from "@/server/http";

export const runtime = "nodejs";

// GET /api/auth/me — the signed-in customer (safe fields only).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ user: null });
    return json({ user: { id: user.id, email: user.email, name: user.name ?? "" } });
  } catch (e) {
    return fail(e);
  }
}
