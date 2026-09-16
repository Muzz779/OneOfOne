import Link from "next/link";
import { requireAdmin } from "@/server/session";
import { analyticsSummary } from "@/server/app/admin";
import { getRepo } from "@/server/container";
import { formatZar } from "@/domain/pricing";
import { ORDER_STATE_LABELS } from "@/domain/orders";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();
  const summary = await analyticsSummary();
  const orders = (await getRepo().listOrders()).slice(0, 6);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Paid orders" value={`${summary.ordersPaid}`} />
        <Stat label="Revenue" value={formatZar(summary.revenueCents)} />
        <Stat label="Refund rate" value={`${summary.refundRatePercent.toFixed(1)}%`} />
        <Stat label="Uploads" value={`${summary.funnel.UPLOAD ?? 0}`} />
      </div>

      <section className="border-2 border-ink bg-paper-2">
        <h2 className="border-b-2 border-ink px-4 py-2 font-display font-bold">Funnel</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 p-4 font-mono text-sm sm:grid-cols-3">
          {["UPLOAD", "ENHANCEMENT", "BACKGROUND_REMOVAL", "ADD_TO_CART", "CHECKOUT_STARTED", "PAYMENT_SUCCESS", "ORDER_COMPLETED", "PREFLIGHT_FAILED", "REFUND"].map((k) => (
            <div key={k} className="flex justify-between border-b border-ink/20 py-0.5">
              <span className="text-muted">{k}</span>
              <span className="font-bold">{summary.funnel[k] ?? 0}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-2 border-ink bg-paper-2">
        <div className="flex items-center justify-between border-b-2 border-ink px-4 py-2">
          <h2 className="font-display font-bold">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm font-semibold underline underline-offset-4">All orders →</Link>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-ink/20">
                <td className="px-4 py-2 font-mono font-bold">{o.orderNumber}</td>
                <td className="px-4 py-2">{o.customer.name}</td>
                <td className="px-4 py-2 text-muted">{ORDER_STATE_LABELS[o.status]}</td>
                <td className="px-4 py-2 text-right font-semibold">{formatZar(o.breakdown.totalCents)}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold underline underline-offset-4">Open</Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td className="px-4 py-6 text-center text-muted" colSpan={5}>No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-ink bg-paper-2 p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
