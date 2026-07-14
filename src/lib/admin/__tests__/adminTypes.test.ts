import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLES,
  isAdminRole,
  normalizeAdminProfile,
  parseAdminRole,
} from '../adminTypes';

const validProfileRow = {
  user_id: 'user-123',
  role: 'owner',
  display_name: 'Adpadz Owner',
  active: true,
  created_at: '2026-07-14T12:00:00.000Z',
  updated_at: '2026-07-14T13:00:00.000Z',
};

describe('admin role parsing', () => {
  it('accepts every supported role exactly', () => {
    for (const role of ADMIN_ROLES) {
      expect(isAdminRole(role)).toBe(true);
      expect(parseAdminRole(role)).toBe(role);
    }
  });

  it.each([
    undefined,
    null,
    '',
    'OWNER',
    ' owner',
    'owner ',
    'superadmin',
    1,
    true,
  ])('rejects unsupported or coerced role value %j', value => {
    expect(isAdminRole(value)).toBe(false);
    expect(parseAdminRole(value)).toBeNull();
  });
});

describe('admin profile normalization', () => {
  it('maps a valid active database row to the client model', () => {
    expect(normalizeAdminProfile(validProfileRow)).toEqual({
      userId: 'user-123',
      role: 'owner',
      displayName: 'Adpadz Owner',
      active: true,
      createdAt: '2026-07-14T12:00:00.000Z',
      updatedAt: '2026-07-14T13:00:00.000Z',
    });
  });

  it.each([
    null,
    [],
    { ...validProfileRow, user_id: '' },
    { ...validProfileRow, role: 'Owner' },
    { ...validProfileRow, display_name: '' },
    { ...validProfileRow, active: false },
    { ...validProfileRow, active: 'true' },
    { ...validProfileRow, created_at: 'not-a-date' },
    { ...validProfileRow, updated_at: null },
  ])('fails closed for malformed or inactive profile %#', value => {
    expect(normalizeAdminProfile(value)).toBeNull();
  });
});
