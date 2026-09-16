import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/session";
import { getOrderDetail } from "@/server/app/admin";
import { formatZar } from "@/domain/pricing";
import { ORDER_STATE_LABELS } from "@/domain/orders";
import { StatusControl } from "@/components/admin/status-control";
import { RefundControl } from "@/components/admin/refund-control";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  let detail;
  try {
    detail = await getOrderDetail(id);
  } catch {
    notFound();
  }
  const { order, margin, payment, shipment, productionAssets, preflights, refunds } = detail!;
  const pendingRefund = refunds.find((r) => r.status === "REQUESTED");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Order {order.orderNumber}</h1>
        <span className="badge-raw bg-ink text-paper">{ORDER_STATE_LABELS[order.status]}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          {/* Items + production */}
          <section className="border-2 border-ink bg-paper-2">
            <h2 className="border-b-2 border-ink px-4 py-2 font-display font-bold">Items &amp; production files</h2>
            <div className="divide-y divide-ink/20">
              {order.items.map((item) => (
                <div key={item.id} className="p-4">
                  <p className="font-bold">{item.productName} — {item.colour} / {item.size} · qty {item.quantity}</p>
                  <div className="mt-2 space-y-2">
                    {item.prints.map((print) => {
                      const pa = productionAssets.find((a) => a.orderItemId === item.id && a.side === print.side);
                      const pf = print.preflightResultId ? preflights[print.preflightResultId] : undefined;
                      return (
                        <div key={print.side} className="border-2 border-ink bg-paper p-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold capitalize">{print.side.toLowerCase()} · {print.widthMm.toFixed(0)}×{print.heightMm.toFixed(0)}mm</span>
                            {pf && (
                              <span className={`badge-raw ${pf.result.result === "PASS" ? "bg-ok text-white" : "bg-danger text-white"}`}>
                                Preflight {pf.result.result}
                              </span>
                            )}
                          </div>
                          {pa && (
                            <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-xs">
                              <span>{order.orderNumber} / {pa.designId.slice(0, 10)} / v{pa.version} / {pa.side}</span>
                              <span>{pa.widthMm}×{pa.heightMm}mm · {pa.format} {pa.dpi}DPI · {(pa.bytes / 1024).toFixed(0)}KB</span>
                              <a href={`/api/admin/download?assetId=${pa.id}`} className="ml-auto border-2 border-ink bg-accent px-2 py-1 font-bold text-white">Download</a>
                            </div>
                          )}
                          {pf && pf.result.result === "FAIL" && (
                            <ul className="mt-2 list-disc pl-5 text-xs text-danger">
                              {pf.result.failureReasons.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Timeline */}
          <section className="border-2 border-ink bg-paper-2">
            <h2 className="border-b-2 border-ink px-4 py-2 font-display font-bold">Timeline</h2>
            <ol className="space-y-1 p-4 text-sm">
              {order.timeline.map((t, i) => (
                <li key={i} className="flex justify-between border-b border-ink/10 py-1">
                  <span className="font-semibold">{ORDER_STATE_LABELS[t.state]}{t.note ? ` — ${t.note}` : ""}</span>
                  <span className="font-mono text-xs text-muted">{new Date(t.at).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-5">
          {/* Status control */}
          <section className="border-2 border-ink bg-paper-2 p-4">
            <h2 className="mb-2 font-display font-bold">Update status</h2>
            <StatusControl orderId={order.id} current={order.status} />
          </section>

          {/* Margin — admin only (§17) */}
          <section className="border-2 border-ink bg-paper-2 p-4">
            <h2 className="mb-2 font-display font-bold">Margin (internal)</h2>
            <dl className="space-y-1 font-mono text-xs">
              <Row label="Customer total" value={formatZar(order.breakdown.totalCents)} />
              <Row label="Garment cost" value={formatZar(margin.garmentCostCents)} />
              <Row label="Print cost" value={formatZar(margin.printCostCents)} />
              <Row label="Packaging" value={formatZar(margin.packagingCostCents)} />
              <Row label="Delivery cost" value={formatZar(margin.deliveryCostCents)} />
              <Row label="Payment fee" value={formatZar(margin.paymentFeeCents)} />
              <Row label="Total cost" value={formatZar(margin.totalCostCents)} />
              <div className="mt-1 border-t-2 border-ink pt-1">
                <Row label="Gross profit" value={formatZar(margin.grossProfitCents)} bold />
                <Row label="Gross margin" value={`${margin.grossMarginPercent.toFixed(1)}%`} bold />
              </div>
            </dl>
          </section>

          {/* Customer + payment */}
          <section className="border-2 border-ink bg-paper-2 p-4 text-sm">
            <h2 className="mb-2 font-display font-bold">Customer</h2>
            <p className="font-semibold">{order.customer.name}</p>
            <p className="text-muted">{order.customer.email}</p>
            <p className="text-muted">{order.customer.phone}</p>
            {order.deliveryAddress && (
              <p className="mt-1 text-muted">{order.deliveryAddress.line1}, {order.deliveryAddress.city}, {order.deliveryAddress.province} {order.deliveryAddress.postalCode}</p>
            )}
            <p className="mt-2 font-mono text-xs text-muted">Payment: {payment?.status ?? "—"} via {payment?.provider ?? "—"}</p>
            {shipment && <p className="font-mono text-xs text-muted">Shipment: {shipment.status} {shipment.trackingNumber ? `· ${shipment.trackingNumber}` : ""}</p>}
          </section>

          {/* Refunds (§30) */}
          <section className="border-2 border-ink bg-paper-2 p-4">
            <h2 className="mb-2 font-display font-bold">Refund</h2>
            <RefundControl orderId={order.id} totalCents={order.breakdown.totalCents} pendingRefundId={pendingRefund?.id} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={bold ? "font-bold text-ink" : "font-semibold"}>{value}</dd>
    </div>
  );
}
