import { describe, expect, it } from 'vitest';
import { safeActionHref, safeHttpUrl } from '../urls';

describe('safeHttpUrl', () => {
  it('normalizes HTTP destinations', () => {
    expect(safeHttpUrl(' https://example.com/offer ')).toBe('https://example.com/offer');
  });

  it('rejects executable, malformed, and control-character URLs', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('/relative')).toBeNull();
    expect(safeHttpUrl("https://example.com/\nnext")).toBeNull();
  });
});

describe('safeActionHref', () => {
  it('allows contact actions and HTTP destinations', () => {
    expect(safeActionHref('tel:+15550100')).toBe('tel:+15550100');
    expect(safeActionHref('mailto:hello@example.com')).toBe('mailto:hello@example.com');
    expect(safeActionHref('https://example.com')).toBe('https://example.com/');
  });

  it('rejects unsafe protocols', () => {
    expect(safeActionHref('data:text/html,test')).toBeNull();
    expect(safeActionHref('javascript:alert(1)')).toBeNull();
  });
});
