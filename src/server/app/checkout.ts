/**
 * Checkout use-case (CLAUDE.md §15, §18, §19, §40).
 *
 * Validates inventory, computes the price SERVER-SIDE, creates the order in
 * DRAFT → PENDING_PAYMENT, and opens a payment with the provider. Inventory is
 * only decremented after verified payment (§15) — done in the webhook handler.
 */

import "server-only";
import { getDelivery, getPayment, getRepo } from "@/server/container";
import {
  availablePaymentMethods,
  isEftConfigured,
  mockPaymentsAllowed,
  siteUrl,
  type PaymentMethodId,
} from "@/server/env";
import { getCurrentUser } from "@/server/session";
import { badRequest, conflict, notFound } from "@/server/errors";
import { formatOrderNumber, newId } from "@/domain/ids";
import { assertTransition } from "@/domain/orders";
import { EFT_PROVIDER, eftReference } from "@/domain/payments";
import { notifyOrder } from "./notify";
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
  /** "card" (hosted gateway) or "eft" (bank transfer confirmed by the owner). */
  readonly paymentMethod?: PaymentMethodId;
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

  const method: PaymentMethodId = input.paymentMethod ?? "card";
  if (method === "eft" && !isEftConfigured()) {
    throw badRequest("Bank transfer isn't available right now. Please choose another way to pay.");
  }
  // §19/§53 — never let the mock gateway take "payments" on a live store.
  if (method === "card" && payment.name === "yoco-mock" && !mockPaymentsAllowed()) {
    throw conflict(
      availablePaymentMethods().includes("eft")
        ? "Card payments aren't switched on yet. Please choose bank transfer (EFT)."
        : "Online payments aren't switched on yet. Please check back soon.",
    );
  }

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
    prints: line.prints.map((p) => ({ ...p })),
    unitPriceCents: breakdown.lines[i].unitPriceCents,
  }));

  const seq = await repo.nextOrderSeq();
  const now = new Date().toISOString();
  const currentUser = await getCurrentUser();
  const order: Order = {
    id: newId("ord"),
    orderNumber: formatOrderNumber(seq),
    userId: currentUser?.id ?? cart.userId,
    customer: input.customer,
    deliveryMethod: input.deliveryMethod,
    deliveryAddress: input.deliveryAddress,
    items,
    breakdown,
    status: "DRAFT",
    timeline: [{ state: "DRAFT", at: now }],
    cartId: cart.id,
    cartItemIds: lines.map((l) => l.cartItemId),
    createdAt: now,
    updatedAt: now,
  };
  assertTransition(order.status, "PENDING_PAYMENT");
  order.status = "PENDING_PAYMENT";
  order.timeline.push({ state: "PENDING_PAYMENT", at: now });

  // Quote delivery (records the courier's fee intent).
  await delivery.quote({ method: input.deliveryMethod, address: input.deliveryAddress });

  // Open payment (§19): a hosted gateway for cards, or bank-transfer details
  // that the owner confirms in admin once the money is in the account.
  let opened: { provider: string; providerRef: string; redirectUrl: string; event: string };
  if (method === "eft") {
    opened = {
      provider: EFT_PROVIDER,
      providerRef: eftReference(order.orderNumber),
      redirectUrl: `/orders/${order.id}`,
      event: "eft.awaiting_transfer",
    };
  } else {
    const base = siteUrl();
    const checkout = await payment.createCheckout({
      orderId: order.id,
      amountCents: breakdown.totalCents,
      currency: "ZAR",
      idempotencyKey: order.id,
      customerEmail: email,
      successUrl: `${base}/api/payments/return?order=${order.id}`,
      cancelUrl: `${base}/checkout`,
      failureUrl: `${base}/api/payments/return?order=${order.id}`,
    });
    opened = {
      provider: payment.name,
      providerRef: checkout.providerRef,
      redirectUrl: checkout.redirectUrl,
      event: "checkout.created",
    };
  }
  const paymentRecord: Payment = {
    id: newId("pay"),
    orderId: order.id,
    provider: opened.provider,
    amountCents: breakdown.totalCents,
    currency: "ZAR",
    status: method === "eft" ? "PENDING" : "CREATED",
    providerRef: opened.providerRef,
    idempotencyKey: order.id,
    events: [{ at: now, type: opened.event }],
    createdAt: now,
    updatedAt: now,
  };
  await repo.createPayment(paymentRecord);
  order.paymentId = paymentRecord.id;

  await repo.createOrder(order);
  if (method === "eft") {
    // The customer has committed to paying by transfer, so take the items out
    // of the cart now (no accidental second order) and email the bank details.
    const ordered = new Set(order.cartItemIds);
    cart.items = cart.items.filter((i) => !ordered.has(i.id));
    cart.updatedAt = now;
    await repo.saveCart(cart);
    await notifyOrder(order, "PAYMENT_INSTRUCTIONS");
  }
  // For cards the cart is NOT cleared here: if the customer cancels on the
  // payment page they can retry. Ordered items are removed once payment is
  // confirmed.

  await repo.recordEvent({
    id: newId("ord"),
    type: "CHECKOUT_STARTED",
    at: now,
    props: { total: breakdown.totalCents, items: items.length },
  });

  return { order, redirectUrl: opened.redirectUrl };
}
