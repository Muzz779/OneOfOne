/**
 * Image enhancement service (CLAUDE.md §6, §53).
 *
 * Abstracted behind an interface so a real AI super-resolution provider (§34C)
 * can replace the dev implementation without touching call sites. The dev
 * implementation performs a GENUINE high-quality Lanczos upscale — it really
 * increases pixel count, so nothing is faked (§53) — but it does NOT invent
 * detail the way AI super-resolution would, and it says so.
 */

import sharp from "sharp";

export interface EnhanceInput {
  readonly source: Buffer;
  readonly isVector: boolean;
  readonly targetWidthPx: number;
  readonly targetHeightPx: number;
}

export interface EnhanceResult {
  readonly buffer: Buffer;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly provider: string;
  /** Honest description surfaced to the user (§6 — never overclaim). */
  readonly note: string;
}

export interface EnhancementService {
  readonly name: string;
  enhance(input: EnhanceInput): Promise<EnhanceResult>;
}

export class DevUpscaleEnhancer implements EnhancementService {
  readonly name = "dev-lanczos-upscaler";

  async enhance(input: EnhanceInput): Promise<EnhanceResult> {
    const { data, info } = await sharp(input.source, {
      density: input.isVector ? 300 : undefined,
    })
      .resize(input.targetWidthPx, input.targetHeightPx, {
        fit: "fill",
        kernel: "lanczos3",
      })
      .png()
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      widthPx: info.width,
      heightPx: info.height,
      provider: this.name,
      note: "Upscaled with a high-quality Lanczos filter (development enhancer). This increases resolution but does not reconstruct detail that isn't there — replace with an AI super-resolution provider in production.",
    };
  }
}
