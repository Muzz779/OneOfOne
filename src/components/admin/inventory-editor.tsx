"use client";

import { useState } from "react";
import { getProductById } from "@/domain/products";
import type { InventoryRecord } from "@/domain/entities";

export function InventoryEditor({ initial }: { initial: InventoryRecord[] }) {
  const [rows, setRows] = useState(initial);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const key = (r: InventoryRecord) => `${r.productId}:${r.colour}:${r.size}`;

  async function save(r: InventoryRecord) {
    setSavingKey(key(r));
    try {
      await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: r.productId, colour: r.colour, size: r.size, quantity: r.quantityAvailable }),
      });
    } finally {
      setSavingKey(null);
    }
  }

  const byProduct = rows.reduce<Record<string, InventoryRecord[]>>((acc, r) => {
    (acc[r.productId] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {Object.entries(byProduct).map(([productId, recs]) => (
        <section key={productId} className="border-2 border-ink bg-paper-2">
          <h2 className="border-b-2 border-ink px-4 py-2 font-display font-bold">
            {getProductById(productId)?.name ?? productId}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/30 text-left">
                  <th className="px-4 py-2">Colour</th>
                  <th className="px-4 py-2">Size</th>
                  <th className="px-4 py-2">In stock</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={key(r)} className="border-b border-ink/10">
                    <td className="px-4 py-1.5">{r.colour}</td>
                    <td className="px-4 py-1.5 font-mono">{r.size}</td>
                    <td className="px-4 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={r.quantityAvailable}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) => (key(x) === key(r) ? { ...x, quantityAvailable: Math.max(0, Number(e.target.value) || 0) } : x)),
                          )
                        }
                        className="w-20 border-2 border-ink bg-paper px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <button type="button" onClick={() => save(r)} disabled={savingKey === key(r)} className="border-2 border-ink bg-paper px-2 py-1 text-xs font-bold hover:bg-volt disabled:opacity-50">
                        {savingKey === key(r) ? "…" : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
