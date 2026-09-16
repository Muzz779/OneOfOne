/**
 * Stable ID generation (CLAUDE.md §39).
 *
 * Internal IDs are prefixed UUIDs (globally unique, opaque). Customer-facing
 * order numbers are short human-readable sequences assigned by the repository.
 */

export type IdPrefix =
  | "usr"
  | "adm"
  | "des"
  | "ast"
  | "cart"
  | "ci"
  | "ord"
  | "oi"
  | "pay"
  | "ship"
  | "job"
  | "pa"
  | "pf"
  | "ref"
  | "ntf";

/** Generate a prefixed UUID, e.g. `ord_9f1c...`. */
export function newId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/** Format a human-facing order number from a monotonic sequence (#1042). */
export function formatOrderNumber(seq: number): string {
  return `#${1000 + seq}`;
}

/**
 * A short deterministic-ish token for public share links (§48) — not a secret,
 * used alongside server-side authorization, never in place of it.
 */
export function shareToken(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
