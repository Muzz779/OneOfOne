"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@oneofone.co.za");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Incorrect email or password.");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card-raw mx-auto max-w-sm p-6">
      <h1 className="font-display text-2xl font-bold">Admin sign in</h1>
      <p className="mt-1 text-sm text-muted">
        Development auth. Seeded owner: <span className="font-mono">owner@oneofone.co.za</span>,
        password <span className="font-mono">letmein-dev</span>.
      </p>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-semibold">Email</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border-2 border-ink bg-paper px-3 py-2 font-semibold" />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-semibold">Password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border-2 border-ink bg-paper px-3 py-2 font-semibold" />
      </label>
      {error && <p className="mt-3 border-2 border-danger bg-danger/10 px-2 py-1 text-sm font-semibold text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="btn-raw mt-4 w-full disabled:bg-muted">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
