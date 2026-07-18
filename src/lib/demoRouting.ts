import { DEMO_DEFAULT_BUSINESS_SLUG, getDemoBusinessPreset } from './demoPresets';

export const DEMO_VIEWS = ['overview', 'campaigns', 'customer', 'qr', 'leads', 'analytics'] as const;
export type DemoView = (typeof DEMO_VIEWS)[number];

export type DemoRouteState = {
  businessSlug: string | null;
  view: DemoView;
  campaignId: string | null;
  audit: boolean;
};

export function parseDemoRoute(search: string | URLSearchParams): DemoRouteState {
  const params = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    : search;
  const businessSlug = getDemoBusinessPreset(params.get('business'))?.slug ?? null;
  const requestedView = params.get('view');
  return {
    businessSlug,
    view: isDemoView(requestedView) ? requestedView : 'overview',
    campaignId: normalizeValue(params.get('campaign')),
    audit: params.get('audit') === '1',
  };
}

export function buildDemoRoute(
  businessSlug: string,
  view: DemoView = 'overview',
  campaignId?: string | null,
  audit = false,
): string {
  const safeBusinessSlug = getDemoBusinessPreset(businessSlug)?.slug ?? DEMO_DEFAULT_BUSINESS_SLUG;
  const params = new URLSearchParams({ business: safeBusinessSlug, view });
  if (campaignId) params.set('campaign', campaignId);
  if (audit) params.set('audit', '1');
  return `/demo/workspace?${params.toString()}`;
}

export function isDemoView(value: string | null): value is DemoView {
  return value !== null && DEMO_VIEWS.includes(value as DemoView);
}

function normalizeValue(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}
