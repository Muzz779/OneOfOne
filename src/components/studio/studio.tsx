"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getActivePrinterSpec } from "@/config/printer";
import {
  analyzeArtwork,
  type ImageFacts,
  type QualityState,
} from "@/lib/print/analysis";
import {
  ACCEPTED_UPLOAD_TYPES,
  measureImageFacts,
  type MeasureError,
} from "@/lib/print/measure-client";
import {
  clampCenterMm,
  DEFAULT_PLACEMENT,
  fitWithin,
  type Placement,
} from "@/lib/print/placement";
import { runPreflight, type CheckStatus } from "@/lib/print/preflight";
import {
  getPrintArea,
  SEED_PRODUCTS,
  type PrintSide,
} from "@/domain/products";
import { GarmentEditor } from "./editor";

const spec = getActivePrinterSpec();

const QUALITY_STYLE: Record<
  QualityState,
  { className: string; label: string }
> = {
  EXCELLENT: { className: "bg-ok text-white", label: "Excellent" },
  GOOD: { className: "bg-good text-white", label: "Good" },
  NEEDS_ENHANCEMENT: { className: "bg-warn text-ink", label: "Needs enhancement" },
  TOO_LOW: { className: "bg-danger text-white", label: "Too low quality" },
};

const CHECK_STYLE: Record<CheckStatus, string> = {
  PASS: "bg-ok text-white",
  WARN: "bg-warn text-ink",
  FAIL: "bg-danger text-white",
};

function cm(mm: number): string {
  return `${(mm / 10).toFixed(1)}cm`;
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function Studio() {
  const [file, setFile] = useState<File | null>(null);
  const [facts, setFacts] = useState<ImageFacts | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [productId, setProductId] = useState(SEED_PRODUCTS[0].id);
  const [side, setSide] = useState<PrintSide>("FRONT");
  const [colourName, setColourName] = useState(SEED_PRODUCTS[0].colours[0].name);
  // Artwork placement (size/position/rotation) is stored relative to the
  // printable area, so switching product/side rescales it automatically — no
  // effect needed. See Placement in lib/print/placement.ts.
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);

  const product = useMemo(
    () => SEED_PRODUCTS.find((p) => p.id === productId)!,
    [productId],
  );
  const area = useMemo(
    () => getPrintArea(product, side) ?? product.printAreas[0],
    [product, side],
  );
  const colour = useMemo(
    () => product.colours.find((c) => c.name === colourName) ?? product.colours[0],
    [product, colourName],
  );

  // Effective maximums = min(product print area, printer bed).
  const maxWidthMm = Math.min(area.maxWidthMm, spec.maxPrintWidthMm);
  const maxHeightMm = Math.min(area.maxHeightMm, spec.maxPrintHeightMm);
  const aspect = facts && facts.heightPx > 0 ? facts.widthPx / facts.heightPx : 1;

  // Switching product may invalidate the selected side/colour — correct it in
  // the event handler (not an effect) so there is no cascading re-render.
  const handleProductChange = useCallback((nextId: string) => {
    const next = SEED_PRODUCTS.find((p) => p.id === nextId);
    if (!next) return;
    setProductId(nextId);
    setSide((prev) =>
      next.printSides.includes(prev) ? prev : next.printSides[0],
    );
    setColourName((prev) =>
      next.colours.some((c) => c.name === prev) ? prev : next.colours[0].name,
    );
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = useCallback(
    async (f: File) => {
      setError(null);
      setBusy(true);
      try {
        const measured = await measureImageFacts(f);
        setFile(f);
        setFacts(measured);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(f);
        });
      } catch (e) {
        const me = e as MeasureError;
        setError(me?.message ?? "We couldn't process that image.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const printBox = useMemo(() => {
    if (!facts) return null;
    const fit = fitWithin(aspect, maxWidthMm, maxHeightMm);
    const f = placement.sizeFrac;
    return { widthMm: fit.widthMm * f, heightMm: fit.heightMm * f };
  }, [facts, placement.sizeFrac, aspect, maxWidthMm, maxHeightMm]);

  // Position clamped so the (possibly rotated) artwork stays inside the area,
  // re-derived whenever size/side/product change (§9). Editing produces a raw
  // placement; this memo is the single clamped truth used for render/preflight.
  const clampedPlacement = useMemo<Placement>(() => {
    if (!printBox) return placement;
    const { xMm, yMm } = clampCenterMm(
      placement.posXFrac * maxWidthMm,
      placement.posYFrac * maxHeightMm,
      printBox.widthMm,
      printBox.heightMm,
      placement.rotationDeg,
      maxWidthMm,
      maxHeightMm,
    );
    return {
      ...placement,
      posXFrac: xMm / maxWidthMm,
      posYFrac: yMm / maxHeightMm,
    };
  }, [placement, printBox, maxWidthMm, maxHeightMm]);

  const analysis = useMemo(() => {
    if (!facts || !printBox) return null;
    return analyzeArtwork(facts, printBox, spec);
  }, [facts, printBox]);

  const preflight = useMemo(() => {
    if (!facts || !printBox) return null;
    return runPreflight(
      facts,
      { side, print: printBox, outputFormat: spec.fileFormat },
      product,
      spec,
    );
  }, [facts, printBox, side, product]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <p className="badge-raw bg-volt text-ink">Design Studio</p>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">
          Upload anything. We&apos;ll tell you if it&apos;s print-ready.
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Drop in a photo or a logo. We measure the real resolution at your
          chosen print size — no Photoshop, no DPI knowledge needed.
        </p>
      </header>

      {!facts ? (
        <Dropzone busy={busy} error={error} onFile={handleFile} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          {/* LEFT — preview + scale-on-garment */}
          <section className="space-y-6">
            <div className="card-raw p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Your artwork</h2>
                <button
                  type="button"
                  onClick={() => {
                    setFacts(null);
                    setFile(null);
                    setError(null);
                    setPreviewUrl((prev) => {
                      if (prev) URL.revokeObjectURL(prev);
                      return null;
                    });
                  }}
                  className="badge-raw bg-paper hover:bg-accent hover:text-white"
                >
                  Replace
                </button>
              </div>
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={file?.name ?? "Uploaded artwork"}
                  className="mx-auto max-h-[340px] w-auto border-2 border-ink bg-[repeating-conic-gradient(#e9e5db_0%_25%,#f4f1ea_0%_50%)] bg-[length:24px_24px]"
                />
              )}
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-muted sm:grid-cols-4">
                <Meta label="Pixels" value={`${facts.widthPx}×${facts.heightPx}`} />
                <Meta label="Type" value={facts.format} />
                <Meta label="Size" value={bytes(facts.fileSizeBytes)} />
                <Meta
                  label="Alpha"
                  value={facts.isVector ? "vector" : facts.hasAlpha ? "yes" : "no"}
                />
              </dl>
            </div>

            {printBox && (
              <GarmentEditor
                product={product}
                area={area}
                hex={colour.hex}
                previewUrl={previewUrl}
                maxWidthMm={maxWidthMm}
                maxHeightMm={maxHeightMm}
                printBox={printBox}
                placement={clampedPlacement}
                onChange={setPlacement}
              />
            )}
          </section>

          {/* RIGHT — controls + intelligence */}
          <aside className="space-y-6">
            <div className="card-raw p-4">
              <h2 className="mb-3 font-display text-lg font-bold">Garment</h2>
              <Field label="Product">
                <select
                  value={productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full border-2 border-ink bg-paper px-3 py-2 font-semibold"
                >
                  {SEED_PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — R{(p.basePriceCents / 100).toFixed(0)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Print side">
                <div className="flex flex-wrap gap-2">
                  {product.printSides.map((s) => (
                    <Toggle
                      key={s}
                      active={side === s}
                      onClick={() => setSide(s)}
                      label={s.replace("_", " ")}
                    />
                  ))}
                </div>
              </Field>

              <Field label="Colour">
                <div className="flex flex-wrap gap-2">
                  {product.colours.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setColourName(c.name)}
                      title={c.name}
                      className={`h-8 w-8 border-2 border-ink ${
                        colourName === c.name
                          ? "shadow-[3px_3px_0_0_var(--ink)]"
                          : ""
                      }`}
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
              </Field>

              {printBox && (
                <Field
                  label={`Print size — ${cm(printBox.widthMm)} × ${cm(printBox.heightMm)}`}
                >
                  <input
                    type="range"
                    min={12}
                    max={100}
                    value={Math.round(placement.sizeFrac * 100)}
                    onChange={(e) =>
                      setPlacement((p) => ({
                        ...p,
                        sizeFrac: Number(e.target.value) / 100,
                      }))
                    }
                    className="w-full accent-[color:var(--accent)]"
                    aria-label="Print size as a percentage of the printable area"
                  />
                  <p className="mt-1 font-mono text-xs text-muted">
                    Fits within the {area.label} area ({cm(maxWidthMm)} ×{" "}
                    {cm(maxHeightMm)})
                  </p>
                </Field>
              )}
            </div>

            {analysis && (
              <div className="card-raw p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold">Print quality</h2>
                  <span
                    className={`badge-raw ${QUALITY_STYLE[analysis.quality].className}`}
                  >
                    {QUALITY_STYLE[analysis.quality].label}
                  </span>
                </div>
                <p className="text-sm">{analysis.message}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs">
                  <Meta
                    label="Effective DPI"
                    value={
                      analysis.isVector
                        ? "∞ (vector)"
                        : `${Math.floor(analysis.effectiveDpi)}`
                    }
                  />
                  <Meta label="Target DPI" value={`${spec.dpi}`} />
                  <Meta
                    label="Production px"
                    value={`${analysis.requiredWidthPx}×${analysis.requiredHeightPx}`}
                  />
                  <Meta label="Format" value={spec.fileFormat} />
                </dl>
                {analysis.enhancementRecommended && (
                  <div className="mt-3 border-2 border-ink bg-warn/20 p-3 text-sm">
                    <p className="font-semibold">Enhancement recommended</p>
                    <p className="mt-1 text-muted">
                      AI enhancement can improve perceived detail for this size.
                      It won&apos;t invent real resolution — the original is always
                      kept.{" "}
                      <span className="font-mono text-xs">
                        (arrives in Phase 3)
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {preflight && (
              <div className="card-raw p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold">Preflight</h2>
                  <span
                    className={`badge-raw ${
                      preflight.result === "PASS"
                        ? "bg-ok text-white"
                        : "bg-danger text-white"
                    }`}
                  >
                    {preflight.result}
                  </span>
                </div>
                <ul className="space-y-2">
                  {preflight.checks.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 text-sm">
                      <span
                        className={`badge-raw shrink-0 ${CHECK_STYLE[c.status]}`}
                      >
                        {c.status}
                      </span>
                      <span>
                        <span className="font-semibold">{c.label}. </span>
                        <span className="text-muted">{c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled
                  className="btn-raw mt-4 w-full disabled:bg-muted"
                  title="Cart & checkout arrive in Phase 4"
                >
                  {preflight.result === "PASS"
                    ? "Looks print-ready — checkout (Phase 4)"
                    : "Fix the issues above to continue"}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      {children}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-2 border-ink px-3 py-1.5 text-sm font-bold capitalize ${
        active
          ? "bg-ink text-paper shadow-[3px_3px_0_0_var(--accent)]"
          : "bg-paper hover:bg-paper-2"
      }`}
    >
      {label.toLowerCase()}
    </button>
  );
}

function Dropzone({
  busy,
  error,
  onFile,
}: {
  busy: boolean;
  error: string | null;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`card-raw grid place-items-center px-6 py-16 text-center transition-transform ${
          dragging ? "translate-x-[-2px] translate-y-[-2px] bg-volt/30" : ""
        }`}
      >
        <div className="max-w-md">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center border-2 border-ink bg-accent text-2xl text-white shadow-[3px_3px_0_0_var(--ink)]">
            ↑
          </div>
          <h2 className="font-display text-2xl font-bold">
            Drop your image here
          </h2>
          <p className="mt-2 text-muted">
            JPG, PNG, WEBP or SVG · up to 25MB. A photo straight off your phone
            is fine — we&apos;ll check if it&apos;s big enough.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="btn-raw mt-5"
          >
            {busy ? "Reading image…" : "Choose a file"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_UPLOAD_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {error && (
        <p className="mt-3 border-2 border-danger bg-danger/10 px-3 py-2 font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
