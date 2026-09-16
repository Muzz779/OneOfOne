/**
 * Notification service abstraction (CLAUDE.md §32, §53).
 *
 * Dev implementation records + logs notifications rather than sending real
 * email/SMS. Swap in an email/SMS provider adapter in production. Callers persist
 * a Notification record via the repo; this service simulates delivery.
 */

import type { NotificationChannel, NotificationType } from "@/domain/entities";

export interface OutboundNotification {
  readonly to: string;
  readonly channel: NotificationChannel;
  readonly type: NotificationType;
  readonly subject: string;
  readonly body: string;
  readonly orderId?: string;
}

export interface NotificationService {
  readonly name: string;
  send(n: OutboundNotification): Promise<{ status: "SENT" | "FAILED" }>;
}

export class MockNotificationService implements NotificationService {
  readonly name = "log-notifier";

  async send(n: OutboundNotification): Promise<{ status: "SENT" }> {
    // Development: log instead of sending. Do not spam customers (§32) — callers
    // gate which events fire.
    console.info(
      `[notify:${n.channel}] → ${n.to} · ${n.type} · ${n.subject}`,
    );
    return { status: "SENT" };
  }
}
