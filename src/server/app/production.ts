/**
 * Production workflow (CLAUDE.md §4, §13, §21, §22, §23, §24).
 *
 * On a paid order: freeze it, and for EACH printed side of each item generate an
 * immutable production artwork at the printer's exact resolution, run
 * server-side preflight, record the versioned production asset + preflight
 * result, and derive that side's mockup from the same production file. If every
 * side passes, the order becomes PRINT_READY and a production job is queued; if
 * any fails, it goes to ARTWORK_REVIEW for a human (§23).
 */

import "server-only";
import {
  getImageProcessor,
  getPrinterSpec,
  getRepo,
  getStorage,
} from "@/server/container";
import { newId } from "@/domain/ids";
import { assertTransition } from "@/domain/orders";
import { getProductById, type PrintSide } from "@/domain/products";
import { designPrintBox } from "@/lib/print/design-calc";
import { runPreflight } from "@/lib/print/preflight";
import type {
  Design,
  Order,
  OrderPrint,
  PreflightResultRecord,
  ProductionAsset,
  SideArtwork,
} from "@/domain/entities";
import { notifyOrder } from "./notify";

async function transition(order: Order, to: Order["status"], note?: string): Promise<void> {
  assertTransition(order.status, to);
  order.status = to;
  order.timeline.push({ state: to, at: new Date().toISOString(), note });
  order.updatedAt = new Date().toISOString();
}

export async function runProductionForOrder(order: Order): Promise<Order> {
  const repo = getRepo();
  const storage = getStorage();
  const image = getImageProcessor();
  const spec = getPrinterSpec();

  await transition(order, "ARTWORK_PROCESSING", "Generating production artwork");
  await repo.saveOrder(order);
  await notifyOrder(order, "ARTWORK_PROCESSING");

  let anyFailed = false;

  for (const item of order.items) {
    const design = await repo.getDesign(item.designId);
    const product = getProductById(item.productId);
    if (!design || !product) {
      anyFailed = true;
      continue;
    }

    for (const print of item.prints) {
      const side = print.side;
      const sa = design.sides[side];
      if (!sa) {
        anyFailed = true;
        continue;
      }

      const { printBox } = designPrintBox(sa.facts, sa.placement, product, side, spec);
      const workingAsset = await repo.getAsset(sa.workingAssetId);
      if (!workingAsset) {
        anyFailed = true;
        continue;
      }
      const source = await storage.get(workingAsset.bucket, workingAsset.storageKey);

      const prod = await image.generateProduction({
        source,
        isVector: sa.facts.isVector,
        dpi: spec.dpi,
        printWidthMm: printBox.widthMm,
        printHeightMm: printBox.heightMm,
        rotationDeg: sa.placement.rotationDeg,
      });

      const preflight = runPreflight(
        sa.facts,
        { side, print: printBox, outputFormat: spec.fileFormat, productionFileSizeBytes: prod.buffer.byteLength },
        product,
        spec,
      );
      const preflightRec: PreflightResultRecord = {
        id: newId("pf"),
        result: preflight,
        createdAt: new Date().toISOString(),
      };
      await repo.savePreflight(preflightRec);
      print.preflightResultId = preflightRec.id;

      const prodKey = `${order.orderNumber.replace("#", "")}/${item.id}_${side}_v${sa.version}.png`;
      const { bytes } = await storage.put("production", prodKey, prod.buffer, "image/png");
      const productionAsset: ProductionAsset = {
        id: newId("pa"),
        orderId: order.id,
        orderItemId: item.id,
        designId: design.id,
        version: sa.version,
        productName: product.name,
        colour: item.colour,
        size: item.size,
        side,
        widthMm: Math.round(prod.boundingWidthMm * 10) / 10,
        heightMm: Math.round(prod.boundingHeightMm * 10) / 10,
        dpi: spec.dpi,
        format: spec.fileFormat,
        bucket: "production",
        storageKey: prodKey,
        bytes,
        preflightResultId: preflightRec.id,
        createdAt: new Date().toISOString(),
      };
      await repo.addProductionAsset(productionAsset);
      print.productionAssetId = productionAsset.id;

      await generateSideMockup(order, design, side, sa, prod.buffer, prod.boundingWidthMm, prod.boundingHeightMm);

      if (preflight.result === "FAIL") anyFailed = true;
    }
  }

  if (anyFailed) {
    await transition(order, "ARTWORK_REVIEW", "Preflight flagged an item for review");
    await repo.saveOrder(order);
    await notifyOrder(order, "ARTWORK_ISSUE");
    return order;
  }

  await transition(order, "PRINT_READY", "All items passed preflight");
  await repo.saveOrder(order);

  const now = new Date().toISOString();
  await repo.addProductionJob({ id: newId("job"), orderId: order.id, status: "QUEUED", createdAt: now, updatedAt: now });
  return order;
}

async function generateSideMockup(
  order: Order,
  design: Design,
  side: PrintSide,
  sa: SideArtwork,
  productionPng: Buffer,
  boundingWidthMm: number,
  boundingHeightMm: number,
): Promise<void> {
  const repo = getRepo();
  const storage = getStorage();
  const image = getImageProcessor();
  const spec = getPrinterSpec();
  const product = getProductById(design.productId);
  if (!product) return;
  const { bounds } = designPrintBox(sa.facts, sa.placement, product, side, spec);
  const colour = product.colours.find((c) => c.name === design.colour) ?? product.colours[0];

  const mockup = await image.generateMockup({
    productionPng,
    product,
    area: bounds.area,
    hex: colour.hex,
    placement: sa.placement,
    maxWidthMm: bounds.maxWidthMm,
    maxHeightMm: bounds.maxHeightMm,
    boundingWidthMm,
    boundingHeightMm,
  });

  const key = `${order.orderNumber.replace("#", "")}/${design.id}_${side}_mockup.png`;
  const { bytes } = await storage.put("mockups", key, mockup.buffer, "image/png");
  const asset = await repo.addAsset({
    id: newId("ast"),
    designId: design.id,
    kind: "MOCKUP",
    bucket: "mockups",
    storageKey: key,
    format: "PNG",
    widthPx: mockup.widthPx,
    heightPx: mockup.heightPx,
    bytes,
    hash: "",
    createdAt: new Date().toISOString(),
  });
  sa.mockupAssetId = asset.id;
  await repo.saveDesign(design);
}

// Note: OrderPrint is mutated in place above; exported for clarity of intent.
export type { OrderPrint };
