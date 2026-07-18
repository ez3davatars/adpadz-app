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

export async function requestPasswordReset(auth: AuthClient, emailInput: string, origin: string) {
  const email = normalizeAuthEmail(emailInput);
  const { error } = await auth.resetPasswordForEmail(email, { redirectTo: new URL('/auth?recovery=1', origin).toString() });
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

export function createAuthSubmissionGuard() {
  let active = false;
  return { acquire() { if (active) return false; active = true; return true; }, release() { active = false; } };
}
