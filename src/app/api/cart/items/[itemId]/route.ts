import { cartView, removeCartItem, updateCartItem } from "@/server/app/cart";
import { getCartId } from "@/server/session";
import { badRequest } from "@/server/errors";
import { fail, json, readJson } from "@/server/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ itemId: string }> };

// PATCH /api/cart/items/[itemId] — change quantity.
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const cartId = await getCartId();
    if (!cartId) throw badRequest("Your cart is empty.");
    const { itemId } = await params;
    const { quantity } = await readJson<{ quantity: number }>(req);
    const cart = await updateCartItem(cartId, itemId, quantity);
    return json(await cartView(cart));
  } catch (e) {
    return fail(e);
  }
}

// DELETE /api/cart/items/[itemId] — remove an item.
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const cartId = await getCartId();
    if (!cartId) throw badRequest("Your cart is empty.");
    const { itemId } = await params;
    const cart = await removeCartItem(cartId, itemId);
    return json(await cartView(cart));
  } catch (e) {
    return fail(e);
  }
}
