import { requireAdmin } from "@/server/session";
import { getStoreSettings } from "@/server/app/settings";
import { isEftComplete } from "@/server/env";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getStoreSettings();
  const live = isEftComplete(settings.eft);
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
    </div>
  );
}
