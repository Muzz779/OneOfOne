/**
 * Central Printer Specification Contract (CLAUDE.md §2, §24, §52).
 *
 * This is the single source of truth for the printer's production requirements.
 * The rest of the application MUST consume this configuration rather than
 * duplicating printer-specific assumptions. To change printer behaviour
 * (DPI, format, max dimensions, colour mode, ...) edit the active spec here.
 *
 * NOTE (§50): the target DPI is intentionally configurable, not hard-coded as
 * an absolute "300 DPI = correct" rule. Confirm the real value with the printer
 * (§58) before production launch.
 */

export type PrintTechnology = "DTF" | "DTG" | "SUBLIMATION" | "SCREEN" | "OTHER";
export type ProductionFileFormat = "PNG" | "PDF" | "SVG" | "TIFF" | "OTHER";
export type ColorMode = "RGB" | "CMYK" | "OTHER";

export interface PrinterSpec {
  /** Human label for the active printer/profile. */
  readonly id: string;
  readonly label: string;

  /** Printing technology (drives colour mode / transparency expectations). */
  readonly technology: PrintTechnology;

  /** Required production file format. */
  readonly fileFormat: ProductionFileFormat;

  /** Target output resolution the production file is generated at. */
  readonly dpi: number;

  /**
   * Minimum effective resolution (at the selected physical size) below which
   * artwork is considered unreliable to print (§5 "Too Low Quality").
   */
  readonly minEffectiveDpi: number;

  /** Maximum printable dimensions of the printer hardware, in millimetres. */
  readonly maxPrintWidthMm: number;
  readonly maxPrintHeightMm: number;

  /** Bleed required around artwork, in millimetres (0 if none). */
  readonly bleedMm: number;

  readonly colorMode: ColorMode;
  /** ICC/colour profile name where applicable (e.g. sublimation). */
  readonly colorProfile?: string;

  /** Whether the production file must preserve transparency (true for DTF/DTG). */
  readonly requiresTransparency: boolean;

  /** Whether front/back artwork must be delivered as separate files. */
  readonly separateFrontBack: boolean;

  /** Maximum accepted production file size, in bytes. */
  readonly maxFileSizeBytes: number;

  /** Vector formats the printer workflow accepts natively (§7). */
  readonly acceptedVectorFormats: readonly string[];

  /**
   * Production file naming convention (§22). Tokens are substituted by the
   * production-artwork generator: {order} {design} {version} {side}
   * {widthMm} {heightMm} {format} {dpi}.
   */
  readonly namingConvention: string;

  /** Free-text production notes surfaced to the admin/printer. */
  readonly productionNotes?: string;
}

/**
 * Quality thresholds, expressed as a ratio of the printer's target DPI.
 * Kept beside the spec so the "Excellent / Good" boundaries stay configurable
 * and out of the analysis code as magic numbers (§57.8).
 */
export interface QualityThresholds {
  /** effectiveDpi >= dpi * excellentRatio  → EXCELLENT */
  readonly excellentRatio: number;
  /** effectiveDpi >= dpi * goodRatio       → GOOD */
  readonly goodRatio: number;
  /** effectiveDpi >= minEffectiveDpi       → NEEDS_ENHANCEMENT, else TOO_LOW */
}

export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  excellentRatio: 1.0,
  goodRatio: 0.8,
};

/**
 * Active default printer profile.
 *
 * Indicative DTF (Direct-To-Film) setup — the common choice for South African
 * custom-apparel print-on-demand: full-colour, transparency-preserving, RGB
 * artwork on an A3-ish film bed. These are sensible defaults for development,
 * NOT confirmed production values — verify with the printer per §58.
 */
export const DEFAULT_PRINTER_SPEC: PrinterSpec = {
  id: "dtf-default",
  label: "DTF (default development profile)",
  technology: "DTF",
  fileFormat: "PNG",
  dpi: 300,
  minEffectiveDpi: 150,
  maxPrintWidthMm: 300, // ~A3 width
  maxPrintHeightMm: 400,
  bleedMm: 0,
  colorMode: "RGB",
  requiresTransparency: true,
  separateFrontBack: true,
  maxFileSizeBytes: 50 * 1024 * 1024, // 50 MB
  acceptedVectorFormats: ["SVG", "PDF"],
  namingConvention:
    "{order}_{design}_v{version}_{side}_{widthMm}x{heightMm}mm_{dpi}dpi.{format}",
  productionNotes:
    "Transparent PNG, RGB, 300 DPI. Preserve alpha — do not flatten onto white.",
};

/**
 * Resolve the active printer spec. Indirection point so this can later read
 * from admin configuration / database (§52) without touching call sites.
 */
export function getActivePrinterSpec(): PrinterSpec {
  return DEFAULT_PRINTER_SPEC;
}
