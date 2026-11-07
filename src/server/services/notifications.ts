/**
 * Notification service abstraction (CLAUDE.md §32, §53).
 *
 * - {@link ResendNotificationService}: real transactional email via Resend,
 *   used when RESEND_API_KEY + ONEOFONE_EMAIL_FROM are set (needs a domain).
 * - {@link SmtpNotificationService}: real email over SMTP, e.g. from a Gmail
 *   address with a Google app password (no domain needed). Used when
 *   ONEOFONE_SMTP_USER + ONEOFONE_SMTP_PASSWORD are set.
 * - {@link MockNotificationService}: logs instead of sending (local dev) and
 *   records the message as LOGGED — never claims it was sent (§53).
 *
 * Sending must never throw: a failed email must not break payment/production
 * processing. Failures return status "FAILED" and are recorded.
 */

import nodemailer, { type Transporter } from "nodemailer";
import type { NotificationChannel, NotificationType } from "@/domain/entities";
import {
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  RESEND_API_KEY,
  SMTP_HOST,
  SMTP_PASSWORD,
  SMTP_PORT,
  SMTP_USER,
} from "@/server/env";

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
  send(n: OutboundNotification): Promise<{ status: "SENT" | "FAILED" | "LOGGED" }>;
}

export class MockNotificationService implements NotificationService {
  readonly name = "log-notifier";

  async send(n: OutboundNotification): Promise<{ status: "LOGGED" }> {
    console.info(`[notify:${n.channel}] (not sent — no email service) → ${n.to} · ${n.type} · ${n.subject}`);
    return { status: "LOGGED" };
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
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [n.to],
          subject: n.subject,
          text: n.body,
          ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {}),
        }),
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

/** Display-name-only senders ("OneOfOne") get the SMTP login as the address. */
export function smtpFrom(configured: string, user: string): string {
  const from = configured.trim();
  if (!from) return `OneOfOne <${user}>`;
  return from.includes("@") ? from : `${from.replace(/[<>"]/g, "")} <${user}>`;
}

let smtpTransport: Transporter | undefined;

function transport(): Transporter {
  smtpTransport ??= nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // 465 = TLS from the start; 587 upgrades via STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    // Fail fast: an email must never hold up a payment webhook for long.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return smtpTransport;
}

export class SmtpNotificationService implements NotificationService {
  readonly name = "smtp";

  async send(n: OutboundNotification): Promise<{ status: "SENT" | "FAILED" }> {
    if (n.channel !== "EMAIL") return { status: "FAILED" };
    try {
      await transport().sendMail({
        from: smtpFrom(EMAIL_FROM, SMTP_USER),
        to: n.to,
        replyTo: EMAIL_REPLY_TO || undefined,
        subject: n.subject,
        text: n.body,
      });
      return { status: "SENT" };
    } catch (err) {
      // Log the reason (e.g. bad app password) without the credentials.
      const e = err as { code?: string; responseCode?: number; message?: string };
      console.error(`[notify:smtp] send failed: ${e.code ?? ""} ${e.responseCode ?? ""} ${e.message ?? err}`);
      return { status: "FAILED" };
    }
  }
}
