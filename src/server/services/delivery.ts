/**
 * Delivery service abstraction (CLAUDE.md §31, §53).
 *
 * PUDO is the intended provider; delivery is abstracted so the order system is
 * never coupled to one courier. This is a clearly-marked mock: it quotes the
 * configured fee and issues a mock tracking number/URL.
 */

import type { DeliveryAddress } from "@/domain/entities";
import type { DeliveryMethod } from "@/domain/pricing";

export interface DeliveryQuote {
  readonly feeCents: number;
  readonly etaDays: number;
  readonly method: DeliveryMethod;
}

export interface CreatedShipment {
  readonly trackingNumber: string;
  readonly trackingUrl: string;
  readonly status: "PENDING";
}

export interface DeliveryService {
  readonly name: string;
  quote(input: {
    method: DeliveryMethod;
    address?: DeliveryAddress;
  }): Promise<DeliveryQuote>;
  createShipment(input: {
    orderId: string;
    orderNumber: string;
    address?: DeliveryAddress;
  }): Promise<CreatedShipment>;
}

export class MockPudoDelivery implements DeliveryService {
  readonly name = "pudo-mock";

  async quote(input: {
    method: DeliveryMethod;
    address?: DeliveryAddress;
  }): Promise<DeliveryQuote> {
    if (input.method === "COLLECTION") {
      return { feeCents: 0, etaDays: 0, method: "COLLECTION" };
    }
    return { feeCents: 6000, etaDays: 3, method: "PUDO" };
  }

  async createShipment(input: {
    orderId: string;
    orderNumber: string;
  }): Promise<CreatedShipment> {
    const tracking = `PUDO${input.orderNumber.replace("#", "")}${Math.floor(
      Math.random() * 900 + 100,
    )}`;
    return {
      trackingNumber: tracking,
      trackingUrl: `/track/${tracking}`,
      status: "PENDING",
    };
  }
}
