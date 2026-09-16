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
              {order.items.map((item) => (
                <div key={item.id} className="border-2 border-ink bg-paper p-2 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-bold">{item.productName}</span>
                    <span className="font-mono text-xs">{item.colour} / {item.size} · qty {item.quantity}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {item.prints.map((print) => {
                      const pa = assets.find((a) => a.orderItemId === item.id && a.side === print.side);
                      return (
                        <div key={print.side} className="flex flex-wrap items-center gap-3 font-mono text-xs">
                          <span className="capitalize">{print.side.toLowerCase()}</span>
                          {pa && <span className="text-muted">{pa.widthMm}×{pa.heightMm}mm · {pa.dpi}DPI · {pa.format}</span>}
                          {pa && <a href={`/api/admin/download?assetId=${pa.id}`} className="ml-auto border-2 border-ink bg-accent px-2 py-1 font-bold text-white">Download</a>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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
