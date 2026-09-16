/**
 * Supabase customer auth (real Supabase Auth / GoTrue) — CLAUDE.md §40.
 *
 * Sessions are managed by @supabase/ssr via httpOnly cookies. For instant
 * sign-in after registration, disable email confirmation in the Supabase Auth
 * settings (or add a confirmation flow later).
 */

import "server-only";
import { supabaseServerAuth } from "@/server/supabase/clients";
import type { AuthResult, AuthService, SessionUser } from "./types";

export class SupabaseAuthService implements AuthService {
  async signup(email: string, name: string, password: string): Promise<AuthResult> {
    if (!password || password.length < 8) {
      return { ok: false, error: "Use a password of at least 8 characters." };
    }
    const supabase = await supabaseServerAuth();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const supabase = await supabaseServerAuth();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: "Incorrect email or password." };
    return { ok: true };
  }

  async logout(): Promise<void> {
    const supabase = await supabaseServerAuth();
    await supabase.auth.signOut();
  }

  async getCurrentUser(): Promise<SessionUser | undefined> {
    const supabase = await supabaseServerAuth();
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    if (!u?.email) return undefined;
    const name = (u.user_metadata?.name as string | undefined) ?? undefined;
    return { id: u.id, email: u.email, name };
  }
}
