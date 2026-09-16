/**
 * Server-side pricing orchestration (CLAUDE.md §16, §40).
 *
 * Turns a cart (or a single design) into a {@link PriceBreakdown} using the
 * admin-configured pricing rules. Pricing is ALWAYS computed here, never trusted
 * from the client.
 */

import "server-only";
import { getPrinterSpec, getRepo } from "@/server/container";
import { notFound } from "@/server/errors";
import { getProductById } from "@/domain/products";
import { designPrintBox } from "@/lib/print/design-calc";
import {
  areaCm2FromMm,
  computePrice,
  type DeliveryMethod,
  type PriceBreakdown,
  type PricingLineInput,
} from "@/domain/pricing";
import type { Cart, Design, OrderPrint } from "@/domain/entities";

export interface ItemPrintSpec {
  readonly print: OrderPrint;
  readonly areaCm2: number;
}

/** Physical print spec for a design's single printed side. */
export function itemPrintSpec(design: Design): ItemPrintSpec {
  const spec = getPrinterSpec();
  const product = getProductById(design.productId)!;
  const { printBox } = designPrintBox(
    design.facts,
    design.placement,
    product,
    design.side,
    spec,
  );
  return {
    print: {
      side: design.side,
      widthMm: printBox.widthMm,
      heightMm: printBox.heightMm,
    },
    areaCm2: areaCm2FromMm(printBox.widthMm, printBox.heightMm),
  };
}

export interface CartLineMeta {
  readonly cartItemId: string;
  readonly design: Design;
  readonly productId: string;
  readonly productName: string;
  readonly colour: string;
  readonly size: string;
  readonly quantity: number;
  readonly print: OrderPrint;
  readonly unitLine: PricingLineInput;
}

export interface CartQuote {
  readonly breakdown: PriceBreakdown;
  readonly lines: CartLineMeta[];
}

export async function quoteCart(
  cart: Cart,
  deliveryMethod: DeliveryMethod,
  discountCents?: number,
): Promise<CartQuote> {
  const repo = getRepo();
  const lines: CartLineMeta[] = [];
  const pricingLines: PricingLineInput[] = [];

  for (const item of cart.items) {
    const design = await repo.getDesign(item.designId);
    const product = getProductById(item.productId);
    if (!design || !product) continue;
    const { print, areaCm2 } = itemPrintSpec(design);
    const unitLine: PricingLineInput = {
      garmentRetailCents: product.basePriceCents,
      garmentSupplyCents: product.supplyCostCents,
      quantity: item.quantity,
      prints: [{ areaCm2 }],
    };
    pricingLines.push(unitLine);
    lines.push({
      cartItemId: item.id,
      design,
      productId: product.id,
      productName: product.name,
      colour: item.colour,
      size: item.size,
      quantity: item.quantity,
      print,
      unitLine,
    });
  }

  const config = await repo.getPricingConfig();
  const breakdown = computePrice(pricingLines, { deliveryMethod, discountCents }, config);
  return { breakdown, lines };
}

export async function quoteDesign(
  designId: string,
  deliveryMethod: DeliveryMethod,
): Promise<PriceBreakdown> {
  const repo = getRepo();
  const design = await repo.getDesign(designId);
  if (!design) throw notFound("We couldn't find that design.");
  const product = getProductById(design.productId)!;
  const { areaCm2 } = itemPrintSpec(design);
  const config = await repo.getPricingConfig();
  return computePrice(
    [
      {
        garmentRetailCents: product.basePriceCents,
        garmentSupplyCents: product.supplyCostCents,
        quantity: 1,
        prints: [{ areaCm2 }],
      },
    ],
    { deliveryMethod },
    config,
  );
}
