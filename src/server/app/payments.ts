/**
 * Payment webhook handling (CLAUDE.md §19, §15, §40).
 *
 * Server-side confirmation only: verify the signature, guard against duplicate
 * events (idempotency), verify the amount matches the order, then transition the
 * order to PAID, decrement inventory, notify, and kick off production. Never
 * trusts a client success screen.
 */

import "server-only";
import { getPayment, getRepo } from "@/server/container";
import type { ParsedWebhook } from "@/server/services/payment";
import { newId } from "@/domain/ids";
import { assertTransition } from "@/domain/orders";
import { notifyOrder } from "./notify";
import { runProductionForOrder } from "./production";

export interface WebhookOutcome {
  readonly ok: boolean;
  readonly duplicate?: boolean;
  readonly reason?: string;
}

/**
 * Drive the mock hosted-payment page: build the payload the gateway WOULD send,
 * sign it with the provider's secret, and run it through the real webhook path
 * (signature verification + idempotency). Success/failure is chosen by the
 * simulated customer — this is a clearly-marked dev-only shortcut (§53).
 */
export async function simulateProviderWebhook(
  orderId: string,
  success: boolean,
): Promise<WebhookOutcome> {
  const provider = getPayment();
  const repo = getRepo();
  const order = await repo.getOrder(orderId);
  if (!order) return { ok: false, reason: "unknown_order" };
  const payment = order.paymentId ? await repo.getPayment(order.paymentId) : undefined;
  if (!payment?.providerRef) return { ok: false, reason: "no_payment" };

  const body = JSON.stringify({
    type: success ? "payment.succeeded" : "payment.failed",
    providerRef: payment.providerRef,
    orderId: order.id,
    status: success ? "SUCCEEDED" : "FAILED",
    amountCents: order.breakdown.totalCents,
    eventId: newId("pay"),
  });
  const signature = provider.signPayload(body);
  const headers = new Headers({ "x-oneofone-signature": signature });
  return handlePaymentWebhook(body, headers);
}

export async function handlePaymentWebhook(
  rawBody: string,
  headers: Headers,
): Promise<WebhookOutcome> {
  const provider = getPayment();

  if (!provider.verifyWebhookSignature(rawBody, headers)) {
    return { ok: false, reason: "invalid_signature" };
  }

  return applyPaymentEvent(provider.parseWebhook(rawBody));
}

/**
 * Called when the customer lands back from the hosted payment page. Asks the
 * provider directly (server-to-server, so it can be trusted) whether the
 * payment succeeded, and applies it through the same path as a webhook. The
 * redirect itself is never treated as proof of payment (§19).
 */
export async function reconcilePaymentOnReturn(orderId: string): Promise<WebhookOutcome> {
  const provider = getPayment();
  if (!provider.verifyPayment) return { ok: true, reason: "not_supported" };
  const repo = getRepo();
  const order = await repo.getOrder(orderId);
  if (!order || order.status !== "PENDING_PAYMENT" || !order.paymentId) return { ok: true };
  const payment = await repo.getPayment(order.paymentId);
  if (!payment?.providerRef || payment.provider !== provider.name) return { ok: true };

  const event = await provider.verifyPayment(payment.providerRef);
  if (!event) return { ok: true, reason: "not_paid" };
  return applyPaymentEvent({ ...event, orderId: event.orderId || order.id });
}

async function applyPaymentEvent(event: ParsedWebhook): Promise<WebhookOutcome> {
  const repo = getRepo();
  if (!event.eventId) {
    // Events we don't act on (no id, not a payment result) are acknowledged so
    // the provider doesn't keep retrying them.
    return event.status === "PENDING" ? { ok: true, reason: "ignored" } : { ok: false, reason: "missing_event_id" };
  }

  // Idempotency — a duplicate webhook is a no-op success (§19).
  if (await repo.isEventHandled(event.eventId)) {
    return { ok: true, duplicate: true };
  }

  // Resolve the order (Paystack/Yoco carry orderId in metadata; mock in the body),
  // then its payment. Fall back to the provider reference.
  let order = event.orderId ? await repo.getOrder(event.orderId) : undefined;
  let payment = order?.paymentId ? await repo.getPayment(order.paymentId) : undefined;
  if (!payment && event.providerRef) {
    payment = await repo.getPaymentByProviderRef(event.providerRef);
    if (payment && !order) order = await repo.getOrder(payment.orderId);
  }
  if (!payment || !order) {
    // Ack events that aren't payment results so the provider stops retrying.
    return event.status === "PENDING" ? { ok: true, reason: "ignored" } : { ok: false, reason: "unknown_payment" };
  }

  const now = new Date().toISOString();

  if (event.status === "SUCCEEDED") {
    // §40 — verify the amount server-side; never trust the reported total blindly.
    const currencyOk = !event.currency || event.currency.toUpperCase() === payment.currency;
    if (event.amountCents !== order.breakdown.totalCents || !currencyOk) {
      payment.status = "FAILED";
      payment.events.push({
        at: now,
        type: "amount_mismatch",
        note: `${event.amountCents} ${event.currency ?? ""} != ${order.breakdown.totalCents} ${payment.currency}`,
      });
      await repo.savePayment(payment);
      await repo.markEventHandled(event.eventId);
      return { ok: false, reason: "amount_mismatch" };
    }

    // Only advance if still awaiting payment, and only once: the webhook and the
    // customer's return can arrive together, so take an atomic per-order lock.
    if (order.status === "PENDING_PAYMENT" && (await repo.claimEvent(`paid:${order.id}`))) {
      payment.status = "SUCCEEDED";
      payment.events.push({ at: now, type: "payment.succeeded" });
      await repo.savePayment(payment);

      assertTransition(order.status, "PAID");
      order.status = "PAID";
      order.timeline.push({ state: "PAID", at: now });
      order.updatedAt = now;
      await repo.saveOrder(order);

      // §15 — decrement inventory only after verified payment.
      for (const item of order.items) {
        await repo.adjustInventory(item.productId, item.colour, item.size, -item.quantity);
      }

      // Remove the purchased items from the customer's cart (kept until now so
      // a cancelled payment could be retried).
      if (order.cartId && order.cartItemIds?.length) {
        const cart = await repo.getCart(order.cartId);
        if (cart) {
          const bought = new Set(order.cartItemIds);
          cart.items = cart.items.filter((i) => !bought.has(i.id));
          cart.updatedAt = now;
          await repo.saveCart(cart);
        }
      }

      await notifyOrder(order, "PAYMENT_CONFIRMED");
      await notifyOrder(order, "ORDER_RECEIVED");
      await repo.recordEvent({ id: newId("pay"), type: "PAYMENT_SUCCESS", at: now, props: { total: order.breakdown.totalCents } });

      // Generate production artwork + preflight (§21).
      await runProductionForOrder(order);
      await repo.recordEvent({ id: newId("ord"), type: "ORDER_COMPLETED", at: new Date().toISOString() });
    }
    await repo.markEventHandled(event.eventId);
    return { ok: true };
  }

  if (event.status === "FAILED") {
    payment.status = "FAILED";
    payment.events.push({ at: now, type: "payment.failed" });
    await repo.savePayment(payment);
    if (order.status === "PENDING_PAYMENT") {
      assertTransition(order.status, "FAILED");
      order.status = "FAILED";
      order.timeline.push({ state: "FAILED", at: now });
      order.updatedAt = now;
      await repo.saveOrder(order);
    }
    await repo.markEventHandled(event.eventId);
    return { ok: true };
  }

  await repo.markEventHandled(event.eventId);
  return { ok: true };
}
