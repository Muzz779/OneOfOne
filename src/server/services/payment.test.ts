import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { PaystackProvider, paystackReference } = await import("./payment");

const SECRET = "sk_test_unit";
const provider = new PaystackProvider(SECRET);

function sign(body: string, secret = SECRET) {
  return createHmac("sha512", secret).update(body).digest("hex");
}

const chargeSuccess = JSON.stringify({
  event: "charge.success",
  data: {
    id: 4242,
    status: "success",
    reference: "oo-ord-abc",
    amount: 35900,
    currency: "ZAR",
    metadata: { orderId: "ord_abc" },
  },
});

describe("PaystackProvider webhooks", () => {
  it("accepts a body signed with the secret key", () => {
    const headers = new Headers({ "x-paystack-signature": sign(chargeSuccess) });
    expect(provider.verifyWebhookSignature(chargeSuccess, headers)).toBe(true);
  });

  it("rejects a wrong secret, a tampered body, or a missing header", () => {
    expect(
      provider.verifyWebhookSignature(chargeSuccess, new Headers({ "x-paystack-signature": sign(chargeSuccess, "nope") })),
    ).toBe(false);
    const tampered = chargeSuccess.replace("35900", "100");
    expect(
      provider.verifyWebhookSignature(tampered, new Headers({ "x-paystack-signature": sign(chargeSuccess) })),
    ).toBe(false);
    expect(provider.verifyWebhookSignature(chargeSuccess, new Headers())).toBe(false);
  });

  it("parses charge.success into a succeeded payment event", () => {
    expect(provider.parseWebhook(chargeSuccess)).toEqual({
      eventType: "charge.success",
      providerRef: "oo-ord-abc",
      orderId: "ord_abc",
      status: "SUCCEEDED",
      amountCents: 35900,
      currency: "ZAR",
      eventId: "paystack:charge.success:4242",
    });
  });

  it("reads orderId from string metadata and ignores other events", () => {
    const stringMeta = JSON.stringify({
      event: "charge.success",
      data: { id: 1, status: "success", reference: "r", amount: 1, metadata: JSON.stringify({ orderId: "ord_x" }) },
    });
    expect(provider.parseWebhook(stringMeta).orderId).toBe("ord_x");

    const other = JSON.stringify({ event: "transfer.success", data: { id: 9 } });
    expect(provider.parseWebhook(other).status).toBe("PENDING");
  });
});

describe("paystackReference", () => {
  it("only uses characters Paystack allows", () => {
    expect(paystackReference("ord_3f2a-9c")).toBe("oo-ord-3f2a-9c");
    expect(paystackReference("a b/c")).toMatch(/^[A-Za-z0-9.=-]+$/);
  });
});
