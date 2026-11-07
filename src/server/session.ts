/**
 * Cookie-based session helpers (CLAUDE.md §40).
 *
 * Cart identity for anonymous shoppers, plus the owner (admin) session: a
 * password from the environment and an HMAC-signed, expiring cookie. Protected
 * admin actions verify it server-side (§40). In production it refuses to work
 * with the dev defaults (see adminAuthProblem).
 */

import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth, getRepo } from "./container";
import { forbidden } from "./errors";
import { adminAuthProblem } from "./env";
import type { AdminUser } from "@/domain/entities";
import type { SessionUser } from "./auth/types";

const CART_COOKIE = "oo_cart";
const ADMIN_COOKIE = "oo_admin";

const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

// Dev defaults only ever apply outside production: adminAuthProblem() blocks
// admin login and admin cookies in production until real values are set.
const SECRET = process.env.ONEOFONE_SIGNING_SECRET || "dev-only-insecure-signing-secret";
const ADMIN_PASSWORD = process.env.ONEOFONE_ADMIN_PASSWORD || "letmein-dev";

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

function signAdmin(email: string, expiresAt: number): string {
  return createHmac("sha256", SECRET).update(`admin:${email}:${expiresAt}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  // Hash first so differing lengths don't leak through timing.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export interface AdminLoginResult {
  readonly ok: boolean;
  readonly error?: string;
}

export async function adminLogin(
  email: string,
  password: string,
): Promise<AdminLoginResult> {
  const problem = adminAuthProblem();
  if (problem) return { ok: false, error: problem };
  const admin = await getRepo().getAdminByEmail(String(email ?? "").trim().toLowerCase());
  const passwordOk = safeEqual(String(password ?? ""), ADMIN_PASSWORD);
  if (!admin || !passwordOk) {
    return { ok: false, error: "Incorrect email or password." };
  }
  // The expiry is inside the signature, so a copied cookie stops working too.
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS;
  const token = `${Buffer.from(admin.email).toString("base64url")}.${expiresAt}.${signAdmin(admin.email, expiresAt)}`;
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return { ok: true };
}

export async function adminLogout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function getAdmin(): Promise<AdminUser | undefined> {
  if (adminAuthProblem()) return undefined;
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!raw) return undefined;
  const [emailB64, expRaw, sig] = raw.split(".");
  if (!emailB64 || !expRaw || !sig) return undefined;
  const expiresAt = Number(expRaw);
  if (!Number.isInteger(expiresAt) || expiresAt < Date.now() / 1000) return undefined;
  const email = Buffer.from(emailB64, "base64url").toString("utf8");
  if (!safeEqual(sig, signAdmin(email, expiresAt))) return undefined;
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
