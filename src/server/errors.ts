/**
 * Application errors with customer-safe messages (CLAUDE.md §45).
 *
 * `userMessage` is safe to show customers; `message` may carry detail for logs.
 * Route handlers map AppError to the right status + a friendly body, and never
 * leak internals to customers.
 */

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly userMessage: string,
    message?: string,
  ) {
    super(message ?? userMessage);
    this.name = "AppError";
  }
}

export const badRequest = (userMessage: string, detail?: string) =>
  new AppError(400, userMessage, detail);
export const unauthorized = (userMessage = "You need to sign in to do that.") =>
  new AppError(401, userMessage);
export const forbidden = (userMessage = "You don't have access to that.") =>
  new AppError(403, userMessage);
export const notFound = (userMessage = "We couldn't find that.") =>
  new AppError(404, userMessage);
export const tooMany = (userMessage = "You're going a bit fast — please wait a moment and try again.") =>
  new AppError(429, userMessage);
export const conflict = (userMessage: string, detail?: string) =>
  new AppError(409, userMessage, detail);
