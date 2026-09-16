import { requireAdmin } from "@/server/session";
import { getPricing } from "@/server/app/admin";
import { PricingEditor } from "@/components/admin/pricing-editor";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  await requireAdmin();
  const config = await getPricing();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Pricing rules</h1>
      <p className="text-sm text-muted">
        Server-side pricing config (§16). Retail garment prices come from the
        product catalogue; these rules set print charges, fees and delivery.
      </p>
      <PricingEditor initial={config} />
    </div>
  );
}
