/**
 * Background removal service (CLAUDE.md §8, §53).
 *
 * Interface-abstracted. The dev implementation performs REAL colour-key removal
 * of a near-uniform background sampled from the image corners — it genuinely
 * produces transparency, so it is not faked (§53) — but it only handles simple,
 * solid backgrounds and says so. Swap in an ML segmentation provider for complex
 * photos in production. Transparency is preserved (never flattened, §8).
 */

import sharp from "sharp";

export interface BackgroundRemovalInput {
  readonly source: Buffer;
  /** 0–255 colour distance threshold; higher removes more. */
  readonly threshold?: number;
}

export interface BackgroundRemovalResult {
  readonly buffer: Buffer;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly provider: string;
  readonly note: string;
  /** Fraction of pixels made transparent — lets callers detect a no-op. */
  readonly removedFraction: number;
}

export interface BackgroundRemovalService {
  readonly name: string;
  removeBackground(
    input: BackgroundRemovalInput,
  ): Promise<BackgroundRemovalResult>;
}

export class DevColorKeyRemover implements BackgroundRemovalService {
  readonly name = "dev-colour-key";

  async removeBackground(
    input: BackgroundRemovalInput,
  ): Promise<BackgroundRemovalResult> {
    const threshold = input.threshold ?? 32;
    const { data, info } = await sharp(input.source)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    // Sample the four corners as the presumed background colour.
    const corners = [
      0,
      (width - 1) * channels,
      (height - 1) * width * channels,
      ((height - 1) * width + (width - 1)) * channels,
    ];
    let br = 0;
    let bg = 0;
    let bb = 0;
    for (const c of corners) {
      br += data[c];
      bg += data[c + 1];
      bb += data[c + 2];
    }
    br /= corners.length;
    bg /= corners.length;
    bb /= corners.length;

    let removed = 0;
    const total = width * height;
    const thrSq = threshold * threshold;
    for (let i = 0; i < data.length; i += channels) {
      const dr = data[i] - br;
      const dg = data[i + 1] - bg;
      const db = data[i + 2] - bb;
      if (dr * dr + dg * dg + db * db <= thrSq) {
        data[i + 3] = 0; // alpha out
        removed++;
      }
    }

    const out = await sharp(data, { raw: { width, height, channels } })
      .png()
      .toBuffer();

    return {
      buffer: out,
      widthPx: width,
      heightPx: height,
      provider: this.name,
      note: "Removed a near-uniform background by colour key (development). Works best on solid/plain backgrounds — replace with an ML segmentation provider for complex photos.",
      removedFraction: total > 0 ? removed / total : 0,
    };
  }
}
