/**
 * Design use-cases (CLAUDE.md §3, §4, §5, §6, §8, §9, §11, §12, §28, §36, §42).
 *
 * A design is one garment that can carry a different artwork on each printable
 * side (front and/or back). Orchestrates per-side upload → measure → store,
 * autosave, enhancement and background removal. Originals are preserved
 * immutably (§4); processed outputs become the new working artwork for that side.
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
import { getProductById, SEED_PRODUCTS, type PrintSide } from "@/domain/products";
import type { Design, DesignAsset, SideArtwork, StorageBucket } from "@/domain/entities";
import { designedSides } from "@/domain/entities";
import type { ImageFacts } from "@/lib/print/analysis";
import type { DesignDTO, ProcessingNote, SideArtworkDTO } from "@/lib/dto";

const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const MAX_BYTES = 25 * 1024 * 1024;

function extFor(format: ImageFacts["format"]): string {
  switch (format) {
    case "JPEG": return "jpg";
    case "PNG": return "png";
    case "WEBP": return "webp";
    case "SVG": return "svg";
    case "TIFF": return "tiff";
    default: return "bin";
  }
}

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

async function storeOriginal(
  designId: string,
  side: PrintSide,
  buffer: Buffer,
  mimeType: string,
): Promise<{ asset: DesignAsset; facts: ImageFacts }> {
  const repo = getRepo();
  const storage = getStorage();
  const image = getImageProcessor();

  const { facts, hash } = await image.measure(buffer);
  if (facts.widthPx <= 0 || facts.heightPx <= 0) {
    throw badRequest("We couldn't read that image. Try a different JPG, PNG, WEBP or SVG.");
  }
  const ext = extFor(facts.format);
  const bucket: StorageBucket = "originals";
  const key = `${designId}/${side.toLowerCase()}/original.${ext}`;
  const { bytes } = await storage.put(bucket, key, buffer, mimeType);

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
  return { asset, facts };
}

export async function uploadArtwork(input: UploadInput): Promise<DesignDTO> {
  validateUpload(input.mimeType, input.buffer.byteLength);
  const repo = getRepo();
  const now = new Date().toISOString();

  if (input.designId) {
    const design = await repo.getDesign(input.designId);
    if (!design) throw notFound("We couldn't find that design.");
    const side = input.side ?? design.activeSide;
    const { asset, facts } = await storeOriginal(design.id, side, input.buffer, input.mimeType);
    design.sides[side] = {
      facts,
      placement: DEFAULT_PLACEMENT,
      version: 1,
      originalAssetId: asset.id,
      workingAssetId: asset.id,
    };
    design.activeSide = side;
    design.updatedAt = now;
    await repo.saveDesign(design);
    await repo.recordEvent({ id: newId("des"), type: "UPLOAD", at: now, props: { side } });
    return toDesignDTO(design);
  }

  // New design.
  const designId = newId("des");
  const side = input.side ?? "FRONT";
  const { asset, facts } = await storeOriginal(designId, side, input.buffer, input.mimeType);
  const first = SEED_PRODUCTS[0];
  const design: Design = {
    id: designId,
    userId: input.userId,
    productId: first.id,
    colour: first.colours[0].name,
    size: "M",
    sides: {
      [side]: {
        facts,
        placement: DEFAULT_PLACEMENT,
        version: 1,
        originalAssetId: asset.id,
        workingAssetId: asset.id,
      },
    },
    activeSide: side,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  };
  await repo.createDesign(design);
  await repo.recordEvent({ id: newId("des"), type: "UPLOAD", at: now, props: { side } });
  return toDesignDTO(design);
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
