/**
 * Order notification helper (CLAUDE.md §32).
 *
 * Builds a human message for a notification type, records it, and hands it to
 * the notification service. Centralised so customers get the meaningful
 * milestones once — not a burst of emails per state change (§32, no spam).
 */

import "server-only";
import { getNotifier, getRepo } from "@/server/container";
import { siteUrl } from "@/server/env";
import { newId } from "@/domain/ids";
import type { NotificationType, Order } from "@/domain/entities";

/** Only these reach the customer's inbox; the rest are internal milestones. */
const CUSTOMER_EMAILS: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "ORDER_RECEIVED",
  "ARTWORK_ISSUE",
  "IN_PRODUCTION",
  "SHIPPED",
  "DELIVERED",
  "REFUND_PROCESSED",
]);

const COPY: Record<NotificationType, { subject: (o: Order) => string; body: (o: Order) => string }> = {
  ORDER_RECEIVED: {
    subject: (o) => `Order ${o.orderNumber} confirmed — thank you!`,
    body: (o) =>
      `Hi ${o.customer.name},\n\nYour payment is confirmed and order ${o.orderNumber} is in. We're preparing your print-ready artwork now.`,
  },
  PAYMENT_CONFIRMED: {
    subject: (o) => `Payment confirmed for ${o.orderNumber}`,
    body: (o) => `Payment for order ${o.orderNumber} is confirmed.`,
  },
  ARTWORK_PROCESSING: {
    subject: (o) => `Preparing artwork for ${o.orderNumber}`,
    body: (o) => `We're generating the print-ready files for order ${o.orderNumber}.`,
  },
  ARTWORK_ISSUE: {
    subject: (o) => `Quick check needed on order ${o.orderNumber}`,
    body: (o) =>
      `Hi ${o.customer.name},\n\nAn item on order ${o.orderNumber} needs a quick review before we print it, to make sure it comes out well. We'll be in touch shortly.`,
  },
  IN_PRODUCTION: {
    subject: (o) => `Order ${o.orderNumber} is being printed`,
    body: (o) => `Good news — order ${o.orderNumber} is now on the press.`,
  },
  PACKED: {
    subject: (o) => `Order ${o.orderNumber} is packed`,
    body: (o) => `Order ${o.orderNumber} is packed and ready to go.`,
  },
  SHIPPED: {
    subject: (o) => `Order ${o.orderNumber} is on its way`,
    body: (o) => `Order ${o.orderNumber} has shipped. Your tracking details are on your order page.`,
  },
  DELIVERED: {
    subject: (o) => `Order ${o.orderNumber} delivered`,
    body: (o) => `Order ${o.orderNumber} has been delivered. Enjoy it!`,
  },
  REFUND_PROCESSED: {
    subject: (o) => `Refund processed for ${o.orderNumber}`,
    body: (o) => `A refund for order ${o.orderNumber} has been processed.`,
  },
};

function withFooter(order: Order, body: string): string {
  return `${body}\n\nView your order: ${siteUrl()}/orders/${order.id}\n\nQuestions? Reply to this email or visit ${siteUrl()}/support\n\n— OneOfOne`;
}

export async function notifyOrder(order: Order, type: NotificationType): Promise<void> {
  if (!CUSTOMER_EMAILS.has(type)) return;
  const repo = getRepo();
  const notifier = getNotifier();
  const copy = COPY[type];
  const subject = copy.subject(order);
  const body = withFooter(order, copy.body(order));
  const { status } = await notifier.send({
    to: order.customer.email,
    channel: "EMAIL",
    type,
    subject,
    body,
    orderId: order.id,
  });
  await repo.addNotification({
    id: newId("ntf"),
    to: order.customer.email,
    channel: "EMAIL",
    type,
    orderId: order.id,
    subject,
    body,
    status,
    createdAt: new Date().toISOString(),
  });
}
