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
  return handlePaymentWebhook(body, signature);
}

export async function handlePaymentWebhook(
  rawBody: string,
  signature: string | null,
): Promise<WebhookOutcome> {
  const provider = getPayment();
  const repo = getRepo();

  if (!signature || !provider.verifyWebhookSignature(rawBody, signature)) {
    return { ok: false, reason: "invalid_signature" };
  }

  const event = provider.parseWebhook(rawBody);
  if (!event.eventId) return { ok: false, reason: "missing_event_id" };

  // Idempotency — a duplicate webhook is a no-op success (§19).
  if (await repo.isEventHandled(event.eventId)) {
    return { ok: true, duplicate: true };
  }

  const payment = await repo.getPaymentByProviderRef(event.providerRef);
  if (!payment) return { ok: false, reason: "unknown_payment" };
  const order = await repo.getOrder(payment.orderId);
  if (!order) return { ok: false, reason: "unknown_order" };

  const now = new Date().toISOString();

  if (event.status === "SUCCEEDED") {
    // §40 — verify the amount server-side; never trust the reported total blindly.
    if (event.amountCents !== order.breakdown.totalCents) {
      payment.status = "FAILED";
      payment.events.push({ at: now, type: "amount_mismatch", note: `${event.amountCents} != ${order.breakdown.totalCents}` });
      await repo.savePayment(payment);
      await repo.markEventHandled(event.eventId);
      return { ok: false, reason: "amount_mismatch" };
    }

    // Only advance if still awaiting payment (defends against races).
    if (order.status === "PENDING_PAYMENT") {
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
