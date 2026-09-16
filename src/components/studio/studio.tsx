"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getActivePrinterSpec } from "@/config/printer";
import { analyzeArtwork, type QualityState } from "@/lib/print/analysis";
import { areaBounds, aspectOf, printBoxFor } from "@/lib/print/design-calc";
import { clampCenterMm, DEFAULT_PLACEMENT, type Placement } from "@/lib/print/placement";
import { runPreflight, type CheckStatus } from "@/lib/print/preflight";
import { formatZar, type PriceBreakdown } from "@/domain/pricing";
import { getProductById, SEED_PRODUCTS, type PrintSide } from "@/domain/products";
import { ACCEPTED_UPLOAD_TYPES } from "@/lib/print/measure-client";
import type { DesignDTO, ProcessingNote } from "@/lib/dto";
import { GarmentEditor } from "./editor";

const spec = getActivePrinterSpec();

const QUALITY_STYLE: Record<QualityState, { className: string; label: string }> = {
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

export function Studio({ initialDesignId }: { initialDesignId?: string }) {
  const router = useRouter();
  const [design, setDesign] = useState<DesignDTO | null>(null);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const [side, setSide] = useState<PrintSide>("FRONT");
  const [productId, setProductId] = useState(SEED_PRODUCTS[0].id);
  const [colourName, setColourName] = useState(SEED_PRODUCTS[0].colours[0].name);
  const [size, setSize] = useState("M");
  const [quantity, setQuantity] = useState(1);

  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<ProcessingNote | null>(null);
  const [quote, setQuote] = useState<PriceBreakdown | null>(null);

  const hydrating = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const product = useMemo(
    () => getProductById(productId) ?? SEED_PRODUCTS[0],
    [productId],
  );
  const bounds = useMemo(() => areaBounds(product, side, spec), [product, side]);
  const colour = useMemo(
    () => product.colours.find((c) => c.name === colourName) ?? product.colours[0],
    [product, colourName],
  );

  const applyDesign = useCallback((dto: DesignDTO, processingNote?: ProcessingNote) => {
    hydrating.current = true;
    setDesign(dto);
    setPlacement(dto.placement);
    setSide(dto.side);
    setProductId(dto.productId);
    setColourName(dto.colour);
    setSize(dto.size);
    setNote(processingNote ?? null);
    // Release the hydration guard after state settles.
    setTimeout(() => (hydrating.current = false), 0);
  }, []);

  // Resume an existing design (§12).
  useEffect(() => {
    if (!initialDesignId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/designs/${initialDesignId}`);
        if (!res.ok) return;
        const dto = (await res.json()) as DesignDTO;
        if (alive) applyDesign(dto);
      } catch {
        /* ignore resume failures */
      }
    })();
    return () => {
      alive = false;
    };
  }, [initialDesignId, applyDesign]);

  const aspect = design ? aspectOf(design.facts) : 1;
  const printBox = useMemo(
    () => printBoxFor(aspect, placement.sizeFrac, bounds.maxWidthMm, bounds.maxHeightMm),
    [aspect, placement.sizeFrac, bounds.maxWidthMm, bounds.maxHeightMm],
  );

  const clampedPlacement = useMemo<Placement>(() => {
    const { xMm, yMm } = clampCenterMm(
      placement.posXFrac * bounds.maxWidthMm,
      placement.posYFrac * bounds.maxHeightMm,
      printBox.widthMm,
      printBox.heightMm,
      placement.rotationDeg,
      bounds.maxWidthMm,
      bounds.maxHeightMm,
    );
    return { ...placement, posXFrac: xMm / bounds.maxWidthMm, posYFrac: yMm / bounds.maxHeightMm };
  }, [placement, printBox, bounds]);

  const analysis = useMemo(
    () => (design ? analyzeArtwork(design.facts, printBox, spec) : null),
    [design, printBox],
  );
  const preflight = useMemo(
    () =>
      design
        ? runPreflight(
            design.facts,
            { side, print: printBox, outputFormat: spec.fileFormat },
            product,
            spec,
          )
        : null,
    [design, printBox, side, product],
  );

  // Debounced autosave + re-quote (§12, §16). Skips the hydration pass.
  useEffect(() => {
    if (!design || hydrating.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/designs/${design.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, side, colour: colourName, size, placement: clampedPlacement }),
        });
        const q = await fetch(`/api/designs/${design.id}/quote?method=PUDO`);
        if (q.ok) setQuote((await q.json()) as PriceBreakdown);
      } catch {
        /* autosave is best-effort */
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [design, productId, side, colourName, size, clampedPlacement]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setBusy(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/designs", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed.");
        applyDesign(data as DesignDTO);
        router.replace(`/studio?design=${(data as DesignDTO).id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "We couldn't process that image.");
      } finally {
        setBusy(false);
      }
    },
    [applyDesign, router],
  );

  const runProcess = useCallback(
    async (endpoint: "enhance" | "background") => {
      if (!design) return;
      setProcessing(true);
      setError(null);
      try {
        const res = await fetch(`/api/designs/${design.id}/${endpoint}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Processing failed.");
        const dto = data as DesignDTO;
        applyDesign(dto, dto.lastProcessing);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Processing failed.");
      } finally {
        setProcessing(false);
      }
    },
    [design, applyDesign],
  );

  const addToCart = useCallback(async () => {
    if (!design) return;
    setAdding(true);
    setError(null);
    try {
      // Persist the latest editor state before ordering.
      await fetch(`/api/designs/${design.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, side, colour: colourName, size, placement: clampedPlacement }),
      });
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: design.id, size, colour: colourName, quantity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't add to cart.");
      router.push("/cart");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add to cart.");
    } finally {
      setAdding(false);
    }
  }, [design, productId, side, colourName, size, quantity, clampedPlacement, router]);

  const canOrder = analysis ? analysis.quality !== "TOO_LOW" && preflight?.result === "PASS" : false;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <p className="badge-raw bg-volt text-ink">Design Studio</p>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">
          Upload anything. We&apos;ll tell you if it&apos;s print-ready.
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Drop in a photo or a logo. We measure the real resolution at your chosen
          print size — no Photoshop, no DPI knowledge needed.
        </p>
      </header>

      {error && (
        <p className="mb-4 border-2 border-danger bg-danger/10 px-3 py-2 font-semibold text-danger">
          {error}
        </p>
      )}

      {!design ? (
        <Dropzone busy={busy} onFile={handleFile} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <section className="space-y-6">
            <div className="card-raw p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Your artwork</h2>
                <button
                  type="button"
                  onClick={() => {
                    setDesign(null);
                    setPlacement(DEFAULT_PLACEMENT);
                    setQuote(null);
                    router.replace("/studio");
                  }}
                  className="badge-raw bg-paper hover:bg-accent hover:text-white"
                >
                  Replace
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={design.workingUrl}
                alt="Uploaded artwork"
                className="mx-auto max-h-[300px] w-auto border-2 border-ink bg-[repeating-conic-gradient(#e9e5db_0%_25%,#f4f1ea_0%_50%)] bg-[length:24px_24px]"
              />
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-muted sm:grid-cols-4">
                <Meta label="Pixels" value={`${design.facts.widthPx}×${design.facts.heightPx}`} />
                <Meta label="Type" value={design.facts.format} />
                <Meta label="Alpha" value={design.facts.isVector ? "vector" : design.facts.hasAlpha ? "yes" : "no"} />
                <Meta label="Version" value={`v${design.version}`} />
              </dl>
            </div>

            <GarmentEditor
              product={product}
              area={bounds.area}
              hex={colour.hex}
              previewUrl={design.workingUrl}
              maxWidthMm={bounds.maxWidthMm}
              maxHeightMm={bounds.maxHeightMm}
              printBox={printBox}
              placement={clampedPlacement}
              onChange={setPlacement}
            />
          </section>

          <aside className="space-y-6">
            {/* Garment */}
            <div className="card-raw p-4">
              <h2 className="mb-3 font-display text-lg font-bold">Garment</h2>
              <Field label="Product">
                <select
                  value={productId}
                  onChange={(e) => {
                    const next = getProductById(e.target.value)!;
                    setProductId(next.id);
                    if (!next.printSides.includes(side)) setSide(next.printSides[0]);
                    if (!next.colours.some((c) => c.name === colourName)) setColourName(next.colours[0].name);
                    if (!next.sizes.includes(size as (typeof next.sizes)[number])) setSize(next.sizes[1] ?? next.sizes[0]);
                  }}
                  className="w-full border-2 border-ink bg-paper px-3 py-2 font-semibold"
                >
                  {SEED_PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatZar(p.basePriceCents)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Print side">
                <div className="flex flex-wrap gap-2">
                  {product.printSides.map((s) => (
                    <Toggle key={s} active={side === s} onClick={() => setSide(s)} label={s.replace("_", " ")} />
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
                      aria-label={c.name}
                      className={`h-8 w-8 border-2 border-ink ${colourName === c.name ? "shadow-[3px_3px_0_0_var(--ink)]" : ""}`}
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Size">
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full border-2 border-ink bg-paper px-3 py-2 font-semibold"
                  >
                    {product.sizes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                    className="w-full border-2 border-ink bg-paper px-3 py-2 font-semibold"
                  />
                </Field>
              </div>
              <Field label={`Print size — ${cm(printBox.widthMm)} × ${cm(printBox.heightMm)}`}>
                <input
                  type="range"
                  min={12}
                  max={100}
                  value={Math.round(placement.sizeFrac * 100)}
                  onChange={(e) => setPlacement((p) => ({ ...p, sizeFrac: Number(e.target.value) / 100 }))}
                  className="w-full accent-[color:var(--accent)]"
                  aria-label="Print size"
                />
              </Field>
            </div>

            {/* Make it print-ready */}
            <div className="card-raw p-4">
              <h2 className="mb-3 font-display text-lg font-bold">Make it print-ready</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => runProcess("enhance")}
                  className="border-2 border-ink bg-paper px-3 py-2 text-sm font-bold hover:bg-volt disabled:opacity-50"
                >
                  {processing ? "Working…" : "Enhance resolution"}
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => runProcess("background")}
                  className="border-2 border-ink bg-paper px-3 py-2 text-sm font-bold hover:bg-volt disabled:opacity-50"
                >
                  {processing ? "Working…" : "Remove background"}
                </button>
              </div>
              {note && (
                <p className="mt-3 border-2 border-ink bg-paper-2 p-2 text-xs text-muted">
                  <span className="font-mono font-bold text-ink">{note.provider}</span> · {note.note}
                </p>
              )}
            </div>

            {/* Quality */}
            {analysis && (
              <div className="card-raw p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold">Print quality</h2>
                  <span className={`badge-raw ${QUALITY_STYLE[analysis.quality].className}`}>
                    {QUALITY_STYLE[analysis.quality].label}
                  </span>
                </div>
                <p className="text-sm">{analysis.message}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs">
                  <Meta label="Effective DPI" value={analysis.isVector ? "∞ (vector)" : `${Math.floor(analysis.effectiveDpi)}`} />
                  <Meta label="Target DPI" value={`${spec.dpi}`} />
                  <Meta label="Production px" value={`${analysis.requiredWidthPx}×${analysis.requiredHeightPx}`} />
                  <Meta label="Format" value={spec.fileFormat} />
                </dl>
              </div>
            )}

            {/* Preflight + order */}
            {preflight && (
              <div className="card-raw p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold">Preflight</h2>
                  <span className={`badge-raw ${preflight.result === "PASS" ? "bg-ok text-white" : "bg-danger text-white"}`}>
                    {preflight.result}
                  </span>
                </div>
                <ul className="space-y-2">
                  {preflight.checks.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 text-sm">
                      <span className={`badge-raw shrink-0 ${CHECK_STYLE[c.status]}`}>{c.status}</span>
                      <span>
                        <span className="font-semibold">{c.label}. </span>
                        <span className="text-muted">{c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {quote && (
                  <p className="mt-4 flex items-baseline justify-between border-t-2 border-ink pt-3">
                    <span className="font-semibold">This item</span>
                    <span className="font-display text-2xl font-bold">
                      {formatZar(quote.lines[0]?.unitPriceCents ?? 0)}
                    </span>
                  </p>
                )}
                <button
                  type="button"
                  disabled={!canOrder || adding}
                  onClick={addToCart}
                  className="btn-raw mt-3 w-full disabled:bg-muted"
                >
                  {adding ? "Adding…" : canOrder ? "Add to cart" : "Fix the issues above to continue"}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      {children}
    </div>
  );
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-2 border-ink px-3 py-1.5 text-sm font-bold capitalize ${
        active ? "bg-ink text-paper shadow-[3px_3px_0_0_var(--accent)]" : "bg-paper hover:bg-paper-2"
      }`}
    >
      {label.toLowerCase()}
    </button>
  );
}

function Dropzone({ busy, onFile }: { busy: boolean; onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
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
      className={`card-raw grid place-items-center px-6 py-16 text-center transition-transform ${dragging ? "translate-x-[-2px] translate-y-[-2px] bg-volt/30" : ""}`}
    >
      <div className="max-w-md">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center border-2 border-ink bg-accent text-2xl text-white shadow-[3px_3px_0_0_var(--ink)]">↑</div>
        <h2 className="font-display text-2xl font-bold">Drop your image here</h2>
        <p className="mt-2 text-muted">
          JPG, PNG, WEBP or SVG · up to 25MB. A photo straight off your phone is fine — we&apos;ll check if it&apos;s big enough.
        </p>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="btn-raw mt-5">
          {busy ? "Uploading…" : "Choose a file"}
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
  );
}
