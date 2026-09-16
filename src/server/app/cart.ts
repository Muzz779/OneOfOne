/**
 * Cart use-cases (CLAUDE.md §14, §15).
 */

import "server-only";
import { getRepo, getStorage } from "@/server/container";
import { badRequest, notFound } from "@/server/errors";
import { newId } from "@/domain/ids";
import { getProductById } from "@/domain/products";
import { designedSides, type Cart, type CartItem } from "@/domain/entities";
import type { DeliveryMethod } from "@/domain/pricing";
import type { CartItemDTO, CartViewDTO } from "@/lib/dto";
import { quoteCart } from "./pricing";

export async function createCart(userId?: string): Promise<Cart> {
  const now = new Date().toISOString();
  return getRepo().createCart({
    id: newId("cart"),
    userId,
    items: [],
    createdAt: now,
    updatedAt: now,
  });
}

export async function getOrCreateCart(cartId?: string): Promise<Cart> {
  const repo = getRepo();
  if (cartId) {
    const existing = await repo.getCart(cartId);
    if (existing) return existing;
  }
  return createCart();
}

export interface AddToCartInput {
  readonly cartId?: string;
  readonly designId: string;
  readonly colour?: string;
  readonly size: string;
  readonly quantity: number;
}

export async function addToCart(input: AddToCartInput): Promise<Cart> {
  const repo = getRepo();
  const design = await repo.getDesign(input.designId);
  if (!design) throw notFound("We couldn't find that design.");
  if (designedSides(design).length === 0) {
    throw badRequest("Add artwork to at least one side before adding to cart.");
  }
  const product = getProductById(design.productId);
  if (!product) throw badRequest("That product is unavailable.");
  if (!product.sizes.includes(input.size as (typeof product.sizes)[number])) {
    throw badRequest("Please choose a valid size.");
  }
  const quantity = Math.max(1, Math.min(50, Math.floor(input.quantity)));

  const cart = await getOrCreateCart(input.cartId);
  const colour = input.colour ?? design.colour;

  // Mark the design ready to order once it's added to a cart.
  design.status = "READY";
  design.colour = colour;
  design.size = input.size;
  design.updatedAt = new Date().toISOString();
  await repo.saveDesign(design);

  const item: CartItem = {
    id: newId("ci"),
    designId: design.id,
    productId: product.id,
    colour,
    size: input.size,
    quantity,
  };
  cart.items.push(item);
  cart.updatedAt = new Date().toISOString();
  await repo.saveCart(cart);

  await repo.recordEvent({
    id: newId("ci"),
    type: "ADD_TO_CART",
    at: cart.updatedAt,
    props: { productId: product.id, size: input.size },
  });
  return cart;
}

export async function updateCartItem(
  cartId: string,
  itemId: string,
  quantity: number,
): Promise<Cart> {
  const repo = getRepo();
  const cart = await repo.getCart(cartId);
  if (!cart) throw notFound("We couldn't find your cart.");
  const item = cart.items.find((i) => i.id === itemId);
  if (!item) throw notFound("That item isn't in your cart.");
  if (quantity <= 0) {
    cart.items = cart.items.filter((i) => i.id !== itemId);
  } else {
    item.quantity = Math.min(50, Math.floor(quantity));
  }
  cart.updatedAt = new Date().toISOString();
  await repo.saveCart(cart);
  return cart;
}

export async function removeCartItem(cartId: string, itemId: string): Promise<Cart> {
  return updateCartItem(cartId, itemId, 0);
}

/** Build a client-safe cart view with thumbnails and a live price. */
export async function cartView(
  cart: Cart,
  deliveryMethod: DeliveryMethod = "PUDO",
): Promise<CartViewDTO> {
  const repo = getRepo();
  const storage = getStorage();
  const { breakdown, lines } = await quoteCart(cart, deliveryMethod);

  const items: CartItemDTO[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sides = designedSides(line.design);
    const thumbSide = sides.includes(line.design.activeSide) ? line.design.activeSide : sides[0];
    const sa = thumbSide ? line.design.sides[thumbSide] : undefined;
    const asset = sa ? await repo.getAsset(sa.workingAssetId) : undefined;
    const thumbUrl = asset
      ? await storage.signedUrl(asset.bucket, asset.storageKey, 3600)
      : "";
    items.push({
      itemId: line.cartItemId,
      designId: line.design.id,
      productName: line.productName,
      colour: line.colour,
      size: line.size,
      quantity: line.quantity,
      unitPriceCents: breakdown.lines[i].unitPriceCents,
      thumbUrl,
    });
  }
  return { cartId: cart.id, items, breakdown };
}
