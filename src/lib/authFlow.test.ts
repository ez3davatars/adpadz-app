import { describe, expect, it, vi } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';
import {
  createAuthSubmissionGuard,
  performSignIn,
  performSignOut,
  performSignup,
  requestPasswordReset,
  updateRecoveredPassword,
  type AuthClient,
} from './authFlow';

const user = { id: 'user-1', identities: [{ id: 'identity-1' }] } as unknown as User;
const session = { user, access_token: 'redacted-in-test' } as unknown as Session;

function authClient(overrides: Partial<AuthClient> = {}): AuthClient {
  return {
    signUp: vi.fn().mockResolvedValue({ data: { user, session }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user, session }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe('authentication flow', () => {
  it('normalizes signup details and returns an immediate session', async () => {
    const auth = authClient();
    await expect(performSignup(auth, {
      email: '  OWNER@Example.COM ', password: 'StrongPass9!', fullName: '  Owner Name  ',
      origin: 'https://adpadz.co', destination: '/app/business/dashboard',
    })).resolves.toEqual({ kind: 'session', email: 'owner@example.com' });
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'owner@example.com',
      options: expect.objectContaining({
        data: { full_name: 'Owner Name' },
        emailRedirectTo: 'https://adpadz.co/auth?next=%2Fapp%2Fbusiness%2Fdashboard',
      }),
    }));
  });

  it('returns confirmation when signup has no session', async () => {
    const auth = authClient({ signUp: vi.fn().mockResolvedValue({ data: { user, session: null }, error: null }) });
    await expect(performSignup(auth, {
      email: 'new@example.com', password: 'StrongPass9!', fullName: 'New Owner', origin: 'https://adpadz.co', destination: '/app/business/dashboard',
    })).resolves.toEqual({ kind: 'confirmation', email: 'new@example.com' });
  });

  it('detects the empty-identities existing-account response', async () => {
    const duplicate = { ...user, identities: [] } as unknown as User;
    const auth = authClient({ signUp: vi.fn().mockResolvedValue({ data: { user: duplicate, session: null }, error: null }) });
    await expect(performSignup(auth, {
      email: 'EXISTING@example.com', password: 'StrongPass9!', fullName: 'Existing', origin: 'https://adpadz.co', destination: '/app/business/dashboard',
    })).resolves.toEqual({ kind: 'existing', email: 'existing@example.com' });
  });

  it('rejects a blank full name before signup', async () => {
    const auth = authClient();
    await expect(performSignup(auth, {
      email: 'new@example.com', password: 'StrongPass9!', fullName: '   ', origin: 'https://adpadz.co', destination: '/app/business/dashboard',
    })).rejects.toThrow('Full name is required.');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('propagates invalid login errors', async () => {
    const auth = authClient({ signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: new Error('Invalid login credentials') }) });
    await expect(performSignIn(auth, ' OWNER@Example.com ', 'wrong')).rejects.toThrow('Invalid login credentials');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'owner@example.com', password: 'wrong' });
  });

  it('requests password recovery at the auth route', async () => {
    const auth = authClient();
    await expect(requestPasswordReset(auth, ' OWNER@Example.com ', 'https://adpadz.co')).resolves.toBe('owner@example.com');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('owner@example.com', { redirectTo: 'https://adpadz.co/auth?recovery=1' });
  });

  it('supports a separate Mission Control recovery callback', async () => {
    const auth = authClient();
    await requestPasswordReset(auth, ' ADMIN@Example.com ', 'https://adpadz.co', '/admin/login?recovery=1');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('admin@example.com', { redirectTo: 'https://adpadz.co/admin/login?recovery=1' });
  });

  it('updates a recovered password', async () => {
    const auth = authClient();
    await updateRecoveredPassword(auth, 'NewStrongPass9!');
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'NewStrongPass9!' });
  });

  it('signs out through Supabase', async () => {
    const auth = authClient();
    await performSignOut(auth);
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
  it('blocks in-flight and rapid repeat submissions, then allows a later attempt', () => {
    let now = 1_000;
    const guard = createAuthSubmissionGuard({ now: () => now, minimumIntervalMs: 1_000 });
    expect(guard.acquire()).toBe(true);
    expect(guard.acquire()).toBe(false);
    guard.release();
    expect(guard.acquire()).toBe(false);
    now = 2_000;
    expect(guard.acquire()).toBe(true);
  });

  it('holds a rate-limit cooldown and permits login after it expires', async () => {
    let now = 10_000;
    const guard = createAuthSubmissionGuard({ now: () => now, minimumIntervalMs: 0 });
    expect(guard.acquire()).toBe(true);
    guard.startCooldown(30_000);
    guard.release();
    expect(guard.acquire()).toBe(false);
    expect(guard.remainingCooldownMs()).toBe(30_000);

    now += 30_000;
    expect(guard.acquire()).toBe(true);
    const auth = authClient();
    await expect(performSignIn(auth, 'owner@example.com', 'StrongPass9!')).resolves.toEqual(expect.objectContaining({ email: 'owner@example.com' }));
    expect(auth.signInWithPassword).toHaveBeenCalledOnce();
  });
});
