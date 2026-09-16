/**
 * Checkout use-case (CLAUDE.md §15, §18, §19, §40).
 *
 * Validates inventory, computes the price SERVER-SIDE, creates the order in
 * DRAFT → PENDING_PAYMENT, and opens a payment with the provider. Inventory is
 * only decremented after verified payment (§15) — done in the webhook handler.
 */

import "server-only";
import { getDelivery, getPayment, getRepo } from "@/server/container";
import { badRequest, conflict, notFound } from "@/server/errors";
import { formatOrderNumber, newId } from "@/domain/ids";
import { assertTransition } from "@/domain/orders";
import type {
  CustomerDetails,
  DeliveryAddress,
  Order,
  OrderItem,
  Payment,
} from "@/domain/entities";
import type { DeliveryMethod } from "@/domain/pricing";
import { quoteCart } from "./pricing";

export interface CreateOrderInput {
  readonly cartId: string;
  readonly customer: CustomerDetails;
  readonly deliveryMethod: DeliveryMethod;
  readonly deliveryAddress?: DeliveryAddress;
}

export interface CreateOrderResult {
  readonly order: Order;
  readonly redirectUrl: string;
}

function validEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const repo = getRepo();
  const payment = getPayment();
  const delivery = getDelivery();

  const { name, email, phone } = input.customer;
  if (!name?.trim()) throw badRequest("Please enter your name.");
  if (!validEmail(email)) throw badRequest("Please enter a valid email address.");
  if (!phone?.trim()) throw badRequest("Please enter a contact number.");
  if (input.deliveryMethod === "PUDO" && !input.deliveryAddress) {
    throw badRequest("Please provide a delivery address or choose collection.");
  }

  const cart = await repo.getCart(input.cartId);
  if (!cart) throw notFound("We couldn't find your cart.");
  if (cart.items.length === 0) throw badRequest("Your cart is empty.");

  // §15 — validate inventory server-side before taking payment.
  for (const item of cart.items) {
    const inv = await repo.getInventory(item.productId, item.colour, item.size);
    if (!inv || inv.quantityAvailable < item.quantity) {
      throw conflict(
        `Sorry, ${item.colour} / ${item.size} is out of stock or low. Please adjust your cart.`,
      );
    }
  }

  const { breakdown, lines } = await quoteCart(cart, input.deliveryMethod);
  if (lines.length === 0) throw badRequest("Your cart items are no longer available.");

  const items: OrderItem[] = lines.map((line, i) => ({
    id: newId("oi"),
    designId: line.design.id,
    productId: line.productId,
    productName: line.productName,
    colour: line.colour,
    size: line.size,
    quantity: line.quantity,
    prints: [line.print],
    unitPriceCents: breakdown.lines[i].unitPriceCents,
  }));

  const seq = await repo.nextOrderSeq();
  const now = new Date().toISOString();
  const order: Order = {
    id: newId("ord"),
    orderNumber: formatOrderNumber(seq),
    userId: cart.userId,
    customer: input.customer,
    deliveryMethod: input.deliveryMethod,
    deliveryAddress: input.deliveryAddress,
    items,
    breakdown,
    status: "DRAFT",
    timeline: [{ state: "DRAFT", at: now }],
    createdAt: now,
    updatedAt: now,
  };
  assertTransition(order.status, "PENDING_PAYMENT");
  order.status = "PENDING_PAYMENT";
  order.timeline.push({ state: "PENDING_PAYMENT", at: now });

  // Quote delivery (records the courier's fee intent).
  await delivery.quote({ method: input.deliveryMethod, address: input.deliveryAddress });

  // Open payment with the provider (§19).
  const checkout = await payment.createCheckout({
    orderId: order.id,
    amountCents: breakdown.totalCents,
    currency: "ZAR",
    idempotencyKey: order.id,
  });
  const paymentRecord: Payment = {
    id: newId("pay"),
    orderId: order.id,
    provider: payment.name,
    amountCents: breakdown.totalCents,
    currency: "ZAR",
    status: "CREATED",
    providerRef: checkout.providerRef,
    idempotencyKey: order.id,
    events: [{ at: now, type: "checkout.created" }],
    createdAt: now,
    updatedAt: now,
  };
  await repo.createPayment(paymentRecord);
  order.paymentId = paymentRecord.id;

  await repo.createOrder(order);
  await repo.recordEvent({
    id: newId("ord"),
    type: "CHECKOUT_STARTED",
    at: now,
    props: { total: breakdown.totalCents, items: items.length },
  });

  return { order, redirectUrl: checkout.redirectUrl };
}
