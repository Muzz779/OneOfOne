/**
 * Payment provider abstraction (CLAUDE.md §19, §40, §53).
 *
 * Implementations behind one interface (picked in `container.ts`):
 * - {@link PaystackProvider}: real Paystack hosted checkout + HMAC-SHA512
 *   webhook verification + server-side transaction verify. Used when
 *   PAYSTACK_SECRET_KEY is set.
 * - {@link YocoProvider}: real Yoco Checkout API + Standard-Webhooks signature
 *   verification. Used when YOCO_SECRET_KEY + YOCO_WEBHOOK_SECRET are set.
 * - {@link MockYocoProvider}: dev gateway (`/pay/mock`) with a simple HMAC.
 *
 * Payment confirmation is always server-side via a signed webhook with
 * idempotency; client success screens are never trusted.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { PAYSTACK_SECRET_KEY, YOCO_SECRET_KEY, YOCO_WEBHOOK_SECRET } from "@/server/env";

export interface CheckoutInput {
  readonly orderId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly idempotencyKey: string;
  /** Receipt email (Paystack requires one). */
  readonly customerEmail: string;
  /** Absolute URLs the gateway redirects the customer to. */
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
  /** ISO currency when the provider reports it; checked against the payment. */
  readonly currency?: string;
  readonly eventId: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string): ParsedWebhook;
  /** Sign a payload the way the provider would — used only by the mock page. */
  signPayload(rawBody: string): string;
  /**
   * Optional server-to-server lookup of a payment's status, used when the
   * customer returns from the hosted page so a slow/missed webhook doesn't
   * leave a paid order stuck. Returns undefined if the provider can't tell.
   */
  verifyPayment?(providerRef: string): Promise<ParsedWebhook | undefined>;
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

// ── Real Paystack ───────────────────────────────────────────────────────────
const PAYSTACK_API = "https://api.paystack.co";

interface PaystackTransaction {
  id?: number | string;
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  metadata?: unknown;
}

/** Paystack references allow only alphanumerics and `-`, `.`, `=`. */
export function paystackReference(key: string): string {
  return `oo-${key}`.replace(/[^A-Za-z0-9.=-]/g, "-");
}

function metadataOrderId(metadata: unknown): string {
  let m = metadata;
  if (typeof m === "string") {
    try {
      m = JSON.parse(m);
    } catch {
      return "";
    }
  }
  if (m && typeof m === "object" && "orderId" in m) return String((m as { orderId: unknown }).orderId ?? "");
  return "";
}

function fromTransaction(eventType: string, tx: PaystackTransaction): ParsedWebhook {
  const status: WebhookStatus =
    eventType === "charge.success" && tx.status === "success" ? "SUCCEEDED" : "PENDING";
  return {
    eventType,
    providerRef: String(tx.reference ?? ""),
    orderId: metadataOrderId(tx.metadata),
    status,
    amountCents: Number(tx.amount ?? 0),
    currency: tx.currency ? String(tx.currency) : undefined,
    // Same id for the webhook and the return-verify path, so they dedupe.
    eventId: tx.id != null ? `paystack:${eventType}:${tx.id}` : "",
  };
}

export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack";

  constructor(private readonly secretKey: string = PAYSTACK_SECRET_KEY) {}

  private async api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${PAYSTACK_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
    if (!res.ok || !body.status || !body.data) {
      throw new Error(`Paystack ${path} failed: ${res.status} ${body.message ?? ""}`.trim());
    }
    return body.data;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const reference = paystackReference(input.idempotencyKey);
    const data = await this.api<{ authorization_url: string; reference: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.customerEmail,
        amount: input.amountCents, // ZAR subunit (cents)
        currency: input.currency,
        reference,
        callback_url: input.successUrl,
        metadata: { orderId: input.orderId, cancel_action: input.cancelUrl },
      }),
    });
    return { providerRef: data.reference, redirectUrl: data.authorization_url, status: "CREATED" };
  }

  // Paystack signs the raw body with HMAC-SHA512 using the secret key.
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
    const signature = headers.get("x-paystack-signature") ?? "";
    if (!signature || !this.secretKey) return false;
    const expected = createHmac("sha512", this.secretKey).update(rawBody).digest("hex");
    return safeEqualB64(signature, expected);
  }

  parseWebhook(rawBody: string): ParsedWebhook {
    const evt = JSON.parse(rawBody) as { event?: string; data?: PaystackTransaction };
    return fromTransaction(String(evt.event ?? ""), evt.data ?? {});
  }

  async verifyPayment(providerRef: string): Promise<ParsedWebhook | undefined> {
    const tx = await this.api<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(providerRef)}`);
    // Only a successful charge changes anything; abandoned/failed attempts can
    // still be retried on the hosted page, so they stay pending.
    return tx.status === "success" ? fromTransaction("charge.success", tx) : undefined;
  }

  signPayload(): string {
    throw new Error("signPayload is not supported by the live Paystack provider.");
  }
}
