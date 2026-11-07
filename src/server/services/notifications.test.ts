import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MockNotificationService, smtpFrom } from "./notifications";

describe("smtpFrom", () => {
  it("defaults to the brand name on the SMTP login", () => {
    expect(smtpFrom("", "shop@gmail.com")).toBe("OneOfOne <shop@gmail.com>");
  });
  it("uses a display-name-only setting with the login address", () => {
    expect(smtpFrom("OneOfOne Orders", "shop@gmail.com")).toBe("OneOfOne Orders <shop@gmail.com>");
  });
  it("keeps a full address as given", () => {
    expect(smtpFrom("Shop <orders@shop.co.za>", "shop@gmail.com")).toBe("Shop <orders@shop.co.za>");
  });
});

describe("MockNotificationService", () => {
  it("never claims an email was sent", async () => {
    const r = await new MockNotificationService().send({
      to: "a@b.co", channel: "EMAIL", type: "ORDER_RECEIVED", subject: "s", body: "b",
    });
    expect(r.status).toBe("LOGGED");
  });
});
