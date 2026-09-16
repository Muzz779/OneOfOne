/**
 * Mock customer auth (development) — signed cookie + salted scrypt (§40, §53).
 * Passwords are hashed, never stored plaintext. Production swaps in Supabase Auth.
 */

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { newId } from "@/domain/ids";
import type { User } from "@/domain/entities";
import { hashPassword, verifyPassword } from "@/server/password";
import { badRequest } from "@/server/errors";
import type { Repo } from "@/server/repo";
import type { AuthResult, AuthService, SessionUser } from "./types";

const USER_COOKIE = "oo_user";
const SECRET = process.env.ONEOFONE_SIGNING_SECRET ?? "dev-only-insecure-signing-secret";

function sign(userId: string): string {
  return createHmac("sha256", SECRET).update(`user:${userId}`).digest("hex").slice(0, 32);
}
function validEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export class MockAuthService implements AuthService {
  constructor(private readonly repo: Repo) {}

  private async setSession(userId: string): Promise<void> {
    (await cookies()).set(USER_COOKIE, `${userId}.${sign(userId)}`, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  async signup(email: string, name: string, password: string): Promise<AuthResult> {
    if (!validEmail(email)) throw badRequest("Please enter a valid email address.");
    if (!name?.trim()) throw badRequest("Please enter your name.");
    if (!password || password.length < 8) throw badRequest("Use a password of at least 8 characters.");
    if (await this.repo.getUserByEmail(email)) {
      return { ok: false, error: "An account with that email already exists. Try signing in." };
    }
    const { salt, hash } = hashPassword(password);
    const user: User = {
      id: newId("usr"),
      email,
      name,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    };
    await this.repo.createUser(user);
    await this.setSession(user.id);
    return { ok: true };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.repo.getUserByEmail(email);
    if (!user || !verifyPassword(password, { salt: user.passwordSalt, hash: user.passwordHash })) {
      return { ok: false, error: "Incorrect email or password." };
    }
    await this.setSession(user.id);
    return { ok: true };
  }

  async logout(): Promise<void> {
    (await cookies()).delete(USER_COOKIE);
  }

  async getCurrentUser(): Promise<SessionUser | undefined> {
    const raw = (await cookies()).get(USER_COOKIE)?.value;
    if (!raw) return undefined;
    const idx = raw.lastIndexOf(".");
    if (idx < 0) return undefined;
    const userId = raw.slice(0, idx);
    const sig = raw.slice(idx + 1);
    const expected = sign(userId);
    if (sig.length !== expected.length) return undefined;
    try {
      if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return undefined;
    } catch {
      return undefined;
    }
    const user = await this.repo.getUser(userId);
    return user ? { id: user.id, email: user.email, name: user.name } : undefined;
  }
}
