/**
 * Order notification helper (CLAUDE.md §32).
 *
 * Builds a human message for a notification type, records it, and hands it to
 * the notification service. Centralised so we send the right events once and
 * don't spam customers.
 */

import "server-only";
import { getNotifier, getRepo } from "@/server/container";
import { newId } from "@/domain/ids";
import type { NotificationType, Order } from "@/domain/entities";

const COPY: Record<NotificationType, { subject: string; body: (o: Order) => string }> = {
  ORDER_RECEIVED: {
    subject: "We've got your order",
    body: (o) => `Thanks ${o.customer.name}! Order ${o.orderNumber} has been received.`,
  },
  PAYMENT_CONFIRMED: {
    subject: "Payment confirmed",
    body: (o) => `Payment for order ${o.orderNumber} is confirmed. We're preparing your artwork.`,
  },
  ARTWORK_PROCESSING: {
    subject: "Preparing your artwork",
    body: (o) => `We're generating the print-ready files for order ${o.orderNumber}.`,
  },
  ARTWORK_ISSUE: {
    subject: "We need to check your artwork",
    body: (o) => `An item on order ${o.orderNumber} needs a quick review before printing. We'll be in touch.`,
  },
  IN_PRODUCTION: {
    subject: "Your order is being printed",
    body: (o) => `Order ${o.orderNumber} is now in production.`,
  },
  PACKED: {
    subject: "Your order is packed",
    body: (o) => `Order ${o.orderNumber} is packed and ready to go.`,
  },
  SHIPPED: {
    subject: "Your order is on its way",
    body: (o) => `Order ${o.orderNumber} has shipped.`,
  },
  DELIVERED: {
    subject: "Delivered",
    body: (o) => `Order ${o.orderNumber} has been delivered. Enjoy!`,
  },
  REFUND_PROCESSED: {
    subject: "Refund processed",
    body: (o) => `A refund for order ${o.orderNumber} has been processed.`,
  },
};

export async function notifyOrder(order: Order, type: NotificationType): Promise<void> {
  const repo = getRepo();
  const notifier = getNotifier();
  const copy = COPY[type];
  const { status } = await notifier.send({
    to: order.customer.email,
    channel: "EMAIL",
    type,
    subject: copy.subject,
    body: copy.body(order),
    orderId: order.id,
  });
  await repo.addNotification({
    id: newId("ntf"),
    to: order.customer.email,
    channel: "EMAIL",
    type,
    orderId: order.id,
    subject: copy.subject,
    body: copy.body(order),
    status,
    createdAt: new Date().toISOString(),
  });
}
