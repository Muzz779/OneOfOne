import Link from "next/link";
import { LogoutButton } from "@/components/admin/logout-button";

export const metadata = { title: "Admin — OneOfOne", robots: { index: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/production", label: "Production" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/pricing", label: "Pricing" },
];

// Admin views relax the bold styling toward higher density (§34B exception),
// keeping the same type + palette.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-3">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-3 font-display text-lg font-bold">Admin</span>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-2 py-1 text-sm font-semibold hover:underline underline-offset-4"
            >
              {n.label}
            </Link>
          ))}
        </div>
        <LogoutButton />
      </div>
      {children}
    </div>
  );
}
