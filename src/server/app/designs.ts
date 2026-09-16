/**
 * Design use-cases (CLAUDE.md §3, §4, §5, §6, §8, §12, §28, §36, §42, §43).
 *
 * Orchestrates upload → measure → store, autosave, enhancement and background
 * removal. Preserves the original immutably (§4); processed outputs become the
 * new "working" artwork. All heavy processing is server-side (§36).
 */

import "server-only";
import {
  getEnhancer,
  getBgRemover,
  getImageProcessor,
  getPrinterSpec,
  getRepo,
  getStorage,
} from "@/server/container";
import { badRequest, notFound } from "@/server/errors";
import { newId } from "@/domain/ids";
import { DEFAULT_PLACEMENT } from "@/lib/print/placement";
import { designPrintBox } from "@/lib/print/design-calc";
import { mmToPx } from "@/lib/print/units";
import { getProductById, SEED_PRODUCTS } from "@/domain/products";
import type { DesignAsset, StorageBucket } from "@/domain/entities";
import type { ImageFacts } from "@/lib/print/analysis";
import type { DesignDTO, ProcessingNote } from "@/lib/dto";
import type { Design } from "@/domain/entities";

const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);
const MAX_BYTES = 25 * 1024 * 1024;

function extFor(format: ImageFacts["format"]): string {
  switch (format) {
    case "JPEG":
      return "jpg";
    case "PNG":
      return "png";
    case "WEBP":
      return "webp";
    case "SVG":
      return "svg";
    case "TIFF":
      return "tiff";
    default:
      return "bin";
  }
}

async function signedWorkingUrl(design: Design): Promise<string> {
  const repo = getRepo();
  const storage = getStorage();
  const assetId = design.workingAssetId ?? design.originalAssetId;
  const asset = await repo.getAsset(assetId);
  if (!asset) throw notFound("Design artwork is missing.");
  return storage.signedUrl(asset.bucket, asset.storageKey, 3600);
}

export async function toDesignDTO(
  design: Design,
  lastProcessing?: ProcessingNote,
): Promise<DesignDTO> {
  return {
    id: design.id,
    productId: design.productId,
    side: design.side,
    colour: design.colour,
    size: design.size,
    placement: design.placement,
    facts: design.facts,
    status: design.status,
    version: design.version,
    workingUrl: await signedWorkingUrl(design),
    updatedAt: design.updatedAt,
    lastProcessing,
  };
}

export interface UploadInput {
  readonly buffer: Buffer;
  readonly mimeType: string;
  readonly filename: string;
  readonly userId?: string;
}

export async function uploadArtwork(input: UploadInput): Promise<DesignDTO> {
  // §28 — validate server-side; never trust the client's type/size.
  if (!ACCEPTED_MIME.has(input.mimeType)) {
    throw badRequest("That file type isn't supported. Upload a JPG, PNG, WEBP or SVG.");
  }
  if (input.buffer.byteLength > MAX_BYTES) {
    throw badRequest("That file is too large. Please keep uploads under 25MB.");
  }

  const repo = getRepo();
  const storage = getStorage();
  const image = getImageProcessor();

  const { facts, hash } = await image.measure(input.buffer);
  if (facts.widthPx <= 0 || facts.heightPx <= 0) {
    throw badRequest("We couldn't read that image. Try a different JPG, PNG, WEBP or SVG.");
  }

  const designId = newId("des");
  const ext = extFor(facts.format);
  const key = `${designId}/original.${ext}`;
  const bucket: StorageBucket = "originals";
  const { bytes } = await storage.put(bucket, key, input.buffer, input.mimeType);

  const asset: DesignAsset = {
    id: newId("ast"),
    designId,
    kind: "ORIGINAL",
    bucket,
    storageKey: key,
    format: facts.format,
    widthPx: facts.widthPx,
    heightPx: facts.heightPx,
    bytes,
    hash,
    createdAt: new Date().toISOString(),
  };
  await repo.addAsset(asset);

  const now = new Date().toISOString();
  const first = SEED_PRODUCTS[0];
  const design: Design = {
    id: designId,
    userId: input.userId,
    productId: first.id,
    side: "FRONT",
    colour: first.colours[0].name,
    size: "M",
    placement: DEFAULT_PLACEMENT,
    facts,
    status: "DRAFT",
    version: 1,
    originalAssetId: asset.id,
    workingAssetId: asset.id,
    createdAt: now,
    updatedAt: now,
  };
  await repo.createDesign(design);

  await repo.recordEvent({
    id: newId("des"),
    type: "UPLOAD",
    at: now,
    props: { format: facts.format, w: facts.widthPx, h: facts.heightPx },
  });

  return toDesignDTO(design);
}

export interface SavePatch {
  readonly productId?: string;
  readonly side?: Design["side"];
  readonly colour?: string;
  readonly size?: string;
  readonly placement?: Design["placement"];
}

/** Autosave editor state (§12). */
export async function saveDesign(
  designId: string,
  patch: SavePatch,
): Promise<DesignDTO> {
  const repo = getRepo();
  const design = await repo.getDesign(designId);
  if (!design) throw notFound("We couldn't find that design.");

  if (patch.productId && getProductById(patch.productId)) {
    design.productId = patch.productId;
  }
  if (patch.side) design.side = patch.side;
  if (patch.colour) design.colour = patch.colour;
  if (patch.size) design.size = patch.size;
  if (patch.placement) design.placement = patch.placement;
  design.updatedAt = new Date().toISOString();

  await repo.saveDesign(design);
  return toDesignDTO(design);
}

export async function getDesignDTO(designId: string): Promise<DesignDTO> {
  const repo = getRepo();
  const design = await repo.getDesign(designId);
  if (!design) throw notFound("We couldn't find that design.");
  return toDesignDTO(design);
}

async function currentWorkingBytes(design: Design): Promise<Buffer> {
  const repo = getRepo();
  const storage = getStorage();
  const asset = await repo.getAsset(design.workingAssetId ?? design.originalAssetId);
  if (!asset) throw notFound("Design artwork is missing.");
  return storage.get(asset.bucket, asset.storageKey);
}

/** AI/upscale enhancement (§6). Preserves original; stores enhanced separately. */
export async function enhanceDesign(designId: string): Promise<DesignDTO> {
  const repo = getRepo();
  const storage = getStorage();
  const image = getImageProcessor();
  const enhancer = getEnhancer();
  const spec = getPrinterSpec();

  const design = await repo.getDesign(designId);
  if (!design) throw notFound("We couldn't find that design.");

  const product = getProductById(design.productId)!;
  const { printBox } = designPrintBox(design.facts, design.placement, product, design.side, spec);
  const targetW = mmToPx(printBox.widthMm, spec.dpi);
  const targetH = mmToPx(printBox.heightMm, spec.dpi);

  // §42 cost control: skip if the working artwork already meets the target.
  if (design.facts.widthPx >= targetW && design.facts.heightPx >= targetH) {
    return toDesignDTO(design, {
      kind: "ENHANCE",
      provider: enhancer.name,
      note: "Your artwork is already high enough resolution for this print size — no enhancement needed.",
      noop: true,
    });
  }

  const source = await currentWorkingBytes(design);
  const result = await enhancer.enhance({
    source,
    isVector: design.facts.isVector,
    targetWidthPx: targetW,
    targetHeightPx: targetH,
  });

  const measured = await image.measure(result.buffer);
  const key = `${design.id}/enhanced-v${design.version + 1}.png`;
  const { bytes } = await storage.put("working", key, result.buffer, "image/png");
  const asset: DesignAsset = {
    id: newId("ast"),
    designId: design.id,
    kind: "ENHANCED",
    bucket: "working",
    storageKey: key,
    format: "PNG",
    widthPx: measured.facts.widthPx,
    heightPx: measured.facts.heightPx,
    bytes,
    hash: measured.hash,
    createdAt: new Date().toISOString(),
  };
  await repo.addAsset(asset);

  design.workingAssetId = asset.id;
  design.enhancedAssetId = asset.id;
  design.facts = measured.facts;
  design.version += 1;
  design.updatedAt = new Date().toISOString();
  await repo.saveDesign(design);

  await repo.recordEvent({ id: newId("des"), type: "ENHANCEMENT", at: design.updatedAt });

  return toDesignDTO(design, {
    kind: "ENHANCE",
    provider: result.provider,
    note: result.note,
  });
}

/** Background removal (§8). Preserves original; stores result separately. */
export async function removeBackground(designId: string): Promise<DesignDTO> {
  const repo = getRepo();
  const storage = getStorage();
  const image = getImageProcessor();
  const remover = getBgRemover();

  const design = await repo.getDesign(designId);
  if (!design) throw notFound("We couldn't find that design.");
  if (design.facts.isVector) {
    return toDesignDTO(design, {
      kind: "BG_REMOVE",
      provider: remover.name,
      note: "Vector artwork is already transparent where it should be — no background to remove.",
      noop: true,
    });
  }

  const source = await currentWorkingBytes(design);
  const result = await remover.removeBackground({ source });

  if (result.removedFraction < 0.02) {
    return toDesignDTO(design, {
      kind: "BG_REMOVE",
      provider: result.provider,
      note: "We couldn't detect a clear, uniform background to remove on this image.",
      removedFraction: result.removedFraction,
      noop: true,
    });
  }

  const measured = await image.measure(result.buffer);
  const key = `${design.id}/nobg-v${design.version + 1}.png`;
  const { bytes } = await storage.put("working", key, result.buffer, "image/png");
  const asset: DesignAsset = {
    id: newId("ast"),
    designId: design.id,
    kind: "BG_REMOVED",
    bucket: "working",
    storageKey: key,
    format: "PNG",
    widthPx: measured.facts.widthPx,
    heightPx: measured.facts.heightPx,
    bytes,
    hash: measured.hash,
    createdAt: new Date().toISOString(),
  };
  await repo.addAsset(asset);

  design.workingAssetId = asset.id;
  design.bgRemovedAssetId = asset.id;
  design.facts = { ...measured.facts, hasAlpha: true };
  design.version += 1;
  design.updatedAt = new Date().toISOString();
  await repo.saveDesign(design);

  await repo.recordEvent({ id: newId("des"), type: "BACKGROUND_REMOVAL", at: design.updatedAt });

  return toDesignDTO(design, {
    kind: "BG_REMOVE",
    provider: result.provider,
    note: result.note,
    removedFraction: result.removedFraction,
  });
}
