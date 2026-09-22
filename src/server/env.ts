/**
 * Environment configuration (CLAUDE.md §18, §19, §40).
 *
 * Central place that decides whether the app runs against real Supabase or the
 * local dev mocks. When the three Supabase vars are set, the container wires the
 * Supabase repo/storage/auth; otherwise it falls back to in-memory + disk +
 * cookie auth so local dev keeps working with zero setup.
 */

import "server-only";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** True when a real Supabase project is configured. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
}

// ── Yoco payments ───────────────────────────────────────────────────────────
export const YOCO_SECRET_KEY = process.env.YOCO_SECRET_KEY ?? "";
export const YOCO_WEBHOOK_SECRET = process.env.YOCO_WEBHOOK_SECRET ?? "";

/** True when real Yoco keys are configured (else the mock gateway is used). */
export function isYocoConfigured(): boolean {
  return Boolean(YOCO_SECRET_KEY && YOCO_WEBHOOK_SECRET);
}

/** Absolute site origin for building payment return URLs. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
