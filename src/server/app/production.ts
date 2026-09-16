/**
 * Production workflow (CLAUDE.md §4, §13, §21, §22, §23, §24).
 *
 * On a paid order: freeze it, generate an immutable production artwork per item
 * at the printer's exact resolution, run server-side preflight, record the
 * versioned production asset + preflight result, and derive the customer mockup
 * from the SAME production artwork. If every item passes, the order becomes
 * PRINT_READY and a production job is queued; if any fails, it goes to
 * ARTWORK_REVIEW for a human (§23 — never auto-print a failing file).
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
import { getProductById } from "@/domain/products";
import { designPrintBox } from "@/lib/print/design-calc";
import { runPreflight } from "@/lib/print/preflight";
import type {
  Design,
  Order,
  PreflightResultRecord,
  ProductionAsset,
} from "@/domain/entities";
import { notifyOrder } from "./notify";

async function transition(order: Order, to: Order["status"], note?: string): Promise<void> {
  assertTransition(order.status, to);
  order.status = to;
  order.timeline.push({ state: to, at: new Date().toISOString(), note });
  order.updatedAt = new Date().toISOString();
}

/** Generate production artwork + preflight for one order, in place. */
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

    const { printBox } = designPrintBox(design.facts, design.placement, product, design.side, spec);

    // Source = current working artwork bytes.
    const workingAsset = await repo.getAsset(design.workingAssetId ?? design.originalAssetId);
    if (!workingAsset) {
      anyFailed = true;
      continue;
    }
    const source = await storage.get(workingAsset.bucket, workingAsset.storageKey);

    // Render production artwork at the printer's exact DPI (§24).
    const prod = await image.generateProduction({
      source,
      isVector: design.facts.isVector,
      dpi: spec.dpi,
      printWidthMm: printBox.widthMm,
      printHeightMm: printBox.heightMm,
      rotationDeg: design.placement.rotationDeg,
    });

    // Server-side authoritative preflight (§23).
    const preflight = runPreflight(
      design.facts,
      {
        side: design.side,
        print: printBox,
        outputFormat: spec.fileFormat,
        productionFileSizeBytes: prod.buffer.byteLength,
      },
      product,
      spec,
    );
    const preflightRec: PreflightResultRecord = {
      id: newId("pf"),
      result: preflight,
      createdAt: new Date().toISOString(),
    };
    await repo.savePreflight(preflightRec);
    item.preflightResultId = preflightRec.id;

    // Store the immutable production file (§4, §22).
    const version = design.version;
    const prodKey = `${order.orderNumber.replace("#", "")}/${item.id}_v${version}_${design.side}.png`;
    const { bytes } = await storage.put("production", prodKey, prod.buffer, "image/png");
    const productionAsset: ProductionAsset = {
      id: newId("pa"),
      orderId: order.id,
      orderItemId: item.id,
      designId: design.id,
      version,
      productName: product.name,
      colour: item.colour,
      size: item.size,
      side: design.side,
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
    item.productionAssetId = productionAsset.id;

    // Derive the customer mockup FROM the production artwork (§4, §13).
    await generateAndStoreMockup(order, design, prod.buffer, prod.boundingWidthMm, prod.boundingHeightMm);

    if (preflight.result === "FAIL") anyFailed = true;
  }

  if (anyFailed) {
    await transition(order, "ARTWORK_REVIEW", "Preflight flagged an item for review");
    await repo.saveOrder(order);
    await notifyOrder(order, "ARTWORK_ISSUE");
    return order;
  }

  await transition(order, "PRINT_READY", "All items passed preflight");
  await repo.saveOrder(order);

  // Queue for the production floor (§26).
  const now = new Date().toISOString();
  await repo.addProductionJob({
    id: newId("job"),
    orderId: order.id,
    status: "QUEUED",
    createdAt: now,
    updatedAt: now,
  });
  return order;
}

async function generateAndStoreMockup(
  order: Order,
  design: Design,
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
  const { bounds } = designPrintBox(design.facts, design.placement, product, design.side, spec);
  const colour = product.colours.find((c) => c.name === design.colour) ?? product.colours[0];

  const mockup = await image.generateMockup({
    productionPng,
    product,
    area: bounds.area,
    hex: colour.hex,
    placement: design.placement,
    maxWidthMm: bounds.maxWidthMm,
    maxHeightMm: bounds.maxHeightMm,
    boundingWidthMm,
    boundingHeightMm,
  });

  const key = `${order.orderNumber.replace("#", "")}/${design.id}_mockup.png`;
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
  design.mockupAssetId = asset.id;
  await repo.saveDesign(design);
}
