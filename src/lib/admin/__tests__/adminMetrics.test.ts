import { describe, expect, it, vi } from 'vitest';
import {
  ADMIN_METRIC_KEYS,
  getAdminDashboardMetrics,
  getRecentAdminActivity,
  normalizeActivityLimit,
  normalizeAdminDashboardMetrics,
  normalizeAdminMetricCount,
  normalizeRecentAdminActivity,
  type AdminMetricsGateway,
} from '../adminMetrics';

const completeMetricRow = {
  active_businesses: 10,
  total_campaigns: 20,
  active_campaigns: 4,
  draft_campaigns: 6,
  campaigns_without_dates: 2,
  total_leads: 30,
  new_leads: 3,
  total_qr_scans: 40,
  published_profiles: 8,
  businesses_without_published_profiles: 2,
  community_mailers: 5,
  available_placements: 12,
  reserved_placements: 7,
  sold_placements: 9,
  community_mailers_with_open_placements: 3,
};

function createGateway(overrides: Partial<AdminMetricsGateway> = {}): AdminMetricsGateway {
  return {
    getDashboardMetrics: async () => ({ data: [completeMetricRow], error: null }),
    getRecentActivity: async () => ({ data: [], error: null }),
    ...overrides,
  };
}

describe('dashboard metric normalization', () => {
  it('accepts exact non-negative safe integer counts, including genuine zero', () => {
    expect(normalizeAdminMetricCount(0)).toBe(0);
    expect(normalizeAdminMetricCount(42)).toBe(42);
  });

  it.each([null, undefined, '0', -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE])(
    'marks malformed count %j unavailable rather than coercing it to zero',
    value => {
      expect(normalizeAdminMetricCount(value)).toBeNull();
    },
  );

  it('normalizes the single table-returning RPC row and preserves exact values', () => {
    const result = normalizeAdminDashboardMetrics([{ ...completeMetricRow, active_businesses: 0 }]);
    expect(result.values.activeBusinesses).toBe(0);
    expect(result.values.totalQrScans).toBe(40);
    expect(result.unavailable).toEqual([]);
    expect(result.availability).toBe('available');
    expect(result.requestFailed).toBe(false);
  });

  it('preserves valid metrics when one field is null or malformed', () => {
    const result = normalizeAdminDashboardMetrics([{
      ...completeMetricRow,
      total_qr_scans: null,
    }]);

    expect(result.values.totalQrScans).toBeNull();
    expect(result.values.activeBusinesses).toBe(10);
    expect(result.unavailable).toEqual(['totalQrScans']);
    expect(result.availability).toBe('partial');
  });

  it.each([null, {}, [], [{}, {}], 'bad response'])(
    'marks an absent or malformed RPC row unavailable (%j)',
    payload => {
      const result = normalizeAdminDashboardMetrics(payload);
      expect(result.availability).toBe('unavailable');
      expect(result.unavailable).toEqual(ADMIN_METRIC_KEYS);
      expect(Object.values(result.values).every(value => value === null)).toBe(true);
    },
  );

  it('distinguishes a request failure from an unavailable payload', async () => {
    const result = await getAdminDashboardMetrics(createGateway({
      getDashboardMetrics: async () => ({ data: null, error: new Error('private detail') }),
    }));
    expect(result.requestFailed).toBe(true);
    expect(result.availability).toBe('unavailable');
    expect(result.values.totalCampaigns).toBeNull();
  });

  it('handles a thrown metrics request without inventing values', async () => {
    const result = await getAdminDashboardMetrics(createGateway({
      getDashboardMetrics: async () => {
        throw new Error('offline');
      },
    }));
    expect(result.requestFailed).toBe(true);
    expect(Object.values(result.values).every(value => value === null)).toBe(true);
  });
});

describe('recent activity normalization', () => {
  const validRows = [
    {
      id: 'business:1',
      source: 'business',
      kind: 'created',
      title: 'First Business',
      detail: 'Business created',
      occurred_at: '2026-07-14T10:00:00.000Z',
    },
    {
      id: 'campaign:2',
      source: 'campaign',
      kind: 'updated',
      title: 'Summer Campaign',
      detail: 'Campaign updated',
      occurred_at: '2026-07-14T12:00:00.000Z',
    },
  ];

  it('normalizes, merges, and sorts valid activity rows newest first', () => {
    const result = normalizeRecentAdminActivity(validRows);
    expect(result.availability).toBe('available');
    expect(result.items.map(item => item.id)).toEqual(['campaign:2', 'business:1']);
    expect(result.items[0]).toMatchObject({
      source: 'campaign',
      occurredAt: '2026-07-14T12:00:00.000Z',
    });
  });

  it('keeps valid sources when another row is malformed or has an invalid date', () => {
    const result = normalizeRecentAdminActivity([
      validRows[0],
      { ...validRows[1], occurred_at: 'not-a-date' },
      {
        id: 'qr:3',
        source: 'qr',
        kind: 'scanned',
        title: 'QR scan',
        detail: '',
        occurred_at: '2026-07-14T11:00:00.000Z',
      },
    ]);

    expect(result.items.map(item => item.id)).toEqual(['qr:3', 'business:1']);
    expect(result.availability).toBe('partial');
    expect(result.requestFailed).toBe(false);
  });

  it('distinguishes a successful empty result from unavailable activity', () => {
    expect(normalizeRecentAdminActivity([])).toEqual({
      items: [],
      availability: 'available',
      requestFailed: false,
    });
    expect(normalizeRecentAdminActivity(null)).toEqual({
      items: [],
      availability: 'unavailable',
      requestFailed: false,
    });
    expect(normalizeRecentAdminActivity([{ occurred_at: 'not-a-date' }]).availability).toBe('unavailable');
  });

  it('marks an RPC error unavailable while preserving a safe public result', async () => {
    const result = await getRecentAdminActivity(20, createGateway({
      getRecentActivity: async () => ({ data: null, error: new Error('private detail') }),
    }));
    expect(result).toEqual({
      items: [],
      availability: 'unavailable',
      requestFailed: true,
    });
  });

  it('normalizes and caps request limits before calling the gateway', async () => {
    const getRecentActivity = vi.fn(async () => ({ data: [], error: null }));
    const gateway = createGateway({ getRecentActivity });

    await getRecentAdminActivity(500, gateway);
    expect(getRecentActivity).toHaveBeenCalledWith(50);
    expect(normalizeActivityLimit(0)).toBe(20);
    expect(normalizeActivityLimit(2.5)).toBe(20);
    expect(normalizeActivityLimit(12)).toBe(12);
  });
});
