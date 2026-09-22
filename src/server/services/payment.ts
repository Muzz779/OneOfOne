/**
 * Payment provider abstraction (CLAUDE.md §19, §40, §53).
 *
 * Two implementations behind one interface:
 * - {@link YocoProvider}: real Yoco Checkout API + Standard-Webhooks signature
 *   verification. Used when YOCO_SECRET_KEY + YOCO_WEBHOOK_SECRET are set.
 * - {@link MockYocoProvider}: dev gateway (`/pay/mock`) with a simple HMAC.
 *
 * Payment confirmation is always server-side via a signed webhook with
 * idempotency; client success screens are never trusted.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { YOCO_SECRET_KEY, YOCO_WEBHOOK_SECRET } from "@/server/env";

export interface CheckoutInput {
  readonly orderId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly idempotencyKey: string;
  /** Absolute URLs Yoco redirects the customer to. */
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly failureUrl: string;
}

export interface CheckoutResult {
  readonly providerRef: string;
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
  readonly eventId: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string): ParsedWebhook;
  /** Sign a payload the way the provider would — used only by the mock page. */
  signPayload(rawBody: string): string;
}

function safeEqualB64(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

// ── Mock (development) ──────────────────────────────────────────────────────
const MOCK_WEBHOOK_SECRET =
  process.env.ONEOFONE_PAYMENT_WEBHOOK_SECRET ?? "dev-only-insecure-payment-secret";

export class MockYocoProvider implements PaymentProvider {
  readonly name = "yoco-mock";

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const providerRef = `mock_${input.idempotencyKey}`;
    const q = new URLSearchParams({
      ref: providerRef,
      order: input.orderId,
      amount: String(input.amountCents),
    });
    return { providerRef, redirectUrl: `/pay/mock?${q.toString()}`, status: "CREATED" };
  }

  signPayload(rawBody: string): string {
    return createHmac("sha256", MOCK_WEBHOOK_SECRET).update(rawBody).digest("hex");
  }

  verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
    const signature = headers.get("x-oneofone-signature") ?? "";
    return safeEqualB64(signature, this.signPayload(rawBody));
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

// ── Real Yoco ───────────────────────────────────────────────────────────────
const YOCO_CHECKOUTS_URL = "https://payments.yoco.com/api/checkouts";

export class YocoProvider implements PaymentProvider {
  readonly name = "yoco";

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const res = await fetch(YOCO_CHECKOUTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${YOCO_SECRET_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        amount: input.amountCents,
        currency: input.currency,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        failureUrl: input.failureUrl,
        metadata: { orderId: input.orderId },
      }),
    });
    if (!res.ok) {
      throw new Error(`Yoco checkout failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
    const data = (await res.json()) as { id: string; redirectUrl: string };
    return { providerRef: data.id, redirectUrl: data.redirectUrl, status: "CREATED" };
  }

  // Standard Webhooks (svix-style) verification, as Yoco uses.
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
    const id = headers.get("webhook-id");
    const timestamp = headers.get("webhook-timestamp");
    const sigHeader = headers.get("webhook-signature");
    if (!id || !timestamp || !sigHeader) return false;

    // Reject stale timestamps (5-minute tolerance).
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

    const secretBytes = Buffer.from(YOCO_WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
    const signedContent = `${id}.${timestamp}.${rawBody}`;
    const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

    // Header is a space-separated list of "v1,<signature>" entries.
    const provided = sigHeader.split(" ").map((part) => (part.includes(",") ? part.split(",")[1] : part));
    return provided.some((sig) => safeEqualB64(sig, expected));
  }

  parseWebhook(rawBody: string): ParsedWebhook {
    const evt = JSON.parse(rawBody) as {
      id?: string;
      type?: string;
      payload?: { id?: string; checkoutId?: string; amount?: number; metadata?: Record<string, string> };
    };
    const payload = evt.payload ?? {};
    const type = String(evt.type ?? "");
    const status: WebhookStatus =
      type === "payment.succeeded" ? "SUCCEEDED" : type === "payment.failed" ? "FAILED" : "PENDING";
    return {
      eventType: type,
      providerRef: String(payload.checkoutId ?? payload.id ?? ""),
      orderId: String(payload.metadata?.orderId ?? ""),
      status,
      amountCents: Number(payload.amount ?? 0),
      eventId: String(evt.id ?? ""),
    };
  }

  signPayload(): string {
    throw new Error("signPayload is not supported by the live Yoco provider.");
  }
}
