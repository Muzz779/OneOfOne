/**
 * Payment provider abstraction (CLAUDE.md §19, §40, §53).
 *
 * Yoco is the intended provider; this is a mock-first implementation behind the
 * interface. Payment confirmation happens SERVER-SIDE via a signed webhook with
 * real HMAC signature verification — the mock hosted-payment page posts a signed
 * event exactly as a real gateway would. Never trust client success screens.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface CheckoutInput {
  readonly orderId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly idempotencyKey: string;
}

export interface CheckoutResult {
  readonly providerRef: string;
  /** Where to send the customer to pay (hosted page). */
  readonly redirectUrl: string;
  readonly status: "CREATED";
}

export type WebhookStatus = "SUCCEEDED" | "FAILED" | "PENDING";

export interface ParsedWebhook {
  readonly eventType: string;
  readonly providerRef: string;
  readonly orderId: string;
  readonly status: WebhookStatus;
  readonly amountCents: number;
  /** Provider-supplied unique id for idempotent handling (§19). */
  readonly eventId: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  parseWebhook(rawBody: string): ParsedWebhook;
  /** Sign a payload the way the provider would — used by the mock hosted page. */
  signPayload(rawBody: string): string;
}

const WEBHOOK_SECRET =
  process.env.ONEOFONE_PAYMENT_WEBHOOK_SECRET ??
  "dev-only-insecure-payment-secret";

export class MockYocoProvider implements PaymentProvider {
  readonly name = "yoco-mock";

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const providerRef = `mock_${input.idempotencyKey}`;
    const q = new URLSearchParams({
      ref: providerRef,
      order: input.orderId,
      amount: String(input.amountCents),
    });
    return {
      providerRef,
      redirectUrl: `/pay/mock?${q.toString()}`,
      status: "CREATED",
    };
  }

  signPayload(rawBody: string): string {
    return createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = this.signPayload(rawBody);
    if (signature.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  parseWebhook(rawBody: string): ParsedWebhook {
    const p = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      eventType: String(p.type ?? "payment.updated"),
      providerRef: String(p.providerRef ?? ""),
      orderId: String(p.orderId ?? ""),
      status: (p.status as WebhookStatus) ?? "PENDING",
      amountCents: Number(p.amountCents ?? 0),
      eventId: String(p.eventId ?? ""),
    };
  }
}
