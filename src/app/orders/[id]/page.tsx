import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerOrder, mockupKey } from "@/server/app/orders";
import { getCurrentUser } from "@/server/session";
import { ORDER_STATE_LABELS } from "@/domain/orders";
import { formatZar } from "@/domain/pricing";

export const metadata = { title: "Your order — OneOfOne" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data;
  try {
    data = await getCustomerOrder(id);
  } catch {
    notFound();
  }
  const { order, mockups, shipment } = data!;
  const paid = order.status !== "DRAFT" && order.status !== "PENDING_PAYMENT" && order.status !== "FAILED";
  const user = await getCurrentUser();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="card-raw p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="badge-raw bg-volt text-ink">Order {order.orderNumber}</p>
            <h1 className="mt-3 font-display text-3xl font-bold">
              {paid ? "Thank you! Order confirmed." : order.status === "FAILED" ? "Payment didn't go through" : "Complete your payment"}
            </h1>
          </div>
          <span className={`badge-raw ${paid ? "bg-ok text-white" : order.status === "FAILED" ? "bg-danger text-white" : "bg-warn text-ink"}`}>
            {ORDER_STATE_LABELS[order.status]}
          </span>
        </div>

        {order.status === "PENDING_PAYMENT" && (
          <Link href={`/pay/mock?order=${order.id}&amount=${order.breakdown.totalCents}`} className="btn-raw mt-4 inline-flex">
            Complete payment →
          </Link>
        )}
        {paid && !user && (
          <p className="mt-4 border-2 border-ink bg-volt/30 px-3 py-2 text-sm">
            Want to keep track of this order?{" "}
            <Link href="/account/register" className="font-bold underline underline-offset-4">Create an account</Link>{" "}
            with {order.customer.email}.
          </p>
        )}
        {paid && user && (
          <p className="mt-4 text-sm text-muted">
            Saved to <Link href="/account" className="font-semibold underline underline-offset-4">your account</Link>.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="space-y-4">
          {order.items.map((item) => (
            <div key={item.id} className="card-raw p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold">{item.productName}</h3>
                  <p className="font-mono text-xs text-muted">{item.colour} · {item.size} · qty {item.quantity}</p>
                </div>
                <p className="font-semibold">{formatZar(item.unitPriceCents)} each</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                {item.prints.map((p) => {
                  const url = mockups[mockupKey(item.designId, p.side)];
                  return (
                    <figure key={p.side} className="text-center">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={`${p.side} print`} className="h-32 w-28 border-2 border-ink object-contain bg-paper" />
                      ) : (
                        <div className="grid h-32 w-28 place-items-center border-2 border-ink bg-paper text-[11px] text-muted">preview after payment</div>
                      )}
                      <figcaption className="mt-1 font-mono text-[11px] capitalize text-muted">
                        {p.side.toLowerCase()} · {(p.widthMm / 10).toFixed(0)}×{(p.heightMm / 10).toFixed(0)}cm
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="card-raw p-4">
            <h2 className="mb-3 font-display text-lg font-bold">Progress</h2>
            <ol className="space-y-2">
              {order.timeline.map((t, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="badge-raw bg-paper">{ORDER_STATE_LABELS[t.state]}</span>
                  <span className="font-mono text-xs text-muted">{new Date(t.at).toLocaleString()}</span>
                </li>
              ))}
            </ol>
            {shipment?.trackingUrl && (
              <Link href={shipment.trackingUrl} className="btn-raw mt-4 inline-flex">Track delivery →</Link>
            )}
          </div>
        </section>

        <aside className="card-raw h-fit p-5">
          <h2 className="font-display text-lg font-bold">Summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="font-semibold">{formatZar(order.breakdown.subtotalCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="font-semibold">{formatZar(order.breakdown.deliveryChargeCents)}</dd></div>
            <div className="flex items-baseline justify-between border-t-2 border-ink pt-2">
              <dt className="font-bold">Total</dt>
              <dd className="font-display text-2xl font-bold">{formatZar(order.breakdown.totalCents)}</dd>
            </div>
          </dl>
          <div className="mt-4 border-t-2 border-ink pt-3 text-sm">
            <p className="font-semibold">{order.customer.name}</p>
            <p className="text-muted">{order.customer.email}</p>
            {order.deliveryAddress && (
              <p className="mt-1 text-muted">{order.deliveryAddress.line1}, {order.deliveryAddress.city}</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
