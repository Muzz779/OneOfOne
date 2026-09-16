/**
 * Preflight system (CLAUDE.md §23, §52, §53).
 *
 * Before an order may enter production, the intended production artwork is
 * checked against the printer specification and the product's printable area.
 * Returns an explicit PASS / FAIL plus a per-check breakdown so an admin never
 * has to guess whether a file is safe to print. No "print-ready" status may be
 * claimed without running this (§53).
 */

import type { PrinterSpec, ProductionFileFormat } from "@/config/printer";
import { getPrintArea, type PrintSide, type Product } from "@/domain/products";
import { computeEffectiveDpi, type ImageFacts, type PrintDimensionsMm } from "./analysis";

export type CheckStatus = "PASS" | "FAIL" | "WARN";

export interface PreflightCheck {
  readonly id: string;
  readonly label: string;
  readonly status: CheckStatus;
  readonly detail: string;
}

export interface PreflightResult {
  readonly result: "PASS" | "FAIL";
  readonly checks: readonly PreflightCheck[];
  /** Human-readable reasons for any FAILs (empty when PASS). */
  readonly failureReasons: readonly string[];
}

/** The concrete production output being flighted. */
export interface ProductionPlan {
  readonly side: PrintSide;
  /** Physical size the artwork will be printed at. */
  readonly print: PrintDimensionsMm;
  /** Format the production file will be generated in. */
  readonly outputFormat: ProductionFileFormat;
  /** Byte size of the generated production file, when known. */
  readonly productionFileSizeBytes?: number;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Run preflight for a proposed production plan. `facts` describes the artwork
 * that will be rendered (intrinsic pixels, alpha, vector-ness).
 */
export function runPreflight(
  facts: ImageFacts,
  plan: ProductionPlan,
  product: Product,
  spec: PrinterSpec,
): PreflightResult {
  const checks: PreflightCheck[] = [];
  const area = getPrintArea(product, plan.side);
  const effectiveDpi = facts.isVector
    ? Infinity
    : computeEffectiveDpi(facts, plan.print);

  // 1. Print side is valid for this product.
  checks.push(
    product.printSides.includes(plan.side)
      ? {
          id: "side_valid",
          label: "Print side",
          status: "PASS",
          detail: `${plan.side} is available on ${product.name}.`,
        }
      : {
          id: "side_valid",
          label: "Print side",
          status: "FAIL",
          detail: `${plan.side} is not a printable side on ${product.name}.`,
        },
  );

  // 2. Artwork fits inside the garment's printable area.
  if (!area) {
    checks.push({
      id: "within_print_area",
      label: "Printable area",
      status: "FAIL",
      detail: `No printable area defined for ${plan.side} on ${product.name}.`,
    });
  } else {
    const fits =
      plan.print.widthMm <= area.maxWidthMm + 1e-6 &&
      plan.print.heightMm <= area.maxHeightMm + 1e-6;
    checks.push({
      id: "within_print_area",
      label: "Printable area",
      status: fits ? "PASS" : "FAIL",
      detail: fits
        ? `${round(plan.print.widthMm)}×${round(plan.print.heightMm)}mm fits the ${area.label} area (${area.maxWidthMm}×${area.maxHeightMm}mm).`
        : `${round(plan.print.widthMm)}×${round(plan.print.heightMm)}mm exceeds the ${area.label} area (${area.maxWidthMm}×${area.maxHeightMm}mm).`,
    });
  }

  // 3. Within the printer's physical bed.
  const withinBed =
    plan.print.widthMm <= spec.maxPrintWidthMm + 1e-6 &&
    plan.print.heightMm <= spec.maxPrintHeightMm + 1e-6;
  checks.push({
    id: "within_printer_bed",
    label: "Printer bed size",
    status: withinBed ? "PASS" : "FAIL",
    detail: withinBed
      ? `Within the printer max of ${spec.maxPrintWidthMm}×${spec.maxPrintHeightMm}mm.`
      : `Exceeds the printer max of ${spec.maxPrintWidthMm}×${spec.maxPrintHeightMm}mm.`,
  });

  // 4. Effective resolution.
  if (facts.isVector) {
    checks.push({
      id: "effective_dpi",
      label: "Resolution",
      status: "PASS",
      detail: "Vector artwork scales without resolution loss.",
    });
  } else if (effectiveDpi < spec.minEffectiveDpi) {
    checks.push({
      id: "effective_dpi",
      label: "Resolution",
      status: "FAIL",
      detail: `Effective ${Math.floor(effectiveDpi)} DPI is below the minimum ${spec.minEffectiveDpi} DPI for this size.`,
    });
  } else if (effectiveDpi < spec.dpi) {
    checks.push({
      id: "effective_dpi",
      label: "Resolution",
      status: "WARN",
      detail: `Effective ${Math.floor(effectiveDpi)} DPI is printable but below the ${spec.dpi} DPI target.`,
    });
  } else {
    checks.push({
      id: "effective_dpi",
      label: "Resolution",
      status: "PASS",
      detail: `Effective ${Math.floor(effectiveDpi)} DPI meets the ${spec.dpi} DPI target.`,
    });
  }

  // 5. Output format matches the printer spec.
  checks.push(
    plan.outputFormat === spec.fileFormat
      ? {
          id: "format_supported",
          label: "File format",
          status: "PASS",
          detail: `${plan.outputFormat} matches the printer requirement.`,
        }
      : {
          id: "format_supported",
          label: "File format",
          status: "FAIL",
          detail: `Printer requires ${spec.fileFormat}, plan produces ${plan.outputFormat}.`,
        },
  );

  // 6. Transparency handling (§8 — never accidentally flatten alpha).
  if (spec.requiresTransparency) {
    const preserves = plan.outputFormat === "PNG" || plan.outputFormat === "TIFF" || plan.outputFormat === "SVG";
    checks.push({
      id: "transparency",
      label: "Transparency",
      status: preserves ? "PASS" : "FAIL",
      detail: preserves
        ? "Output format preserves transparency."
        : `${plan.outputFormat} cannot preserve the required transparency.`,
    });
  }

  // 7. File size within limits (only when the file has been generated).
  if (plan.productionFileSizeBytes != null) {
    const withinSize = plan.productionFileSizeBytes <= spec.maxFileSizeBytes;
    checks.push({
      id: "file_size",
      label: "File size",
      status: withinSize ? "PASS" : "FAIL",
      detail: withinSize
        ? `${(plan.productionFileSizeBytes / (1024 * 1024)).toFixed(1)}MB is within the ${(spec.maxFileSizeBytes / (1024 * 1024)).toFixed(0)}MB limit.`
        : `${(plan.productionFileSizeBytes / (1024 * 1024)).toFixed(1)}MB exceeds the ${(spec.maxFileSizeBytes / (1024 * 1024)).toFixed(0)}MB limit.`,
    });
  }

  const failing = checks.filter((c) => c.status === "FAIL");
  return {
    result: failing.length === 0 ? "PASS" : "FAIL",
    checks,
    failureReasons: failing.map((c) => c.detail),
  };
}
