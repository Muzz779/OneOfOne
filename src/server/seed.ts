/**
 * One-time seeding for a fresh Supabase project (CLAUDE.md §15, §16).
 *
 * Seeds inventory from the product catalogue and persists the default pricing
 * config, if not already present. Idempotent — safe to run more than once. The
 * in-memory dev repo seeds itself, so this is mainly for Supabase.
 */

import "server-only";
import { getRepo } from "./container";
import { SEED_PRODUCTS } from "@/domain/products";

const DEFAULT_STOCK = 25;

export async function ensureSeeded(): Promise<{ inventorySeeded: number }> {
  const repo = getRepo();

  // Persist the pricing config (getPricingConfig returns the default when the
  // row is missing; writing it back makes it editable in admin).
  await repo.setPricingConfig(await repo.getPricingConfig());

  const existing = await repo.listInventory();
  if (existing.length > 0) return { inventorySeeded: 0 };

  let count = 0;
  for (const p of SEED_PRODUCTS) {
    for (const colour of p.colours) {
      for (const size of p.sizes) {
        await repo.setInventory({
          productId: p.id,
          colour: colour.name,
          size,
          quantityAvailable: DEFAULT_STOCK,
        });
        count++;
      }
    }
  }
  return { inventorySeeded: count };
}
