import { describe, expect, it } from 'vitest';
import { isQrSlugConflict } from './qrErrors';

describe('isQrSlugConflict', () => {
  it('recognizes the QR slug unique constraint by Postgres code and constraint', () => {
    expect(isQrSlugConflict({ code: '23505', constraint: 'qr_links_slug_key' })).toBe(true);
  });

  it('recognizes the constraint in a PostgREST message', () => {
    expect(isQrSlugConflict({ message: 'duplicate key value violates unique constraint "qr_links_slug_key"' })).toBe(true);
  });

  it('does not misclassify unrelated database errors', () => {
    expect(isQrSlugConflict({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isQrSlugConflict(new Error('network failed'))).toBe(false);
  });
});