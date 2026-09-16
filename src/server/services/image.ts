/**
 * Server-side image processing (CLAUDE.md §4, §13, §21–24, §36, §43).
 *
 * Uses sharp for the heavy, authoritative work that must NOT happen in the
 * browser: measuring uploads for real, rendering production artwork at the
 * printer's exact resolution, and deriving the customer mockup FROM that same
 * production artwork (§4 — the printer and the customer see the same asset).
 */

import { createHash } from "node:crypto";
import sharp from "sharp";
import type { ImageFacts } from "@/lib/print/analysis";
import type { Placement } from "@/lib/print/placement";
import type { Product } from "@/domain/products";
import type { PrintArea } from "@/domain/products";
import { garmentSvgString } from "@/domain/garment-shape";
import { mmToPx, pxToMm } from "@/lib/print/units";

function mapFormat(f: string | undefined): ImageFacts["format"] {
  switch (f) {
    case "jpeg":
    case "jpg":
      return "JPEG";
    case "png":
      return "PNG";
    case "webp":
      return "WEBP";
    case "svg":
      return "SVG";
    case "tiff":
      return "TIFF";
    default:
      return "OTHER";
  }
}

export interface MeasureResult {
  readonly facts: ImageFacts;
  readonly hash: string;
}

export interface ProductionRenderInput {
  readonly source: Buffer;
  readonly isVector: boolean;
  readonly dpi: number;
  readonly printWidthMm: number;
  readonly printHeightMm: number;
  readonly rotationDeg: number;
}

export interface ProductionRenderResult {
  readonly buffer: Buffer;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Physical size of the rendered (possibly rotated) artwork bounding box. */
  readonly boundingWidthMm: number;
  readonly boundingHeightMm: number;
  readonly format: "PNG";
}

export interface MockupRenderInput {
  readonly productionPng: Buffer;
  readonly product: Product;
  readonly area: PrintArea;
  readonly hex: string;
  readonly placement: Placement;
  readonly maxWidthMm: number;
  readonly maxHeightMm: number;
  readonly boundingWidthMm: number;
  readonly boundingHeightMm: number;
}

export interface MockupRenderResult {
  readonly buffer: Buffer;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly format: "PNG";
}

export interface ImageProcessor {
  measure(data: Buffer): Promise<MeasureResult>;
  generateProduction(input: ProductionRenderInput): Promise<ProductionRenderResult>;
  generateMockup(input: MockupRenderInput): Promise<MockupRenderResult>;
}

const MOCKUP_W = 800;
const MOCKUP_H = Math.round((MOCKUP_W * 120) / 100);

export class SharpImageProcessor implements ImageProcessor {
  async measure(data: Buffer): Promise<MeasureResult> {
    const hash = createHash("sha256").update(data).digest("hex");
    const meta = await sharp(data).metadata();
    const format = mapFormat(meta.format);
    const facts: ImageFacts = {
      widthPx: meta.width ?? 0,
      heightPx: meta.height ?? 0,
      format,
      fileSizeBytes: data.byteLength,
      hasAlpha: format === "SVG" ? true : (meta.hasAlpha ?? false),
      isVector: format === "SVG",
    };
    return { facts, hash };
  }

  async generateProduction(
    input: ProductionRenderInput,
  ): Promise<ProductionRenderResult> {
    const targetW = mmToPx(input.printWidthMm, input.dpi);
    const targetH = mmToPx(input.printHeightMm, input.dpi);

    let pipeline = sharp(input.source, {
      // Rasterise vectors at (at least) the target DPI so they stay crisp (§7).
      density: input.isVector ? Math.max(72, input.dpi) : undefined,
    })
      .resize(targetW, targetH, { fit: "fill" })
      .ensureAlpha();

    const rot = ((input.rotationDeg % 360) + 360) % 360;
    if (rot !== 0) {
      pipeline = pipeline.rotate(rot, {
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }

    const { data, info } = await pipeline.png().toBuffer({ resolveWithObject: true });
    return {
      buffer: data,
      widthPx: info.width,
      heightPx: info.height,
      boundingWidthMm: pxToMm(info.width, input.dpi),
      boundingHeightMm: pxToMm(info.height, input.dpi),
      format: "PNG",
    };
  }

  async generateMockup(input: MockupRenderInput): Promise<MockupRenderResult> {
    const base = sharp(
      Buffer.from(
        garmentSvgString(input.product.category, input.hex, MOCKUP_W, MOCKUP_H),
      ),
    ).png();

    const box = input.area.mockupBox;
    const areaPxW = box.widthPct * MOCKUP_W;
    const areaPxH = box.heightPct * MOCKUP_H;
    const areaLeft = box.xPct * MOCKUP_W;
    const areaTop = box.yPct * MOCKUP_H;

    const pxPerMmX = areaPxW / input.maxWidthMm;
    const pxPerMmY = areaPxH / input.maxHeightMm;

    const artPxW = Math.max(1, Math.round(input.boundingWidthMm * pxPerMmX));
    const artPxH = Math.max(1, Math.round(input.boundingHeightMm * pxPerMmY));

    const centerX = areaLeft + input.placement.posXFrac * areaPxW;
    const centerY = areaTop + input.placement.posYFrac * areaPxH;

    let left = Math.round(centerX - artPxW / 2);
    let top = Math.round(centerY - artPxH / 2);
    left = Math.max(0, Math.min(MOCKUP_W - artPxW, left));
    top = Math.max(0, Math.min(MOCKUP_H - artPxH, top));

    const overlay = await sharp(input.productionPng)
      .resize(artPxW, artPxH, { fit: "fill" })
      .png()
      .toBuffer();

    const { data, info } = await base
      .composite([{ input: overlay, left, top }])
      .png()
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      widthPx: info.width,
      heightPx: info.height,
      format: "PNG",
    };
  }
}
