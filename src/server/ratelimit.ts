/**
 * Simple in-memory rate limiter (CLAUDE.md §41).
 *
 * Fixed-window counter keyed by a caller identity + route. Protects expensive
 * endpoints (upload, enhancement, background removal, checkout, webhooks). This
 * is a dev-grade limiter; production would use a shared store (e.g. Redis).
 */

interface Window {
  count: number;
  resetAt: number;
}

const globalForLimiter = globalThis as unknown as {
  __ooRate?: Map<string, Window>;
};

function store(): Map<string, Window> {
  if (!globalForLimiter.__ooRate) globalForLimiter.__ooRate = new Map();
  return globalForLimiter.__ooRate;
}

export interface RateResult {
  readonly ok: boolean;
  readonly remaining: number;
  readonly retryAfterMs: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateResult {
  const now = Date.now();
  const m = store();
  const w = m.get(key);
  if (!w || w.resetAt <= now) {
    m.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (w.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: w.resetAt - now };
  }
  w.count += 1;
  return { ok: true, remaining: limit - w.count, retryAfterMs: 0 };
}

/** Best-effort client identity from request headers. */
export function clientKey(req: Request, route: string): string {
  const fwd =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  return `${route}:${fwd}`;
}
