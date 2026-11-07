"use client";

import { useState } from "react";

export function EmailTest({ connected }: { connected: boolean }) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send the test email.");
      setMsg({ ok: true, text: `Sent — check ${to} (and the spam folder).` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't send the test email." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="flex max-w-xl flex-wrap items-end gap-3">
      <label className="block min-w-0 flex-1">
        <span className="mb-1 block text-sm font-semibold">Send a test email to</span>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full border-2 border-ink bg-paper px-3 py-2 font-mono"
        />
      </label>
      <button type="submit" disabled={busy || !connected} className="btn-raw disabled:bg-muted">
        {busy ? "Sending…" : "Send test"}
      </button>
      <div role="status" aria-live="polite" className="w-full">
        {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}
