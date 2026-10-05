import { getRepo } from "@/server/container";
import {
  isEmailConfigured,
  isSupabaseConfigured,
  isYocoConfigured,
  mockPaymentsAllowed,
} from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — liveness + config readout (no secrets). Hit daily by the
// Vercel cron in vercel.json: the real DB query keeps a free-tier Supabase
// project from being paused for inactivity.
export async function GET() {
  let db = false;
  try {
    await getRepo().getPricingConfig();
    db = true;
  } catch (err) {
    console.error("[health] database check failed", err);
  }
  const payments = isYocoConfigured() ? "yoco" : mockPaymentsAllowed() ? "mock" : "disabled";
  return Response.json(
    {
      ok: db,
      db,
      storage: isSupabaseConfigured() ? "supabase" : "disk",
      payments,
      email: isEmailConfigured() ? "resend" : "log-only",
      at: new Date().toISOString(),
    },
    { status: db ? 200 : 503 },
  );
}
