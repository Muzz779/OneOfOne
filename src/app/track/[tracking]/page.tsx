import { notFound } from "next/navigation";
import { getTracking } from "@/server/app/orders";
import { ORDER_STATE_LABELS } from "@/domain/orders";

export const metadata = { title: "Track your order — OneOfOne" };
export const dynamic = "force-dynamic";

const SHIP_LABEL: Record<string, string> = {
  PENDING: "Preparing",
  COLLECTION_READY: "Ready for collection",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  FAILED: "Delivery issue",
};

export default async function TrackPage({ params }: { params: Promise<{ tracking: string }> }) {
  const { tracking } = await params;
  let data;
  try {
    data = await getTracking(tracking);
  } catch {
    notFound();
  }
  const { orderNumber, status, shipment } = data!;
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="card-raw p-6">
        <p className="badge-raw bg-volt text-ink">Tracking</p>
        <h1 className="mt-3 font-display text-3xl font-bold">Order {orderNumber}</h1>
        <p className="mt-1 font-mono text-sm text-muted">Tracking #{tracking}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <span className="badge-raw bg-paper">Order: {ORDER_STATE_LABELS[status]}</span>
          {shipment && <span className="badge-raw bg-ink text-paper">Delivery: {SHIP_LABEL[shipment.status] ?? shipment.status}</span>}
        </div>
        <p className="mt-4 text-sm text-muted">
          Delivery via {shipment?.provider ?? "our courier"}. This tracking view is a
          development stand-in for the PUDO tracking integration.
        </p>
      </div>
    </main>
  );
}
