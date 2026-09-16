import Link from "next/link";
import { requireUser } from "@/server/session";
import { getRepo } from "@/server/container";
import { formatZar } from "@/domain/pricing";
import { ORDER_STATE_LABELS } from "@/domain/orders";
import { CustomerLogout } from "@/components/account/customer-logout";

export const metadata = { title: "My account — OneOfOne" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const orders = await getRepo().listOrdersByUser(user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="badge-raw bg-volt text-ink">My account</p>
          <h1 className="mt-3 font-display text-3xl font-bold">Hi {user.name ?? "there"} 👋</h1>
          <p className="mt-1 text-muted">{user.email}</p>
        </div>
        <CustomerLogout />
      </div>

      <h2 className="mt-8 font-display text-xl font-bold">Your orders</h2>
      {orders.length === 0 ? (
        <div className="card-raw mt-3 p-8 text-center">
          <p className="text-muted">You haven&apos;t placed an order yet.</p>
          <Link href="/studio" className="btn-raw mt-4 inline-flex">Start a design →</Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="card-raw flex flex-wrap items-center justify-between gap-3 p-4 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
                <div>
                  <p className="font-display text-lg font-bold">{o.orderNumber}</p>
                  <p className="font-mono text-xs text-muted">{new Date(o.createdAt).toLocaleString()} · {o.items.length} item(s)</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="badge-raw bg-paper">{ORDER_STATE_LABELS[o.status]}</span>
                  <span className="font-display text-lg font-bold">{formatZar(o.breakdown.totalCents)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
