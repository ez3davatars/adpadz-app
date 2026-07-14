import { supabase } from '../supabase';
import { normalizeAdminProfile, type AdminProfile } from './adminTypes';

export type AdminGatewayResponse<T> = {
  data: T;
  error: unknown | null;
};

export type AdminAuthUser = {
  id: string;
};

export interface AdminAuthGateway {
  getVerifiedUser(): Promise<AdminGatewayResponse<AdminAuthUser | null>>;
  isCurrentUserAdmin(): Promise<AdminGatewayResponse<unknown>>;
  getProfile(userId: string): Promise<AdminGatewayResponse<unknown>>;
  signOut(): Promise<{ error: unknown | null }>;
}

export type AdminAccessState =
  | { status: 'authorized'; profile: AdminProfile }
  | { status: 'unauthenticated' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string };

export type AdminRouteKind = 'login' | 'access-denied' | 'root' | 'protected';

export type AdminRouteDecision =
  | { action: 'render' }
  | { action: 'error' }
  | { action: 'redirect'; to: '/admin/login' | '/admin/access-denied' | '/admin/dashboard' };

export type AdminSignOutResult =
  | { ok: true }
  | { ok: false; message: string };

export const ADMIN_AUTH_ERROR_MESSAGE = 'Mission Control could not verify your access. Please try again.';
export const ADMIN_SIGN_OUT_ERROR_MESSAGE = 'Mission Control could not sign you out. Please try again.';

const defaultAdminAuthGateway: AdminAuthGateway = {
  async getVerifiedUser() {
    const { data, error } = await supabase.auth.getUser();
    return {
      data: data.user ? { id: data.user.id } : null,
      error,
    };
  },

  async isCurrentUserAdmin() {
    const { data, error } = await supabase.rpc('is_adpadz_admin');
    return { data, error };
  },

  async getProfile(userId) {
    const { data, error } = await supabase
      .from('admin_users')
      .select('user_id, role, display_name, active, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    return { data, error };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },
};

function logDevelopmentError(context: string, error: unknown): void {
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    console.error(`[Mission Control] ${context}`, error);
  }
}

function verificationError(context: string, error: unknown): AdminAccessState {
  logDevelopmentError(context, error);
  return { status: 'error', message: ADMIN_AUTH_ERROR_MESSAGE };
}

export async function getAdminProfile(
  userId: string,
  gateway: AdminAuthGateway = defaultAdminAuthGateway,
): Promise<AdminProfile | null> {
  const response = await gateway.getProfile(userId);
  if (response.error !== null) {
    throw response.error;
  }

  const profile = normalizeAdminProfile(response.data);
  return profile?.userId === userId ? profile : null;
}

export async function getAdminAccess(
  gateway: AdminAuthGateway = defaultAdminAuthGateway,
): Promise<AdminAccessState> {
  let verifiedUserResponse: AdminGatewayResponse<AdminAuthUser | null>;
  try {
    verifiedUserResponse = await gateway.getVerifiedUser();
  } catch (error) {
    return verificationError('User verification threw an error.', error);
  }

  if (verifiedUserResponse.error !== null) {
    return verificationError('User verification failed.', verifiedUserResponse.error);
  }

  const verifiedUser = verifiedUserResponse.data;
  if (!verifiedUser) return { status: 'unauthenticated' };

  let adminCheckResponse: AdminGatewayResponse<unknown>;
  try {
    adminCheckResponse = await gateway.isCurrentUserAdmin();
  } catch (error) {
    return verificationError('Admin authorization threw an error.', error);
  }

  if (adminCheckResponse.error !== null) {
    return verificationError('Admin authorization failed.', adminCheckResponse.error);
  }

  if (adminCheckResponse.data === false) return { status: 'unauthorized' };
  if (adminCheckResponse.data !== true) {
    return verificationError('Admin authorization returned an invalid response.', adminCheckResponse.data);
  }

  try {
    const profile = await getAdminProfile(verifiedUser.id, gateway);
    if (!profile) return { status: 'unauthorized' };
    return { status: 'authorized', profile };
  } catch (error) {
    return verificationError('Admin profile lookup failed.', error);
  }
}

export function decideAdminRoute(
  status: AdminAccessState['status'],
  route: AdminRouteKind,
): AdminRouteDecision {
  if (status === 'error') return { action: 'error' };

  if (status === 'authorized') {
    return route === 'protected'
      ? { action: 'render' }
      : { action: 'redirect', to: '/admin/dashboard' };
  }

  if (status === 'unauthenticated') {
    return route === 'login'
      ? { action: 'render' }
      : { action: 'redirect', to: '/admin/login' };
  }

  return route === 'access-denied'
    ? { action: 'render' }
    : { action: 'redirect', to: '/admin/access-denied' };
}

export async function signOutAdmin(
  gateway: AdminAuthGateway = defaultAdminAuthGateway,
): Promise<AdminSignOutResult> {
  try {
    const { error } = await gateway.signOut();
    if (error === null) return { ok: true };
    logDevelopmentError('Sign-out failed.', error);
  } catch (error) {
    logDevelopmentError('Sign-out threw an error.', error);
  }

  return { ok: false, message: ADMIN_SIGN_OUT_ERROR_MESSAGE };
}
