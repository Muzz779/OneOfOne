/**
 * Admin / fulfillment use-cases (CLAUDE.md §17, §25, §26, §30).
 *
 * Order management, the production queue, production-file downloads, inventory
 * and pricing management, refunds, and analytics. Every status change is a
 * validated state-machine transition with the right fulfillment side-effects.
 * Margin data is admin-only (§17).
 */

import "server-only";
import { getDelivery, getRepo, getStorage } from "@/server/container";
import { badRequest, notFound } from "@/server/errors";
import { newId } from "@/domain/ids";
import { assertTransition, isFrozen, type OrderState } from "@/domain/orders";
import { getProductById } from "@/domain/products";
import {
  areaCm2FromMm,
  computeMargin,
  type MarginBreakdown,
  type PricingConfig,
  type PricingLineInput,
} from "@/domain/pricing";
import type {
  InventoryRecord,
  Order,
  Payment,
  PreflightResultRecord,
  ProductionAsset,
  Refund,
  RefundReason,
  Shipment,
} from "@/domain/entities";
import { notifyOrder } from "./notify";

function reconstructPricingLines(order: Order): PricingLineInput[] {
  return order.items.map((item) => {
    const product = getProductById(item.productId);
    return {
      garmentRetailCents: product?.basePriceCents ?? item.unitPriceCents,
      garmentSupplyCents: product?.supplyCostCents ?? 0,
      quantity: item.quantity,
      prints: item.prints.map((p) => ({
        areaCm2: areaCm2FromMm(p.widthMm, p.heightMm),
      })),
    };
  });
}

export async function orderMargin(order: Order): Promise<MarginBreakdown> {
  const config = await getRepo().getPricingConfig();
  return computeMargin(reconstructPricingLines(order), order.breakdown, config);
}

async function restock(order: Order): Promise<void> {
  const repo = getRepo();
  for (const item of order.items) {
    await repo.adjustInventory(item.productId, item.colour, item.size, item.quantity);
  }
}

/** Apply a validated order transition with fulfillment side-effects. */
export async function updateOrderStatus(
  orderId: string,
  to: OrderState,
  note?: string,
): Promise<Order> {
  const repo = getRepo();
  const delivery = getDelivery();
  const order = await repo.getOrder(orderId);
  if (!order) throw notFound("We couldn't find that order.");

  const from = order.status;
  assertTransition(from, to);
  const now = new Date().toISOString();

  // Side-effects.
  if (to === "IN_PRODUCTION") {
    const job = await repo.getProductionJobByOrder(order.id);
    if (job) {
      job.status = "IN_PRODUCTION";
      job.updatedAt = now;
      await repo.saveProductionJob(job);
    }
  }
  if (to === "PACKED") {
    const job = await repo.getProductionJobByOrder(order.id);
    if (job) {
      job.status = "DONE";
      job.updatedAt = now;
      await repo.saveProductionJob(job);
    }
  }
  if (to === "SHIPPED") {
    const created = await delivery.createShipment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      address: order.deliveryAddress,
    });
    const shipment: Shipment = {
      id: newId("ship"),
      orderId: order.id,
      provider: delivery.name,
      status: "IN_TRANSIT",
      trackingNumber: created.trackingNumber,
      trackingUrl: created.trackingUrl,
      createdAt: now,
      updatedAt: now,
    };
    await repo.createShipment(shipment);
    order.shipmentId = shipment.id;
  }
  if (to === "READY_FOR_COLLECTION") {
    const shipment: Shipment = {
      id: newId("ship"),
      orderId: order.id,
      provider: "collection",
      status: "COLLECTION_READY",
      createdAt: now,
      updatedAt: now,
    };
    await repo.createShipment(shipment);
    order.shipmentId = shipment.id;
  }
  if (to === "DELIVERED" && order.shipmentId) {
    const shipment = await repo.getShipment(order.shipmentId);
    if (shipment) {
      shipment.status = "DELIVERED";
      shipment.updatedAt = now;
      await repo.saveShipment(shipment);
    }
  }
  if (to === "CANCELLED" && isFrozen(from)) {
    await restock(order); // return stock taken at payment
  }

  order.status = to;
  order.timeline.push({ state: to, at: now, note });
  order.updatedAt = now;
  await repo.saveOrder(order);

  // Customer notifications for meaningful milestones.
  if (to === "IN_PRODUCTION") await notifyOrder(order, "IN_PRODUCTION");
  if (to === "PACKED") await notifyOrder(order, "PACKED");
  if (to === "SHIPPED") await notifyOrder(order, "SHIPPED");
  if (to === "DELIVERED") await notifyOrder(order, "DELIVERED");

  return order;
}

export interface ProductionQueueEntry {
  readonly order: Order;
  readonly assets: ProductionAsset[];
  readonly jobStatus: string;
  readonly allPassed: boolean;
}

export async function productionQueue(): Promise<ProductionQueueEntry[]> {
  const repo = getRepo();
  const jobs = await repo.listProductionJobs();
  const entries: ProductionQueueEntry[] = [];
  for (const job of jobs) {
    const order = await repo.getOrder(job.orderId);
    if (!order) continue;
    const assets = await repo.listProductionAssetsByOrder(order.id);
    let allPassed = true;
    for (const item of order.items) {
      if (item.preflightResultId) {
        const pf = await repo.getPreflight(item.preflightResultId);
        if (pf && pf.result.result === "FAIL") allPassed = false;
      }
    }
    entries.push({ order, assets, jobStatus: job.status, allPassed });
  }
  return entries;
}

/** Signed download URL for a production file (admin, §26). */
export async function productionDownloadUrl(assetId: string): Promise<string> {
  const repo = getRepo();
  const storage = getStorage();
  const pa = await repo.getProductionAsset(assetId);
  if (!pa) throw notFound("Production file not found.");
  return storage.signedUrl(pa.bucket, pa.storageKey, 900);
}

export interface OrderDetail {
  readonly order: Order;
  readonly margin: MarginBreakdown;
  readonly payment?: Payment;
  readonly shipment?: Shipment;
  readonly productionAssets: ProductionAsset[];
  readonly preflights: Record<string, PreflightResultRecord>;
  readonly refunds: Refund[];
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  const repo = getRepo();
  const order = await repo.getOrder(orderId);
  if (!order) throw notFound("We couldn't find that order.");
  const margin = await orderMargin(order);
  const payment = order.paymentId ? await repo.getPayment(order.paymentId) : undefined;
  const shipment = order.shipmentId ? await repo.getShipment(order.shipmentId) : undefined;
  const productionAssets = await repo.listProductionAssetsByOrder(order.id);
  const preflights: Record<string, PreflightResultRecord> = {};
  for (const item of order.items) {
    if (item.preflightResultId) {
      const pf = await repo.getPreflight(item.preflightResultId);
      if (pf) preflights[item.preflightResultId] = pf;
    }
  }
  const refunds = await repo.listRefunds(order.id);
  return { order, margin, payment, shipment, productionAssets, preflights, refunds };
}

// Inventory (§15)
export async function listInventory(): Promise<InventoryRecord[]> {
  return getRepo().listInventory();
}
export async function setInventoryQty(
  productId: string,
  colour: string,
  size: string,
  quantity: number,
): Promise<void> {
  if (quantity < 0) throw badRequest("Quantity can't be negative.");
  await getRepo().setInventory({ productId, colour, size, quantityAvailable: quantity });
}

// Pricing (§16)
export async function getPricing(): Promise<PricingConfig> {
  return getRepo().getPricingConfig();
}
export async function setPricing(config: PricingConfig): Promise<PricingConfig> {
  return getRepo().setPricingConfig(config);
}

// Refunds (§30)
export async function requestRefund(
  orderId: string,
  amountCents: number,
  reason: RefundReason,
  note?: string,
): Promise<Refund> {
  const repo = getRepo();
  const order = await repo.getOrder(orderId);
  if (!order) throw notFound("We couldn't find that order.");
  assertTransition(order.status, "REFUND_PENDING");
  const now = new Date().toISOString();
  const refund: Refund = {
    id: newId("ref"),
    orderId,
    amountCents,
    reason,
    note,
    status: "REQUESTED",
    createdAt: now,
    updatedAt: now,
  };
  await repo.createRefund(refund);
  order.status = "REFUND_PENDING";
  order.timeline.push({ state: "REFUND_PENDING", at: now, note: `Refund requested: ${reason}` });
  order.updatedAt = now;
  await repo.saveOrder(order);
  return refund;
}

export async function resolveRefund(refundId: string, approve: boolean): Promise<Refund> {
  const repo = getRepo();
  const refunds = await repo.listRefunds();
  const refund = refunds.find((r) => r.id === refundId);
  if (!refund) throw notFound("Refund not found.");
  const order = await repo.getOrder(refund.orderId);
  if (!order) throw notFound("Order not found.");
  const now = new Date().toISOString();

  if (approve) {
    refund.status = "PROCESSED";
    assertTransition(order.status, "REFUNDED");
    order.status = "REFUNDED";
    order.timeline.push({ state: "REFUNDED", at: now });
    await restock(order);
    await notifyOrder(order, "REFUND_PROCESSED");
    await repo.recordEvent({ id: newId("ref"), type: "REFUND", at: now });
  } else {
    refund.status = "REJECTED";
    assertTransition(order.status, "PAID");
    order.status = "PAID";
    order.timeline.push({ state: "PAID", at: now, note: "Refund rejected" });
  }
  refund.updatedAt = now;
  order.updatedAt = now;
  await repo.saveRefund(refund);
  await repo.saveOrder(order);
  return refund;
}

// Analytics (§44)
export interface AnalyticsSummary {
  readonly funnel: Record<string, number>;
  readonly ordersPaid: number;
  readonly revenueCents: number;
  readonly refundRatePercent: number;
}

export async function analyticsSummary(): Promise<AnalyticsSummary> {
  const repo = getRepo();
  const events = await repo.listEvents();
  const funnel: Record<string, number> = {};
  for (const e of events) funnel[e.type] = (funnel[e.type] ?? 0) + 1;

  const orders = await repo.listOrders();
  const paid = orders.filter((o) =>
    ["PAID", "ARTWORK_PROCESSING", "ARTWORK_REVIEW", "PRINT_READY", "IN_PRODUCTION", "PACKED", "READY_FOR_COLLECTION", "SHIPPED", "DELIVERED"].includes(o.status),
  );
  const revenueCents = paid.reduce((s, o) => s + o.breakdown.totalCents, 0);
  const refunded = orders.filter((o) => o.status === "REFUNDED" || o.status === "REFUND_PENDING").length;
  const refundRatePercent = paid.length > 0 ? (refunded / paid.length) * 100 : 0;

  return { funnel, ordersPaid: paid.length, revenueCents, refundRatePercent };
}
