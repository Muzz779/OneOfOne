/**
 * Customer-facing order & tracking reads (CLAUDE.md §13, §17, §31, §32).
 *
 * Returns only customer-safe data — never margin/cost (§17) or storage keys
 * (§27). Mockup URLs are signed and short-lived.
 */

import "server-only";
import { getRepo, getStorage } from "@/server/container";
import { notFound } from "@/server/errors";
import type { Order, Shipment } from "@/domain/entities";

export interface CustomerOrderView {
  readonly order: Order;
  /** designId → signed mockup URL (when a mockup has been generated). */
  readonly mockups: Record<string, string>;
  readonly shipment?: Shipment;
}

export async function getCustomerOrder(orderId: string): Promise<CustomerOrderView> {
  const repo = getRepo();
  const storage = getStorage();
  const order = await repo.getOrder(orderId);
  if (!order) throw notFound("We couldn't find that order.");

  const mockups: Record<string, string> = {};
  for (const item of order.items) {
    const design = await repo.getDesign(item.designId);
    if (design?.mockupAssetId) {
      const asset = await repo.getAsset(design.mockupAssetId);
      if (asset) {
        mockups[design.id] = await storage.signedUrl(asset.bucket, asset.storageKey, 3600);
      }
    }
  }

  const shipment = order.shipmentId ? await repo.getShipment(order.shipmentId) : undefined;
  return { order, mockups, shipment };
}

export interface TrackingView {
  readonly orderNumber: string;
  readonly status: Order["status"];
  readonly shipment?: Shipment;
}

export async function getTracking(tracking: string): Promise<TrackingView> {
  const repo = getRepo();
  const shipment = await repo.getShipmentByTracking(tracking);
  if (!shipment) throw notFound("We couldn't find that tracking number.");
  const order = await repo.getOrder(shipment.orderId);
  if (!order) throw notFound("We couldn't find that order.");
  return { orderNumber: order.orderNumber, status: order.status, shipment };
}
