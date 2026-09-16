"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const url = isRegister ? "/api/auth/signup" : "/api/auth/login";
      const body = isRegister ? { name, email, password } : { email, password };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "That didn't work.");
      router.push("/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card-raw mx-auto max-w-sm p-6">
      <h1 className="font-display text-2xl font-bold">{isRegister ? "Create your account" : "Sign in"}</h1>
      <p className="mt-1 text-sm text-muted">
        {isRegister ? "Track your orders and reorder in a click." : "Welcome back — sign in to see your orders."}
      </p>
      {isRegister && (
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-ink bg-paper px-3 py-2 font-semibold" autoComplete="name" />
        </label>
      )}
      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-semibold">Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border-2 border-ink bg-paper px-3 py-2 font-semibold" autoComplete="email" />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-semibold">Password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border-2 border-ink bg-paper px-3 py-2 font-semibold" autoComplete={isRegister ? "new-password" : "current-password"} />
      </label>
      {error && <p className="mt-3 border-2 border-danger bg-danger/10 px-2 py-1 text-sm font-semibold text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="btn-raw mt-4 w-full disabled:bg-muted">
        {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
      </button>
      <p className="mt-3 text-center text-sm text-muted">
        {isRegister ? (
          <>Already have an account? <Link href="/account/login" className="font-semibold underline underline-offset-4">Sign in</Link></>
        ) : (
          <>New here? <Link href="/account/register" className="font-semibold underline underline-offset-4">Create an account</Link></>
        )}
      </p>
    </form>
  );
}
