import { getNotifier } from "@/server/container";
import { requireAdminApi } from "@/server/session";
import { badRequest, tooMany } from "@/server/errors";
import { clientKey, rateLimit } from "@/server/ratelimit";
import { emailMode, siteUrl } from "@/server/env";
import { fail, json, readJson } from "@/server/http";

export const runtime = "nodejs";

// POST /api/admin/email-test — owner sends themselves a test email to check
// that customer emails really go out.
export async function POST(req: Request) {
  try {
    await requireAdminApi();
    const rl = rateLimit(clientKey(req, "email-test"), 5, 10 * 60_000);
    if (!rl.ok) throw tooMany();
    const { to } = await readJson<{ to?: string }>(req);
    const address = String(to ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 200) {
      throw badRequest("Enter a valid email address to send the test to.");
    }
    const mode = emailMode();
    if (mode === "log-only") {
      throw badRequest("Email isn't connected yet — add the email settings in Vercel first (see the steps on this page).");
    }
    const { status } = await getNotifier().send({
      to: address,
      channel: "EMAIL",
      type: "PAYMENT_CONFIRMED",
      subject: "OneOfOne test email ✔",
      body: `This is a test from your OneOfOne store (${siteUrl()}).\n\nIf you can read this, customer order emails are working.\n\n— OneOfOne`,
    });
    if (status !== "SENT") {
      throw badRequest(
        "The email didn't send. Check ONEOFONE_SMTP_USER and the app password in Vercel (Logs show the exact reason).",
      );
    }
    return json({ ok: true, via: mode });
  } catch (e) {
    return fail(e);
  }
}
