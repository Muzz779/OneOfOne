import Link from "next/link";
import { requireAdmin } from "@/server/session";
import { getRepo } from "@/server/container";
import { formatZar } from "@/domain/pricing";
import { ORDER_STATE_LABELS, type OrderState } from "@/domain/orders";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const orders = await getRepo().listOrders({
    status: sp.status as OrderState | undefined,
    search: sp.q,
  });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Orders</h1>
      <form className="flex gap-2" action="/admin/orders">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search order #, name, email" className="flex-1 border-2 border-ink bg-paper px-3 py-2 text-sm" />
        <button className="border-2 border-ink bg-paper px-3 py-2 text-sm font-bold hover:bg-paper-2">Search</button>
      </form>
      <div className="overflow-x-auto border-2 border-ink bg-paper-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left">
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Placed</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-ink/20">
                <td className="px-4 py-2 font-mono font-bold">{o.orderNumber}</td>
                <td className="px-4 py-2">{o.customer.name}</td>
                <td className="px-4 py-2 text-muted">{ORDER_STATE_LABELS[o.status]}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(o.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right font-semibold">{formatZar(o.breakdown.totalCents)}</td>
                <td className="px-4 py-2 text-right"><Link href={`/admin/orders/${o.id}`} className="font-semibold underline underline-offset-4">Open</Link></td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">No orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
