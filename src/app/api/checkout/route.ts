import { createOrder } from "@/server/app/checkout";
import { getCartId } from "@/server/session";
import { badRequest, tooMany } from "@/server/errors";
import { clientKey, rateLimit } from "@/server/ratelimit";
import { fail, json, readJson } from "@/server/http";
import type { CustomerDetails, DeliveryAddress } from "@/domain/entities";
import type { DeliveryMethod } from "@/domain/pricing";

export const runtime = "nodejs";

interface CheckoutBody {
  customer: CustomerDetails;
  deliveryMethod: DeliveryMethod;
  deliveryAddress?: DeliveryAddress;
}

// POST /api/checkout — create order + open payment (§18, §19, §41).
export async function POST(req: Request) {
  try {
    const rl = rateLimit(clientKey(req, "checkout"), 15, 60_000);
    if (!rl.ok) throw tooMany();

    const cartId = await getCartId();
    if (!cartId) throw badRequest("Your cart is empty.");

    const body = await readJson<CheckoutBody>(req);
    const { order, redirectUrl } = await createOrder({
      cartId,
      customer: body.customer,
      deliveryMethod: body.deliveryMethod,
      deliveryAddress: body.deliveryAddress,
    });
    return json({ orderId: order.id, orderNumber: order.orderNumber, redirectUrl });
  } catch (e) {
    return fail(e);
  }
}
