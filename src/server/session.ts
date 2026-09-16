/**
 * Cookie-based session helpers (CLAUDE.md §40).
 *
 * Cart identity for anonymous shoppers, plus a mock admin session gate. Admin
 * auth here is a clearly-marked development stand-in (signed cookie + a password
 * from the environment); production would use Supabase Auth. The gate itself is
 * real — protected admin actions verify it server-side (§40).
 */

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth, getRepo } from "./container";
import { forbidden } from "./errors";
import type { AdminUser } from "@/domain/entities";
import type { SessionUser } from "./auth/types";

const CART_COOKIE = "oo_cart";
const ADMIN_COOKIE = "oo_admin";

const SECRET =
  process.env.ONEOFONE_SIGNING_SECRET ?? "dev-only-insecure-signing-secret";
const ADMIN_PASSWORD = process.env.ONEOFONE_ADMIN_PASSWORD ?? "letmein-dev";

export async function getCartId(): Promise<string | undefined> {
  return (await cookies()).get(CART_COOKIE)?.value;
}

export async function setCartId(id: string): Promise<void> {
  (await cookies()).set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

function signAdmin(email: string): string {
  return createHmac("sha256", SECRET).update(`admin:${email}`).digest("hex").slice(0, 32);
}

export interface AdminLoginResult {
  readonly ok: boolean;
  readonly error?: string;
}

export async function adminLogin(
  email: string,
  password: string,
): Promise<AdminLoginResult> {
  const admin = await getRepo().getAdminByEmail(email);
  if (!admin || password !== ADMIN_PASSWORD) {
    return { ok: false, error: "Incorrect email or password." };
  }
  (await cookies()).set(ADMIN_COOKIE, `${email}.${signAdmin(email)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return { ok: true };
}

export async function adminLogout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function getAdmin(): Promise<AdminUser | undefined> {
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!raw) return undefined;
  const idx = raw.lastIndexOf(".");
  if (idx < 0) return undefined;
  const email = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = signAdmin(email);
  if (sig.length !== expected.length) return undefined;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return undefined;
  } catch {
    return undefined;
  }
  return getRepo().getAdminByEmail(email);
}

export async function isAdmin(): Promise<boolean> {
  return (await getAdmin()) !== undefined;
}

// --- Customer accounts (§40) — delegated to the active AuthService ----------

export type { AuthResult, SessionUser } from "./auth/types";

export async function customerSignup(email: string, name: string, password: string) {
  return getAuth().signup(email, name, password);
}

export async function customerLogin(email: string, password: string) {
  return getAuth().login(email, password);
}

export async function customerLogout(): Promise<void> {
  return getAuth().logout();
}

export async function getCurrentUser(): Promise<SessionUser | undefined> {
  return getAuth().getCurrentUser();
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect("/account/login");
}

/** Throw 403 when not authenticated (for admin API routes, §40). */
export async function requireAdminApi(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw forbidden("Admin access required.");
  return admin;
}

/** Redirect to login when not authenticated (for admin server components). */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (admin) return admin;
  redirect("/admin/login"); // returns `never`
}
