import { describe, expect, it } from 'vitest';
import { isUuid } from '../ids';

describe('isUuid', () => {
  it('accepts canonical UUIDs', () => {
    expect(isUuid('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
  });

  it('rejects malformed identifiers', () => {
    expect(isUuid('not-a-real-id')).toBe(false);
    expect(isUuid('123e4567e89b42d3a456426614174000')).toBe(false);
  });
});
