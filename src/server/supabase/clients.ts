/**
 * Supabase clients (CLAUDE.md §27, §40).
 *
 * - `supabaseAdmin()` uses the service-role key and bypasses RLS. Used only on
 *   the server by the repo and storage adapters, where the application has
 *   already authorized the operation. NEVER expose the service-role key to the
 *   client.
 * - `supabaseServerAuth()` is an SSR client bound to the request cookies for
 *   customer auth (Supabase Auth / GoTrue), using the public anon key.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "@/server/env";

let adminClient: SupabaseClient | undefined;

export function supabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/** SSR auth client bound to the incoming request's cookies. */
export async function supabaseServerAuth(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — safe to ignore; the
          // middleware/route refresh handles cookie writes.
        }
      },
    },
  });
}
