/**
 * Design use-cases (CLAUDE.md §3, §4, §5, §6, §8, §9, §11, §12, §28, §36, §42).
 *
 * A design is one garment that can carry a different artwork on each printable
 * side (front and/or back). Orchestrates per-side upload → measure → store,
 * autosave, enhancement and background removal. Originals are preserved
 * immutably (§4); processed outputs become the new working artwork for that side.
 */

import "server-only";
import { randomUUID } from "node:crypto";
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
import { getProductById, SEED_PRODUCTS, type PrintSide } from "@/domain/products";
import { designedSides, type Design, type DesignAsset, type SideArtwork } from "@/domain/entities";
import type { DesignDTO, ProcessingNote, SideArtworkDTO } from "@/lib/dto";

const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const MAX_BYTES = 25 * 1024 * 1024;

async function signedWorkingUrl(sa: SideArtwork): Promise<string> {
  const repo = getRepo();
  const storage = getStorage();
  const asset = await repo.getAsset(sa.workingAssetId);
  if (!asset) throw notFound("Design artwork is missing.");
  return storage.signedUrl(asset.bucket, asset.storageKey, 3600);
}

export async function toDesignDTO(
  design: Design,
  processed?: { side: PrintSide; note: ProcessingNote },
): Promise<DesignDTO> {
  const sides: SideArtworkDTO[] = [];
  for (const side of designedSides(design)) {
    const sa = design.sides[side]!;
    sides.push({
      side,
      facts: sa.facts,
      placement: sa.placement,
      version: sa.version,
      workingUrl: await signedWorkingUrl(sa),
      lastProcessing: processed?.side === side ? processed.note : undefined,
    });
  }
  return {
    id: design.id,
    productId: design.productId,
    colour: design.colour,
    size: design.size,
    activeSide: design.activeSide,
    sides,
    status: design.status,
    updatedAt: design.updatedAt,
  };
}

function validateUpload(mimeType: string, bytes: number): void {
  if (!ACCEPTED_MIME.has(mimeType)) {
    throw badRequest("That file type isn't supported. Upload a JPG, PNG, WEBP or SVG.");
  }
  if (bytes > MAX_BYTES) {
    throw badRequest("That file is too large. Please keep uploads under 25MB.");
  }
}

export interface UploadInput {
  readonly buffer: Buffer;
  readonly mimeType: string;
  readonly filename: string;
  readonly userId?: string;
  /** Add to an existing design (to design a second side). */
  readonly designId?: string;
  /** Which side this artwork is for (defaults to the design's active side / FRONT). */
  readonly side?: PrintSide;
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/svg+xml": return "svg";
    default: return "bin";
  }
}

function uploadKey(designId: string, side: PrintSide, mime: string): string {
  const suffix = randomUUID().slice(0, 8);
  return `${designId}/${side.toLowerCase()}/original-${suffix}.${extFromMime(mime)}`;
}

/**
 * Shared: measure already-stored bytes, record the ORIGINAL asset (pointing at
 * `key`), and create or update the design's side. Preserves the original (§4).
 */
async function finalizeArtwork(opts: {
  designId: string;
  side: PrintSide;
  key: string;
  buffer: Buffer;
  userId?: string;
}): Promise<DesignDTO> {
  const repo = getRepo();
  const image = getImageProcessor();
  const { facts, hash } = await image.measure(opts.buffer);
  if (facts.widthPx <= 0 || facts.heightPx <= 0) {
    throw badRequest("We couldn't read that image. Try a different JPG, PNG, WEBP or SVG.");
  }
  const asset: DesignAsset = {
    id: newId("ast"),
    designId: opts.designId,
    kind: "ORIGINAL",
    bucket: "originals",
    storageKey: opts.key,
    format: facts.format,
    widthPx: facts.widthPx,
    heightPx: facts.heightPx,
    bytes: opts.buffer.byteLength,
    hash,
    createdAt: new Date().toISOString(),
  };
  await repo.addAsset(asset);

  const now = new Date().toISOString();
  const sa: SideArtwork = {
    facts,
    placement: DEFAULT_PLACEMENT,
    version: 1,
    originalAssetId: asset.id,
    workingAssetId: asset.id,
  };
  const existing = await repo.getDesign(opts.designId);
  if (existing) {
    existing.sides[opts.side] = sa;
    existing.activeSide = opts.side;
    existing.updatedAt = now;
    await repo.saveDesign(existing);
    await repo.recordEvent({ id: newId("des"), type: "UPLOAD", at: now, props: { side: opts.side } });
    return toDesignDTO(existing);
  }
  const first = SEED_PRODUCTS[0];
  const design: Design = {
    id: opts.designId,
    userId: opts.userId,
    productId: first.id,
    colour: first.colours[0].name,
    size: "M",
    sides: { [opts.side]: sa },
    activeSide: opts.side,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  };
  await repo.createDesign(design);
  await repo.recordEvent({ id: newId("des"), type: "UPLOAD", at: now, props: { side: opts.side } });
  return toDesignDTO(design);
}

/** Multipart upload (dev/mock, small files): bytes pass through the server. */
export async function uploadArtwork(input: UploadInput): Promise<DesignDTO> {
  validateUpload(input.mimeType, input.buffer.byteLength);
  const storage = getStorage();
  const existing = input.designId ? await getRepo().getDesign(input.designId) : undefined;
  const side = input.side ?? existing?.activeSide ?? "FRONT";
  const designId = input.designId ?? newId("des");
  const key = uploadKey(designId, side, input.mimeType);
  await storage.put("originals", key, input.buffer, input.mimeType);
  return finalizeArtwork({ designId, side, key, buffer: input.buffer, userId: input.userId });
}

export interface PrepareUploadInput {
  readonly contentType: string;
  readonly side?: PrintSide;
  readonly designId?: string;
  readonly userId?: string;
}

export interface PrepareUploadResult {
  readonly direct: boolean;
  readonly designId: string;
  readonly side: PrintSide;
  readonly key: string;
  readonly uploadUrl?: string;
}

/**
 * Prepare a direct-to-storage upload (production — avoids the serverless body
 * limit) or signal the multipart fallback (dev/mock).
 */
export async function prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadResult> {
  if (!ACCEPTED_MIME.has(input.contentType)) {
    throw badRequest("That file type isn't supported. Upload a JPG, PNG, WEBP or SVG.");
  }
  const storage = getStorage();
  const existing = input.designId ? await getRepo().getDesign(input.designId) : undefined;
  const side = input.side ?? existing?.activeSide ?? "FRONT";
  const designId = input.designId ?? newId("des");
  const key = uploadKey(designId, side, input.contentType);
  if (storage.supportsDirectUpload()) {
    const { uploadUrl } = await storage.createSignedUploadUrl("originals", key);
    return { direct: true, designId, side, key, uploadUrl };
  }
  return { direct: false, designId, side, key };
}

export interface RegisterUploadInput {
  readonly designId: string;
  readonly side: PrintSide;
  readonly key: string;
  readonly userId?: string;
}

/** After a direct upload, download + measure the object and register the design. */
export async function registerUploadedArtwork(input: RegisterUploadInput): Promise<DesignDTO> {
  const storage = getStorage();
  let buffer: Buffer;
  try {
    buffer = await storage.get("originals", input.key);
  } catch {
    throw badRequest("We couldn't find the uploaded file. Please try again.");
  }
  if (buffer.byteLength > MAX_BYTES) {
    throw badRequest("That file is too large. Please keep uploads under 25MB.");
  }
  return finalizeArtwork({ designId: input.designId, side: input.side, key: input.key, buffer, userId: input.userId });
}

export interface SavePatch {
  readonly productId?: string;
  readonly colour?: string;
  readonly size?: string;
  readonly activeSide?: PrintSide;
  /** Update a single side's placement. */
  readonly side?: PrintSide;
  readonly placement?: SideArtwork["placement"];
}

export async function saveDesign(designId: string, patch: SavePatch): Promise<DesignDTO> {
  const repo = getRepo();
  const design = await repo.getDesign(designId);
  if (!design) throw notFound("We couldn't find that design.");

  if (patch.productId && getProductById(patch.productId)) design.productId = patch.productId;
  if (patch.colour) design.colour = patch.colour;
  if (patch.size) design.size = patch.size;
  if (patch.activeSide) design.activeSide = patch.activeSide;
  if (patch.side && patch.placement) {
    const sa = design.sides[patch.side];
    if (sa) sa.placement = patch.placement;
  }
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

async function workingBytes(sa: SideArtwork): Promise<Buffer> {
  const repo = getRepo();
  const storage = getStorage();
  const asset = await repo.getAsset(sa.workingAssetId);
  if (!asset) throw notFound("Design artwork is missing.");
  return storage.get(asset.bucket, asset.storageKey);
}

function requireSide(design: Design, side: PrintSide): SideArtwork {
  const sa = design.sides[side];
  if (!sa) throw badRequest("There's no artwork on that side yet.");
  return sa;
}

/** AI/upscale enhancement for one side (§6). */
export async function enhanceDesign(designId: string, side: PrintSide): Promise<DesignDTO> {
  const repo = getRepo();
  const storage = getStorage();
  const image = getImageProcessor();
  const enhancer = getEnhancer();
  const spec = getPrinterSpec();

  const design = await repo.getDesign(designId);
  if (!design) throw notFound("We couldn't find that design.");
  const sa = requireSide(design, side);
  const product = getProductById(design.productId)!;
  const { printBox } = designPrintBox(sa.facts, sa.placement, product, side, spec);
  const targetW = mmToPx(printBox.widthMm, spec.dpi);
  const targetH = mmToPx(printBox.heightMm, spec.dpi);

  if (sa.facts.widthPx >= targetW && sa.facts.heightPx >= targetH) {
    return toDesignDTO(design, {
      side,
      note: {
        kind: "ENHANCE",
        provider: enhancer.name,
        note: "Your artwork is already high enough resolution for this print size — no enhancement needed.",
        noop: true,
      },
    });
  }

  const source = await workingBytes(sa);
  const result = await enhancer.enhance({ source, isVector: sa.facts.isVector, targetWidthPx: targetW, targetHeightPx: targetH });
  const measured = await image.measure(result.buffer);
  const key = `${design.id}/${side.toLowerCase()}/enhanced-v${sa.version + 1}.png`;
  const { bytes } = await storage.put("working", key, result.buffer, "image/png");
  const asset = await repo.addAsset({
    id: newId("ast"), designId: design.id, kind: "ENHANCED", bucket: "working", storageKey: key,
    format: "PNG", widthPx: measured.facts.widthPx, heightPx: measured.facts.heightPx, bytes, hash: measured.hash, createdAt: new Date().toISOString(),
  });
  sa.workingAssetId = asset.id;
  sa.enhancedAssetId = asset.id;
  sa.facts = measured.facts;
  sa.version += 1;
  design.updatedAt = new Date().toISOString();
  await repo.saveDesign(design);
  await repo.recordEvent({ id: newId("des"), type: "ENHANCEMENT", at: design.updatedAt });

  return toDesignDTO(design, { side, note: { kind: "ENHANCE", provider: result.provider, note: result.note } });
}

/** Background removal for one side (§8). */
export async function removeBackground(designId: string, side: PrintSide): Promise<DesignDTO> {
  const repo = getRepo();
  const storage = getStorage();
  const image = getImageProcessor();
  const remover = getBgRemover();

  const design = await repo.getDesign(designId);
  if (!design) throw notFound("We couldn't find that design.");
  const sa = requireSide(design, side);
  if (sa.facts.isVector) {
    return toDesignDTO(design, { side, note: { kind: "BG_REMOVE", provider: remover.name, note: "Vector artwork is already transparent where it should be.", noop: true } });
  }

  const source = await workingBytes(sa);
  const result = await remover.removeBackground({ source });
  if (result.removedFraction < 0.02) {
    return toDesignDTO(design, { side, note: { kind: "BG_REMOVE", provider: result.provider, note: "We couldn't detect a clear, uniform background to remove on this image.", removedFraction: result.removedFraction, noop: true } });
  }

  const measured = await image.measure(result.buffer);
  const key = `${design.id}/${side.toLowerCase()}/nobg-v${sa.version + 1}.png`;
  const { bytes } = await storage.put("working", key, result.buffer, "image/png");
  const asset = await repo.addAsset({
    id: newId("ast"), designId: design.id, kind: "BG_REMOVED", bucket: "working", storageKey: key,
    format: "PNG", widthPx: measured.facts.widthPx, heightPx: measured.facts.heightPx, bytes, hash: measured.hash, createdAt: new Date().toISOString(),
  });
  sa.workingAssetId = asset.id;
  sa.bgRemovedAssetId = asset.id;
  sa.facts = { ...measured.facts, hasAlpha: true };
  sa.version += 1;
  design.updatedAt = new Date().toISOString();
  await repo.saveDesign(design);
  await repo.recordEvent({ id: newId("des"), type: "BACKGROUND_REMOVAL", at: design.updatedAt });

  return toDesignDTO(design, { side, note: { kind: "BG_REMOVE", provider: result.provider, note: result.note, removedFraction: result.removedFraction } });
}
