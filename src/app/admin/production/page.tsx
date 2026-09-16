import Link from "next/link";
import { requireAdmin } from "@/server/session";
import { productionQueue } from "@/server/app/admin";
import { ORDER_STATE_LABELS } from "@/domain/orders";
import { StatusControl } from "@/components/admin/status-control";

export const dynamic = "force-dynamic";

export default async function ProductionQueuePage() {
  await requireAdmin();
  const queue = await productionQueue();

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Production queue</h1>
      {queue.length === 0 && <p className="text-muted">Nothing queued for production yet.</p>}
      <div className="space-y-4">
        {queue.map(({ order, assets, jobStatus, allPassed }) => (
          <div key={order.id} className="border-2 border-ink bg-paper-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="badge-raw bg-ink text-paper">PRINT · {order.orderNumber}</span>
                <span className="text-sm font-semibold">{order.customer.name}</span>
                <span className="text-sm text-muted">{ORDER_STATE_LABELS[order.status]}</span>
              </div>
              <span className={`badge-raw ${allPassed ? "bg-ok text-white" : "bg-danger text-white"}`}>{allPassed ? "Preflight PASS" : "Needs review"}</span>
            </div>
            <div className="space-y-2 p-4">
              {order.items.map((item) => {
                const pa = assets.find((a) => a.orderItemId === item.id);
                return (
                  <div key={item.id} className="flex flex-wrap items-center gap-3 border-2 border-ink bg-paper p-2 text-sm">
                    <span className="font-bold">{item.productName}</span>
                    <span className="font-mono text-xs">{item.colour} / {item.size}</span>
                    {pa && <span className="font-mono text-xs text-muted">{pa.side} · {pa.widthMm}×{pa.heightMm}mm · {pa.dpi}DPI · {pa.format}</span>}
                    {pa && <a href={`/api/admin/download?assetId=${pa.id}`} className="ml-auto border-2 border-ink bg-accent px-2 py-1 text-xs font-bold text-white">Download file</a>}
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="font-mono text-xs text-muted">Job: {jobStatus}</span>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/orders/${order.id}`} className="text-sm font-semibold underline underline-offset-4">Open order</Link>
                  <StatusControl orderId={order.id} current={order.status} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
