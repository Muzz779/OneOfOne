/**
 * Customer auth abstraction (CLAUDE.md §40, §53).
 *
 * Two implementations: SupabaseAuthService (real Supabase Auth / GoTrue) when a
 * project is configured, and MockAuthService (signed cookie + scrypt) for local
 * dev. Swapping is a container decision — nothing else changes.
 */

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name?: string;
}

export interface AuthResult {
  readonly ok: boolean;
  readonly error?: string;
}

export interface AuthService {
  signup(email: string, name: string, password: string): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<SessionUser | undefined>;
}
