/**
 * Core entity model (CLAUDE.md §38, §4, §22, §39).
 *
 * Persistence-agnostic types shared by the repository and services. Money is
 * integer ZAR cents; timestamps are ISO-8601 strings. These separate the four
 * artwork asset kinds (§4) and never collapse everything into one orders table.
 */

import type { Placement } from "@/lib/print/placement";
import type { ImageFacts } from "@/lib/print/analysis";
import type { PrintSide } from "./products";
import type { OrderState } from "./orders";
import type { DeliveryMethod, PriceBreakdown } from "./pricing";
import type { PreflightResult } from "@/lib/print/preflight";

export type Iso = string;

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name?: string;
  readonly createdAt: Iso;
}

export type AdminRole = "OWNER" | "STAFF";

export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: AdminRole;
  readonly createdAt: Iso;
}

/** Inventory tracked by product + colour + size (§15). */
export interface InventoryRecord {
  readonly productId: string;
  readonly colour: string;
  readonly size: string;
  quantityAvailable: number;
}

export function variantKey(productId: string, colour: string, size: string): string {
  return `${productId}::${colour}::${size}`;
}

/** The four asset kinds (§4) plus intermediate processing outputs. */
export type AssetKind =
  | "ORIGINAL"
  | "WORKING"
  | "ENHANCED"
  | "BG_REMOVED"
  | "PRODUCTION"
  | "MOCKUP";

/** Logical storage buckets (§37). */
export type StorageBucket =
  | "originals"
  | "working"
  | "production"
  | "mockups"
  | "exports";

export interface DesignAsset {
  readonly id: string;
  readonly designId: string;
  readonly kind: AssetKind;
  readonly bucket: StorageBucket;
  readonly storageKey: string;
  readonly format: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly bytes: number;
  /** Content hash for dedup / cache reuse (§42, §43). */
  readonly hash: string;
  readonly createdAt: Iso;
}

export type DesignStatus = "DRAFT" | "READY";

export interface Design {
  readonly id: string;
  userId?: string;
  productId: string;
  side: PrintSide;
  colour: string;
  size: string;
  placement: Placement;
  /** Facts of the artwork currently driving the editor (original or processed). */
  facts: ImageFacts;
  status: DesignStatus;
  version: number;
  originalAssetId: string;
  workingAssetId?: string;
  enhancedAssetId?: string;
  bgRemovedAssetId?: string;
  productionAssetId?: string;
  mockupAssetId?: string;
  /** Opt-in public share token (§48); absent = private. */
  shareToken?: string;
  readonly createdAt: Iso;
  updatedAt: Iso;
}

export interface CartItem {
  readonly id: string;
  designId: string;
  productId: string;
  colour: string;
  size: string;
  quantity: number;
}

export interface Cart {
  readonly id: string;
  userId?: string;
  items: CartItem[];
  readonly createdAt: Iso;
  updatedAt: Iso;
}

export interface CustomerDetails {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
}

export interface DeliveryAddress {
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly province: string;
  readonly postalCode: string;
  /** For PUDO locker selection. */
  readonly pudoPointId?: string;
  readonly pudoPointName?: string;
}

/** A printed side within an order item, with its physical size. */
export interface OrderPrint {
  readonly side: PrintSide;
  readonly widthMm: number;
  readonly heightMm: number;
}

export interface OrderItem {
  readonly id: string;
  readonly designId: string;
  readonly productId: string;
  readonly productName: string;
  readonly colour: string;
  readonly size: string;
  readonly quantity: number;
  readonly prints: readonly OrderPrint[];
  readonly unitPriceCents: number;
  productionAssetId?: string;
  preflightResultId?: string;
}

export interface OrderTimelineEntry {
  readonly state: OrderState;
  readonly at: Iso;
  readonly note?: string;
}

export interface Order {
  readonly id: string;
  readonly orderNumber: string;
  userId?: string;
  customer: CustomerDetails;
  deliveryMethod: DeliveryMethod;
  deliveryAddress?: DeliveryAddress;
  items: OrderItem[];
  breakdown: PriceBreakdown;
  status: OrderState;
  timeline: OrderTimelineEntry[];
  paymentId?: string;
  shipmentId?: string;
  readonly createdAt: Iso;
  updatedAt: Iso;
}

export type PaymentStatus = "CREATED" | "PENDING" | "SUCCEEDED" | "FAILED";

export interface PaymentEvent {
  readonly at: Iso;
  readonly type: string;
  readonly note?: string;
}

export interface Payment {
  readonly id: string;
  readonly orderId: string;
  readonly provider: string;
  amountCents: number;
  readonly currency: string;
  status: PaymentStatus;
  providerRef?: string;
  /** For idempotent webhook handling (§19). */
  idempotencyKey?: string;
  events: PaymentEvent[];
  readonly createdAt: Iso;
  updatedAt: Iso;
}

export type ShipmentStatus =
  | "PENDING"
  | "COLLECTION_READY"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "FAILED";

export interface Shipment {
  readonly id: string;
  readonly orderId: string;
  readonly provider: string;
  status: ShipmentStatus;
  trackingNumber?: string;
  trackingUrl?: string;
  readonly createdAt: Iso;
  updatedAt: Iso;
}

/** Immutable production artwork record (§22). */
export interface ProductionAsset {
  readonly id: string;
  readonly orderId: string;
  readonly orderItemId: string;
  readonly designId: string;
  readonly version: number;
  readonly productName: string;
  readonly colour: string;
  readonly size: string;
  readonly side: PrintSide;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly dpi: number;
  readonly format: string;
  readonly bucket: StorageBucket;
  readonly storageKey: string;
  readonly bytes: number;
  readonly preflightResultId: string;
  readonly createdAt: Iso;
}

export type ProductionJobStatus =
  | "QUEUED"
  | "IN_PRODUCTION"
  | "DONE"
  | "FAILED";

export interface ProductionJob {
  readonly id: string;
  readonly orderId: string;
  status: ProductionJobStatus;
  readonly createdAt: Iso;
  updatedAt: Iso;
}

export interface PreflightResultRecord {
  readonly id: string;
  readonly result: PreflightResult;
  readonly createdAt: Iso;
}

export type RefundReason =
  | "WRONG_SIZE"
  | "CUSTOMER_ARTWORK_ERROR"
  | "PRINTER_DEFECT"
  | "DAMAGED"
  | "WRONG_ITEM"
  | "LOST_SHIPMENT"
  | "CUSTOMER_CANCELLATION"
  | "OTHER";

export type RefundStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "PROCESSED";

export interface Refund {
  readonly id: string;
  readonly orderId: string;
  amountCents: number;
  reason: RefundReason;
  note?: string;
  status: RefundStatus;
  readonly createdAt: Iso;
  updatedAt: Iso;
}

export type NotificationChannel = "EMAIL" | "SMS";
export type NotificationType =
  | "ORDER_RECEIVED"
  | "PAYMENT_CONFIRMED"
  | "ARTWORK_PROCESSING"
  | "ARTWORK_ISSUE"
  | "IN_PRODUCTION"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "REFUND_PROCESSED";

export interface Notification {
  readonly id: string;
  readonly to: string;
  readonly channel: NotificationChannel;
  readonly type: NotificationType;
  readonly orderId?: string;
  readonly subject: string;
  readonly body: string;
  status: "QUEUED" | "SENT" | "FAILED";
  readonly createdAt: Iso;
}
