import type { Session, User } from '@supabase/supabase-js';

type AuthResult = { data: { session: Session | null; user: User | null }; error: Error | null };
export type AuthClient = {
  signUp(input: { email: string; password: string; options: { data: { full_name: string }; emailRedirectTo: string } }): Promise<AuthResult>;
  signInWithPassword(input: { email: string; password: string }): Promise<AuthResult>;
  resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<{ error: Error | null }>;
  updateUser(input: { password: string }): Promise<{ error: Error | null }>;
  signOut(): Promise<{ error: Error | null }>;
};
export type SignupOutcome =
  | { kind: 'session'; email: string }
  | { kind: 'confirmation'; email: string }
  | { kind: 'existing'; email: string };

export const AUTH_SUBMISSION_DEBOUNCE_MS = 1_000;
export const AUTH_RATE_LIMIT_COOLDOWN_MS = 30_000;

export function normalizeAuthEmail(email: string) { return email.trim().toLowerCase(); }
export function normalizeFullName(name: string) { return name.trim(); }

export function getAuthCallbackUrl(origin: string, destination: string) {
  const confirmationUrl = new URL('/auth', origin);
  confirmationUrl.searchParams.set('next', destination);
  return confirmationUrl.toString();
}

export async function performSignup(auth: AuthClient, input: { email: string; password: string; fullName: string; origin: string; destination: string }): Promise<SignupOutcome> {
  const email = normalizeAuthEmail(input.email);
  const fullName = normalizeFullName(input.fullName);
  if (!fullName) throw new Error('Full name is required.');
  const confirmationUrl = getAuthCallbackUrl(input.origin, input.destination);
  const { data, error } = await auth.signUp({ email, password: input.password, options: { data: { full_name: fullName }, emailRedirectTo: confirmationUrl } });
  if (error) throw error;
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return { kind: 'existing', email };
  return { kind: data.session ? 'session' : 'confirmation', email };
}

export async function performSignIn(auth: AuthClient, emailInput: string, password: string) {
  const email = normalizeAuthEmail(emailInput);
  const { data, error } = await auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { ...data, email };
}

export async function requestPasswordReset(auth: AuthClient, emailInput: string, origin: string, recoveryPath = '/auth?recovery=1') {
  const email = normalizeAuthEmail(emailInput);
  const { error } = await auth.resetPasswordForEmail(email, { redirectTo: new URL(recoveryPath, origin).toString() });
  if (error) throw error;
  return email;
}

export async function updateRecoveredPassword(auth: AuthClient, password: string) {
  const { error } = await auth.updateUser({ password });
  if (error) throw error;
}

export async function performSignOut(auth: AuthClient) {
  const { error } = await auth.signOut();
  if (error) throw error;
}

export function createAuthSubmissionGuard(options: {
  now?: () => number;
  minimumIntervalMs?: number;
} = {}) {
  const now = options.now ?? Date.now;
  const minimumIntervalMs = options.minimumIntervalMs ?? AUTH_SUBMISSION_DEBOUNCE_MS;
  let active = false;
  let blockedUntil = 0;

  return {
    acquire() {
      const timestamp = now();
      if (active || timestamp < blockedUntil) return false;
      active = true;
      blockedUntil = timestamp + minimumIntervalMs;
      return true;
    },
    release() {
      active = false;
    },
    startCooldown(durationMs = AUTH_RATE_LIMIT_COOLDOWN_MS) {
      blockedUntil = Math.max(blockedUntil, now() + durationMs);
    },
    remainingCooldownMs() {
      return Math.max(0, blockedUntil - now());
    },
    isActive() {
      return active;
    },
  };
}
