import { getRepo } from "@/server/container";
import { adminAuthProblem, isEmailConfigured, isSupabaseConfigured, paymentMode } from "@/server/env";
import { isEftReady } from "@/server/app/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — liveness + config readout (no secrets). Hit daily by the
// Vercel cron in vercel.json: the real DB query keeps a free-tier Supabase
// project from being paused for inactivity.
export async function GET() {
  let db = false;
  let bankTransfer = false;
  try {
    await getRepo().getPricingConfig();
    db = true;
    bankTransfer = await isEftReady();
  } catch (err) {
    console.error("[health] database check failed", err);
  }
  const payments = paymentMode();
  return Response.json(
    {
      ok: db,
      db,
      storage: isSupabaseConfigured() ? "supabase" : "disk",
      payments,
      bankTransfer,
      admin: adminAuthProblem() ? "not-set-up" : "ready",
      email: isEmailConfigured() ? "resend" : "log-only",
      at: new Date().toISOString(),
    },
    { status: db ? 200 : 503 },
  );
}
