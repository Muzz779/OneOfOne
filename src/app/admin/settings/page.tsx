import { requireAdmin } from "@/server/session";
import { getStoreSettings } from "@/server/app/settings";
import { emailMode, isEftComplete } from "@/server/env";
import { SettingsForm } from "@/components/admin/settings-form";
import { EmailTest } from "@/components/admin/email-test";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getStoreSettings();
  const live = isEftComplete(settings.eft);
  const email = emailMode();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Payment details</h1>
        <span className={`badge-raw ${live ? "bg-ok text-white" : "bg-warn text-ink"}`}>
          {live ? "Bank transfer is ON at checkout" : "Bank transfer is OFF"}
        </span>
      </div>
      <p className="max-w-2xl text-sm text-muted">
        The account customers pay into when they choose bank transfer (EFT/PayShap). They only
        see these details on their own order page and payment email, after placing an order.
        Leave the bank fields empty to switch bank transfer off.
      </p>
      {settings.updatedAt && (
        <p className="font-mono text-xs text-muted">Last saved {new Date(settings.updatedAt).toLocaleString("en-ZA")}</p>
      )}
      <SettingsForm
        initial={{
          bankName: settings.eft.bankName,
          accountHolder: settings.eft.accountHolder,
          accountNumber: settings.eft.accountNumber,
          branchCode: settings.eft.branchCode,
          accountType: settings.eft.accountType,
          payShapId: settings.eft.payShapId,
          whatsapp: settings.whatsapp,
        }}
      />

      <section className="max-w-2xl space-y-3 border-t-2 border-ink pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl font-bold">Customer emails</h2>
          <span className={`badge-raw ${email === "log-only" ? "bg-warn text-ink" : "bg-ok text-white"}`}>
            {email === "log-only" ? "Not connected — emails are NOT being sent" : `Connected (${email})`}
          </span>
        </div>
        {email === "log-only" && (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Turn on 2-Step Verification on the Google account you want to send from.</li>
            <li>Create an app password at myaccount.google.com/apppasswords (name it &ldquo;OneOfOne&rdquo;).</li>
            <li>
              In Vercel → Settings → Environment Variables add <code className="font-mono">ONEOFONE_SMTP_USER</code> (that
              Gmail address) and <code className="font-mono">ONEOFONE_SMTP_PASSWORD</code> (the 16-letter app password),
              then redeploy.
            </li>
          </ol>
        )}
        <EmailTest connected={email !== "log-only"} />
      </section>
    </div>
  );
}
