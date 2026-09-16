/**
 * Password hashing (CLAUDE.md §40).
 *
 * Real salted scrypt hashing — passwords are never stored in plaintext, even in
 * this dev auth. Production would delegate auth to Supabase Auth; this keeps the
 * same security property in the meantime.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export interface PasswordHash {
  readonly salt: string;
  readonly hash: string;
}

export function hashPassword(password: string): PasswordHash {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, stored: PasswordHash): boolean {
  const candidate = scryptSync(password, stored.salt, 64);
  const expected = Buffer.from(stored.hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
