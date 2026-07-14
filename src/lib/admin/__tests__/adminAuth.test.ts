import { describe, expect, it, vi } from 'vitest';
import {
  ADMIN_AUTH_ERROR_MESSAGE,
  ADMIN_SIGN_OUT_ERROR_MESSAGE,
  decideAdminRoute,
  getAdminAccess,
  signOutAdmin,
  type AdminAuthGateway,
  type AdminRouteKind,
} from '../adminAuth';

const validProfileRow = {
  user_id: 'user-123',
  role: 'owner',
  display_name: 'Adpadz Owner',
  active: true,
  created_at: '2026-07-14T12:00:00.000Z',
  updated_at: '2026-07-14T13:00:00.000Z',
};

function createGateway(overrides: Partial<AdminAuthGateway> = {}): AdminAuthGateway {
  return {
    getVerifiedUser: async () => ({ data: { id: 'user-123' }, error: null }),
    isCurrentUserAdmin: async () => ({ data: true, error: null }),
    getProfile: async () => ({ data: validProfileRow, error: null }),
    signOut: async () => ({ error: null }),
    ...overrides,
  };
}

describe('admin authorization', () => {
  it('short-circuits as unauthenticated when there is no verified user', async () => {
    const checkAdmin = vi.fn(async () => ({ data: true, error: null }));
    const getProfile = vi.fn(async () => ({ data: validProfileRow, error: null }));
    const gateway = createGateway({
      getVerifiedUser: async () => ({ data: null, error: null }),
      isCurrentUserAdmin: checkAdmin,
      getProfile,
    });

    await expect(getAdminAccess(gateway)).resolves.toEqual({ status: 'unauthenticated' });
    expect(checkAdmin).not.toHaveBeenCalled();
    expect(getProfile).not.toHaveBeenCalled();
  });

  it('rejects a verified user when the server authorization function returns false', async () => {
    const getProfile = vi.fn(async () => ({ data: validProfileRow, error: null }));
    const gateway = createGateway({
      isCurrentUserAdmin: async () => ({ data: false, error: null }),
      getProfile,
    });

    await expect(getAdminAccess(gateway)).resolves.toEqual({ status: 'unauthorized' });
    expect(getProfile).not.toHaveBeenCalled();
  });

  it('authorizes only after a true server result and a valid matching active profile', async () => {
    await expect(getAdminAccess(createGateway())).resolves.toEqual({
      status: 'authorized',
      profile: {
        userId: 'user-123',
        role: 'owner',
        displayName: 'Adpadz Owner',
        active: true,
        createdAt: '2026-07-14T12:00:00.000Z',
        updatedAt: '2026-07-14T13:00:00.000Z',
      },
    });
  });

  it.each([
    null,
    { ...validProfileRow, user_id: 'different-user' },
    { ...validProfileRow, role: 'superadmin' },
    { ...validProfileRow, active: false },
  ])('fails closed when the profile is missing, mismatched, malformed, or inactive', async profile => {
    const gateway = createGateway({
      getProfile: async () => ({ data: profile, error: null }),
    });
    await expect(getAdminAccess(gateway)).resolves.toEqual({ status: 'unauthorized' });
  });

  it.each([
    createGateway({ getVerifiedUser: async () => ({ data: null, error: new Error('auth down') }) }),
    createGateway({ isCurrentUserAdmin: async () => ({ data: null, error: new Error('rpc down') }) }),
    createGateway({ getProfile: async () => ({ data: null, error: new Error('query down') }) }),
  ])('returns a retryable error state for auth, RPC, or profile query failures', async gateway => {
    await expect(getAdminAccess(gateway)).resolves.toEqual({
      status: 'error',
      message: ADMIN_AUTH_ERROR_MESSAGE,
    });
  });

  it('treats a non-boolean authorization response as a verification error', async () => {
    const gateway = createGateway({
      isCurrentUserAdmin: async () => ({ data: 'true', error: null }),
    });
    await expect(getAdminAccess(gateway)).resolves.toEqual({
      status: 'error',
      message: ADMIN_AUTH_ERROR_MESSAGE,
    });
  });

  it('turns thrown gateway failures into a retryable error state', async () => {
    const gateway = createGateway({
      getVerifiedUser: async () => {
        throw new Error('network failure');
      },
    });
    await expect(getAdminAccess(gateway)).resolves.toEqual({
      status: 'error',
      message: ADMIN_AUTH_ERROR_MESSAGE,
    });
  });
});

describe('admin redirect decisions', () => {
  const routes: AdminRouteKind[] = ['login', 'access-denied', 'root', 'protected'];

  it('renders the protected route only for an authorized admin', () => {
    expect(decideAdminRoute('authorized', 'protected')).toEqual({ action: 'render' });
    for (const route of routes.filter(value => value !== 'protected')) {
      expect(decideAdminRoute('authorized', route)).toEqual({
        action: 'redirect',
        to: '/admin/dashboard',
      });
    }
  });

  it('keeps an unauthenticated visitor on login and redirects every other admin route', () => {
    expect(decideAdminRoute('unauthenticated', 'login')).toEqual({ action: 'render' });
    for (const route of routes.filter(value => value !== 'login')) {
      expect(decideAdminRoute('unauthenticated', route)).toEqual({
        action: 'redirect',
        to: '/admin/login',
      });
    }
  });

  it('keeps an unauthorized user on access denied and redirects every other admin route', () => {
    expect(decideAdminRoute('unauthorized', 'access-denied')).toEqual({ action: 'render' });
    for (const route of routes.filter(value => value !== 'access-denied')) {
      expect(decideAdminRoute('unauthorized', route)).toEqual({
        action: 'redirect',
        to: '/admin/access-denied',
      });
    }
  });

  it('shows a retryable error in place instead of creating redirect loops', () => {
    for (const route of routes) {
      expect(decideAdminRoute('error', route)).toEqual({ action: 'error' });
    }
  });
});

describe('admin sign-out', () => {
  it('delegates to the auth gateway and reports success', async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    await expect(signOutAdmin(createGateway({ signOut }))).resolves.toEqual({ ok: true });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('returns a non-sensitive message when sign-out fails or throws', async () => {
    await expect(signOutAdmin(createGateway({
      signOut: async () => ({ error: new Error('server detail') }),
    }))).resolves.toEqual({ ok: false, message: ADMIN_SIGN_OUT_ERROR_MESSAGE });

    await expect(signOutAdmin(createGateway({
      signOut: async () => {
        throw new Error('network detail');
      },
    }))).resolves.toEqual({ ok: false, message: ADMIN_SIGN_OUT_ERROR_MESSAGE });
  });
});
