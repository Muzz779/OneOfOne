/**
 * Client-side artwork measurement (CLAUDE.md §5, §36).
 *
 * Measures the intrinsic properties of an uploaded file in the browser so the
 * editor can give instant, responsive quality feedback (§36 keeps interaction
 * client-side). This is REAL measurement, not a guess — but it is not the
 * authoritative record: the same facts are re-derived server-side before an
 * order can enter production (§40, §53). No claim of print-readiness is made
 * here; that requires server preflight.
 */

import type { ImageFacts } from "./analysis";

export interface MeasureError {
  readonly code: "UNSUPPORTED_TYPE" | "TOO_LARGE" | "UNREADABLE";
  readonly message: string;
}

export const ACCEPTED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
] as const;

/** Generous client-side ceiling; the printer spec enforces production limits. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

function formatFromFile(file: File): ImageFacts["format"] {
  const t = file.type.toLowerCase();
  if (t === "image/jpeg") return "JPEG";
  if (t === "image/png") return "PNG";
  if (t === "image/webp") return "WEBP";
  if (t === "image/svg+xml") return "SVG";
  if (t === "image/tiff") return "TIFF";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "JPEG";
  if (ext === "png") return "PNG";
  if (ext === "webp") return "WEBP";
  if (ext === "svg") return "SVG";
  return "OTHER";
}

/** Parse intrinsic dimensions of an SVG from width/height or viewBox. */
async function measureSvg(file: File): Promise<ImageFacts> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;

  const parseLen = (v: string | null): number | null => {
    if (!v) return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  let width = parseLen(svg.getAttribute("width"));
  let height = parseLen(svg.getAttribute("height"));

  if ((!width || !height) && svg.getAttribute("viewBox")) {
    const parts = svg
      .getAttribute("viewBox")!
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4) {
      width = width || parts[2];
      height = height || parts[3];
    }
  }

  return {
    widthPx: Math.round(width || 1000),
    heightPx: Math.round(height || 1000),
    format: "SVG",
    fileSizeBytes: file.size,
    hasAlpha: true, // vector artwork composites over the garment
    isVector: true,
  };
}

/**
 * Detect whether a raster actually contains transparent pixels by scanning a
 * downscaled copy. JPEG never has alpha, so it short-circuits.
 */
function detectAlpha(
  bitmap: ImageBitmap,
  format: ImageFacts["format"],
): boolean {
  if (format === "JPEG") return false;
  const cap = 256;
  const scale = Math.min(1, cap / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return true;
  }
  return false;
}

/**
 * Measure an uploaded file into {@link ImageFacts}. Throws a {@link MeasureError}
 * on unsupported type, oversize, or unreadable content — the caller surfaces a
 * friendly message (§45).
 */
export async function measureImageFacts(file: File): Promise<ImageFacts> {
  const format = formatFromFile(file);

  if (
    !ACCEPTED_UPLOAD_TYPES.includes(
      file.type as (typeof ACCEPTED_UPLOAD_TYPES)[number],
    ) &&
    format === "OTHER"
  ) {
    throw {
      code: "UNSUPPORTED_TYPE",
      message:
        "That file type isn't supported. Upload a JPG, PNG, WEBP or SVG.",
    } satisfies MeasureError;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw {
      code: "TOO_LARGE",
      message: `That file is too large. Please keep uploads under ${Math.round(
        MAX_UPLOAD_BYTES / (1024 * 1024),
      )}MB.`,
    } satisfies MeasureError;
  }

  if (format === "SVG") {
    return measureSvg(file);
  }

  try {
    const bitmap = await createImageBitmap(file);
    const facts: ImageFacts = {
      widthPx: bitmap.width,
      heightPx: bitmap.height,
      format,
      fileSizeBytes: file.size,
      hasAlpha: detectAlpha(bitmap, format),
      isVector: false,
    };
    bitmap.close();
    return facts;
  } catch {
    throw {
      code: "UNREADABLE",
      message:
        "We couldn't read that image. Try uploading a different JPG, PNG, WEBP or SVG.",
    } satisfies MeasureError;
  }
}

/** Create/revoke object URLs for previewing the uploaded file. */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}
