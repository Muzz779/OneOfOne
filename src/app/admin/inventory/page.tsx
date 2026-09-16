import { requireAdmin } from "@/server/session";
import { listInventory } from "@/server/app/admin";
import { InventoryEditor } from "@/components/admin/inventory-editor";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  await requireAdmin();
  const inventory = await listInventory();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Inventory</h1>
      <p className="text-sm text-muted">Stock is tracked per product · colour · size (§15).</p>
      <InventoryEditor initial={inventory} />
    </div>
  );
}
