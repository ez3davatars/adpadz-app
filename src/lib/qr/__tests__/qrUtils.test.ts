import { describe, expect, it, vi } from 'vitest';
import {
  buildShortUrl,
  createSlugFromTitle,
  formatDateTime,
  isLocalhostHost,
  isLocalhostUrl,
  makeDownloadFilename,
  normalizeSlug,
  parseTags,
  validateHttpUrl,
} from '../qrUtils';

describe('QR slug and URL helpers', () => {
  it('turns user-entered titles into bounded URL-safe slugs', () => {
    expect(normalizeSlug('  Summer Sale: 25% OFF!  ')).toBe('summer-sale-25-off');
    expect(normalizeSlug('a'.repeat(100))).toHaveLength(80);
    expect(normalizeSlug('---')).toBe('');
  });

  it('uses a deterministic timestamp fallback when a title has no slug characters', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567);
    expect(createSlugFromTitle('***')).toBe(`adpadz-${(1_234_567).toString(36)}`);
  });

  it('accepts only HTTP(S) destination URLs', () => {
    expect(validateHttpUrl('https://adpadz.co/q/demo')).toBe(true);
    expect(validateHttpUrl('http://localhost:5173')).toBe(true);
    expect(validateHttpUrl('javascript:alert(1)')).toBe(false);
    expect(validateHttpUrl('https://adpadz.co/\nforged')).toBe(false);
    expect(validateHttpUrl('not a url')).toBe(false);
  });

  it('recognizes exact localhost hosts and localhost URLs', () => {
    expect(isLocalhostHost(' LOCALHOST ')).toBe(true);
    expect(isLocalhostHost('127.0.0.1')).toBe(true);
    expect(isLocalhostHost('localhost.example.com')).toBe(false);
    expect(isLocalhostHost(undefined)).toBe(false);
    expect(isLocalhostUrl('http://localhost:4173/q/demo')).toBe(true);
    expect(isLocalhostUrl('https://adpadz.co/q/demo')).toBe(false);
  });

  it('builds canonical short links without duplicate slashes', () => {
    expect(buildShortUrl(' Summer Deal ', 'https://adpadz.co///')).toBe(
      'https://adpadz.co/q/summer-deal',
    );
    expect(buildShortUrl('---', 'https://adpadz.co')).toBe('https://adpadz.co/q/demo');
  });
});

describe('QR display and export helpers', () => {
  it('normalizes tag input and caps it at twenty tags', () => {
    expect(parseTags(' local, summer , , featured ')).toEqual([
      'local',
      'summer',
      'featured',
    ]);

    const manyTags = Array.from({ length: 25 }, (_, index) => `tag-${index}`).join(',');
    const parsed = parseTags(manyTags);
    expect(parsed).toHaveLength(20);
    expect(parsed[parsed.length - 1]).toBe('tag-19');
  });

  it('creates safe QR download filenames', () => {
    expect(makeDownloadFilename(' Summer Deal ', 'svg')).toBe('summer-deal-pad-qr.svg');
    expect(makeDownloadFilename('---', 'png')).toBe('adpadz-qr-pad-qr.png');
  });

  it('uses a clear placeholder for missing timestamps', () => {
    expect(formatDateTime(null)).toBe('--');
  });
});
