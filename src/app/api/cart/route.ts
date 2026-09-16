import { addToCart, cartView, getOrCreateCart } from "@/server/app/cart";
import { getCartId, setCartId } from "@/server/session";
import { fail, json, readJson } from "@/server/http";

export const runtime = "nodejs";

// GET /api/cart — current cart view.
export async function GET() {
  try {
    const cartId = await getCartId();
    if (!cartId) return json({ cartId: "", items: [], breakdown: null });
    const cart = await getOrCreateCart(cartId);
    return json(await cartView(cart));
  } catch (e) {
    return fail(e);
  }
}

interface AddBody {
  designId: string;
  size: string;
  colour?: string;
  quantity?: number;
}

// POST /api/cart — add a design to the cart (§14, §15).
export async function POST(req: Request) {
  try {
    const body = await readJson<AddBody>(req);
    const cartId = await getCartId();
    const cart = await addToCart({
      cartId,
      designId: body.designId,
      size: body.size,
      colour: body.colour,
      quantity: body.quantity ?? 1,
    });
    if (cart.id !== cartId) await setCartId(cart.id);
    return json(await cartView(cart));
  } catch (e) {
    return fail(e);
  }
}
