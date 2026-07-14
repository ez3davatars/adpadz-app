export const ADMIN_ROLES = [
  'owner',
  'admin',
  'sales',
  'creative',
  'finance',
  'support',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminProfile = {
  userId: string;
  role: AdminRole;
  displayName: string;
  active: true;
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isIsoDateString(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && ADMIN_ROLES.some(role => role === value);
}

export function parseAdminRole(value: unknown): AdminRole | null {
  return isAdminRole(value) ? value : null;
}

/**
 * Converts an untrusted `admin_users` row into the client model. The parser is
 * intentionally strict: role values are never trimmed/coerced, inactive users
 * are rejected, and the identity/timestamp fields must all be present.
 */
export function normalizeAdminProfile(value: unknown): AdminProfile | null {
  if (!isRecord(value)) return null;

  const role = parseAdminRole(value.role);
  if (
    !isNonEmptyString(value.user_id)
    || role === null
    || !isNonEmptyString(value.display_name)
    || value.active !== true
    || !isIsoDateString(value.created_at)
    || !isIsoDateString(value.updated_at)
  ) {
    return null;
  }

  return {
    userId: value.user_id,
    role,
    displayName: value.display_name,
    active: true,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}
