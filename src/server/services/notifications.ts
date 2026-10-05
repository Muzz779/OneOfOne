/**
 * Notification service abstraction (CLAUDE.md §32, §53).
 *
 * - {@link ResendNotificationService}: real transactional email via Resend,
 *   used when RESEND_API_KEY + ONEOFONE_EMAIL_FROM are set.
 * - {@link MockNotificationService}: logs instead of sending (local dev).
 *
 * Sending must never throw: a failed email must not break payment/production
 * processing. Failures return status "FAILED" and are recorded.
 */

import type { NotificationChannel, NotificationType } from "@/domain/entities";
import { EMAIL_FROM, RESEND_API_KEY } from "@/server/env";

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
    console.info(`[notify:${n.channel}] → ${n.to} · ${n.type} · ${n.subject}`);
    return { status: "SENT" };
  }
}

export class ResendNotificationService implements NotificationService {
  readonly name = "resend";

  async send(n: OutboundNotification): Promise<{ status: "SENT" | "FAILED" }> {
    if (n.channel !== "EMAIL") return { status: "FAILED" };
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: EMAIL_FROM, to: [n.to], subject: n.subject, text: n.body }),
      });
      if (!res.ok) {
        console.error(`[notify:resend] ${res.status} ${await res.text().catch(() => "")}`);
        return { status: "FAILED" };
      }
      return { status: "SENT" };
    } catch (err) {
      console.error("[notify:resend] send failed", err);
      return { status: "FAILED" };
    }
  }
}
