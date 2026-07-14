import { supabase } from '../supabase';

export const ADMIN_METRIC_KEYS = [
  'activeBusinesses',
  'totalCampaigns',
  'activeCampaigns',
  'draftCampaigns',
  'campaignsWithoutDates',
  'totalLeads',
  'newLeads',
  'totalQrScans',
  'publishedProfiles',
  'businessesWithoutPublishedProfiles',
  'communityMailers',
  'availablePlacements',
  'reservedPlacements',
  'soldPlacements',
  'communityMailersWithOpenPlacements',
] as const;

export type AdminMetricKey = (typeof ADMIN_METRIC_KEYS)[number];
export type AdminDataAvailability = 'available' | 'partial' | 'unavailable';

export type AdminDashboardMetrics = {
  values: Record<AdminMetricKey, number | null>;
  unavailable: AdminMetricKey[];
  availability: AdminDataAvailability;
  requestFailed: boolean;
};

export const ADMIN_ACTIVITY_SOURCES = ['business', 'campaign', 'lead', 'qr'] as const;
export type AdminActivitySource = (typeof ADMIN_ACTIVITY_SOURCES)[number];

export type AdminActivity = {
  id: string;
  source: AdminActivitySource;
  kind: string;
  title: string;
  detail: string;
  occurredAt: string;
};

export type AdminRecentActivity = {
  items: AdminActivity[];
  availability: AdminDataAvailability;
  requestFailed: boolean;
};

type AdminDataResponse = {
  data: unknown;
  error: unknown | null;
};

export interface AdminMetricsGateway {
  getDashboardMetrics(): Promise<AdminDataResponse>;
  getRecentActivity(limit: number): Promise<AdminDataResponse>;
}

const METRIC_DATABASE_KEYS: Record<AdminMetricKey, string> = {
  activeBusinesses: 'active_businesses',
  totalCampaigns: 'total_campaigns',
  activeCampaigns: 'active_campaigns',
  draftCampaigns: 'draft_campaigns',
  campaignsWithoutDates: 'campaigns_without_dates',
  totalLeads: 'total_leads',
  newLeads: 'new_leads',
  totalQrScans: 'total_qr_scans',
  publishedProfiles: 'published_profiles',
  businessesWithoutPublishedProfiles: 'businesses_without_published_profiles',
  communityMailers: 'community_mailers',
  availablePlacements: 'available_placements',
  reservedPlacements: 'reserved_placements',
  soldPlacements: 'sold_placements',
  communityMailersWithOpenPlacements: 'community_mailers_with_open_placements',
};

const defaultAdminMetricsGateway: AdminMetricsGateway = {
  async getDashboardMetrics() {
    const { data, error } = await supabase.rpc('get_adpadz_admin_dashboard_metrics');
    return { data, error };
  },

  async getRecentActivity(limit) {
    const { data, error } = await supabase.rpc('get_adpadz_admin_recent_activity', {
      limit_count: limit,
    });
    return { data, error };
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;
  if (Array.isArray(value) && value.length === 1 && isRecord(value[0])) return value[0];
  return null;
}

export function normalizeAdminMetricCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function emptyMetricValues(): Record<AdminMetricKey, number | null> {
  return Object.fromEntries(ADMIN_METRIC_KEYS.map(key => [key, null])) as Record<
    AdminMetricKey,
    number | null
  >;
}

export function unavailableAdminDashboardMetrics(requestFailed = false): AdminDashboardMetrics {
  return {
    values: emptyMetricValues(),
    unavailable: [...ADMIN_METRIC_KEYS],
    availability: 'unavailable',
    requestFailed,
  };
}

export function normalizeAdminDashboardMetrics(payload: unknown): AdminDashboardMetrics {
  const row = firstRecord(payload);
  if (!row) return unavailableAdminDashboardMetrics();

  const values = emptyMetricValues();
  for (const key of ADMIN_METRIC_KEYS) {
    values[key] = normalizeAdminMetricCount(row[METRIC_DATABASE_KEYS[key]]);
  }

  const unavailable = ADMIN_METRIC_KEYS.filter(key => values[key] === null);
  return {
    values,
    unavailable,
    availability: unavailable.length === 0
      ? 'available'
      : unavailable.length === ADMIN_METRIC_KEYS.length
        ? 'unavailable'
        : 'partial',
    requestFailed: false,
  };
}

function isActivitySource(value: unknown): value is AdminActivitySource {
  return typeof value === 'string' && ADMIN_ACTIVITY_SOURCES.some(source => source === value);
}

function normalizeAdminActivity(value: unknown): AdminActivity | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string'
    || value.id.length === 0
    || !isActivitySource(value.source)
    || typeof value.kind !== 'string'
    || value.kind.length === 0
    || typeof value.title !== 'string'
    || value.title.length === 0
    || typeof value.detail !== 'string'
    || typeof value.occurred_at !== 'string'
    || !Number.isFinite(Date.parse(value.occurred_at))
  ) {
    return null;
  }

  return {
    id: value.id,
    source: value.source,
    kind: value.kind,
    title: value.title,
    detail: value.detail,
    occurredAt: value.occurred_at,
  };
}

export function normalizeRecentAdminActivity(payload: unknown): AdminRecentActivity {
  if (!Array.isArray(payload)) {
    return { items: [], availability: 'unavailable', requestFailed: false };
  }

  const items = payload
    .map(normalizeAdminActivity)
    .filter((item): item is AdminActivity => item !== null)
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));

  return {
    items,
    availability: items.length === payload.length
      ? 'available'
      : items.length === 0
        ? 'unavailable'
        : 'partial',
    requestFailed: false,
  };
}

function logDevelopmentError(context: string, error: unknown): void {
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    console.error(`[Mission Control] ${context}`, error);
  }
}

export async function getAdminDashboardMetrics(
  gateway: AdminMetricsGateway = defaultAdminMetricsGateway,
): Promise<AdminDashboardMetrics> {
  try {
    const response = await gateway.getDashboardMetrics();
    if (response.error !== null) {
      logDevelopmentError('Dashboard metrics request failed.', response.error);
      return unavailableAdminDashboardMetrics(true);
    }
    return normalizeAdminDashboardMetrics(response.data);
  } catch (error) {
    logDevelopmentError('Dashboard metrics request threw an error.', error);
    return unavailableAdminDashboardMetrics(true);
  }
}

export function normalizeActivityLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1) return 20;
  return Math.min(limit, 50);
}

export async function getRecentAdminActivity(
  limit = 20,
  gateway: AdminMetricsGateway = defaultAdminMetricsGateway,
): Promise<AdminRecentActivity> {
  try {
    const response = await gateway.getRecentActivity(normalizeActivityLimit(limit));
    if (response.error !== null) {
      logDevelopmentError('Recent activity request failed.', response.error);
      return { items: [], availability: 'unavailable', requestFailed: true };
    }
    return normalizeRecentAdminActivity(response.data);
  } catch (error) {
    logDevelopmentError('Recent activity request threw an error.', error);
    return { items: [], availability: 'unavailable', requestFailed: true };
  }
}
