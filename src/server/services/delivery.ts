/**
 * Delivery service abstraction (CLAUDE.md §31, §53).
 *
 * PUDO is the intended courier; delivery is abstracted so the order system is
 * never coupled to one provider. Until a PUDO API integration exists, shipments
 * are booked by the owner in PUDO and the REAL tracking number is entered in
 * admin — we never invent tracking numbers (§53 "no fake tracking").
 */

import type { DeliveryAddress } from "@/domain/entities";
import type { DeliveryMethod } from "@/domain/pricing";
import { badRequest } from "@/server/errors";

export interface DeliveryQuote {
  readonly feeCents: number;
  readonly etaDays: number;
  readonly method: DeliveryMethod;
}

export interface CreatedShipment {
  readonly trackingNumber: string;
  readonly trackingUrl?: string;
  readonly status: "PENDING";
}

export interface CreateShipmentInput {
  orderId: string;
  orderNumber: string;
  address?: DeliveryAddress;
  /** Courier tracking number, entered by the owner after booking. */
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface DeliveryService {
  readonly name: string;
  quote(input: { method: DeliveryMethod; address?: DeliveryAddress }): Promise<DeliveryQuote>;
  createShipment(input: CreateShipmentInput): Promise<CreatedShipment>;
}

/** Manual PUDO: the owner books the parcel in PUDO and records its tracking. */
export class ManualPudoDelivery implements DeliveryService {
  readonly name = "pudo";

  async quote(input: { method: DeliveryMethod }): Promise<DeliveryQuote> {
    if (input.method === "COLLECTION") return { feeCents: 0, etaDays: 0, method: "COLLECTION" };
    return { feeCents: 6000, etaDays: 3, method: "PUDO" };
  }

  async createShipment(input: CreateShipmentInput): Promise<CreatedShipment> {
    const trackingNumber = input.trackingNumber?.trim();
    if (!trackingNumber) {
      throw badRequest("Enter the PUDO tracking number before marking the order as shipped.");
    }
    const url = input.trackingUrl?.trim();
    if (url && !/^https:\/\//i.test(url)) {
      throw badRequest("The tracking link must start with https://");
    }
    return { trackingNumber, trackingUrl: url || undefined, status: "PENDING" };
  }
}
