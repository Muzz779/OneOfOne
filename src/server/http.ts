/**
 * Route-handler helpers (CLAUDE.md §40, §45).
 *
 * Consistent JSON responses and safe error mapping — AppError surfaces its
 * customer-friendly message; anything else becomes a generic 500 so internals
 * never leak to customers.
 */

import "server-only";
import { AppError } from "./errors";

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function fail(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: err.userMessage }, { status: err.status });
  }
  console.error("Unhandled route error:", err);
  return Response.json(
    { error: "Something went wrong on our side. Please try again." },
    { status: 500 },
  );
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError(400, "That request wasn't valid.");
  }
}
