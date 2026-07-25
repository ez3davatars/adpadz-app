import { describe, expect, it } from 'vitest';
import { isPublicStandaloneRoute } from './publicRoutes';

describe('isPublicStandaloneRoute', () => {
  it.each([
    '/q/summer-offer',
    '/c/local-coffee',
    '/business/local-coffee',
    '/community-cards/downtown',
    '/ad/campaign-id',
    '/redeem/offer-id',
    '/feed',
  ])('allows %s to render without waiting for an auth session', pathname => {
    expect(isPublicStandaloneRoute(pathname)).toBe(true);
  });

  it.each([
    '/app/business/dashboard',
    '/admin/dashboard',
    '/dashboard/smart-cards',
    '/q/',
  ])('keeps %s behind session restoration', pathname => {
    expect(isPublicStandaloneRoute(pathname)).toBe(false);
  });
});