"use client";

import { useState } from "react";

/** A value with a one-tap copy button — for bank details on a phone. */
export function CopyValue({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the value is still selectable */
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink/20 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className={`select-all break-all font-mono ${emphasis ? "text-xl font-bold" : "font-semibold"}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="shrink-0 border-2 border-ink bg-paper px-2 py-1 text-xs font-bold hover:bg-paper-2"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
