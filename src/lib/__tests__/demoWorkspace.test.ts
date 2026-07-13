import { describe, expect, it } from 'vitest';
import {
  DEMO_SAMPLE_DATA_NOTICE,
  DEMO_WORKSPACE_STORAGE_KEY,
  clearDemoWorkspaceState,
  createInitialDemoWorkspaceState,
  demoWorkspaceReducer,
  deserializeDemoWorkspaceState,
  getDemoConversionRate,
  loadDemoWorkspaceState,
  saveDemoWorkspaceState,
  serializeDemoWorkspaceState,
  type DemoWorkspaceStorage,
} from '../demoWorkspace';

function createMemoryStorage(): DemoWorkspaceStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

describe('demo workspace sample data', () => {
  it('returns fresh, clearly marked River City Outdoor Living fixtures', () => {
    const first = createInitialDemoWorkspaceState();
    const second = createInitialDemoWorkspaceState();

    expect(first.business.name).toBe('River City Outdoor Living');
    expect(first.sampleData).toBe(true);
    expect(first.sampleDataNotice).toBe(DEMO_SAMPLE_DATA_NOTICE);
    expect(first.campaigns).toHaveLength(3);
    expect(first.leads.every(lead => lead.isSample)).toBe(true);
    expect(first).not.toBe(second);
    expect(first.campaigns).not.toBe(second.campaigns);
  });
});

describe('demo workspace reducer', () => {
  it('creates a fictional campaign without mutating the prior state', () => {
    const state = createInitialDemoWorkspaceState();
    const next = demoWorkspaceReducer(state, {
      type: 'campaign/create',
      payload: {
        title: 'Poolside Movie Nights',
        headline: 'Make Friday nights feel like a vacation',
        offerTitle: 'Free lighting concept',
        status: 'draft',
        format: 'tap_reveal',
        outputs: ['smart_card', 'interactive_ad', 'interactive_ad'],
      },
    });

    expect(next).not.toBe(state);
    expect(state.campaigns).toHaveLength(3);
    expect(next.campaigns).toHaveLength(4);
    expect(next.campaigns[0]).toMatchObject({
      isSample: true,
      title: 'Poolside Movie Nights',
      status: 'draft',
      outputs: ['smart_card', 'interactive_ad'],
    });
    expect(next.activity[0]).toMatchObject({ type: 'campaign_created', campaignId: next.campaigns[0].id });
  });

  it('changes campaign and lead statuses and ignores missing or unchanged records', () => {
    const state = createInitialDemoWorkspaceState();
    const campaignId = state.campaigns[0].id;
    const leadId = state.leads[0].id;
    const activeAgain = demoWorkspaceReducer(state, { type: 'campaign/status', campaignId, status: 'active' });
    const missing = demoWorkspaceReducer(state, { type: 'lead/status', leadId: 'missing', status: 'closed' });
    const campaignChanged = demoWorkspaceReducer(state, { type: 'campaign/status', campaignId, status: 'expired' });
    const leadChanged = demoWorkspaceReducer(campaignChanged, { type: 'lead/status', leadId, status: 'qualified' });

    expect(activeAgain).toBe(state);
    expect(missing).toBe(state);
    expect(campaignChanged.campaigns.find(campaign => campaign.id === campaignId)?.status).toBe('expired');
    expect(leadChanged.leads.find(lead => lead.id === leadId)?.status).toBe('qualified');
    expect(leadChanged.activity[0].type).toBe('lead_status_changed');
  });

  it('simulates QR scans in campaign and workspace metrics', () => {
    const state = createInitialDemoWorkspaceState();
    const campaign = state.campaigns[0];
    const next = demoWorkspaceReducer(state, { type: 'analytics/scan', campaignId: campaign.id });

    expect(next.metrics.qrScans).toBe(state.metrics.qrScans + 1);
    expect(next.campaigns.find(item => item.id === campaign.id)?.metrics.qrScans).toBe(campaign.metrics.qrScans + 1);
    expect(next.activity[0].type).toBe('qr_scan');
  });

  it('reveals an offer only once per campaign and offer', () => {
    const state = createInitialDemoWorkspaceState();
    const campaign = state.campaigns[0];
    const revealed = demoWorkspaceReducer(state, { type: 'offer/reveal', campaignId: campaign.id, offerId: campaign.offer.id });
    const repeated = demoWorkspaceReducer(revealed, { type: 'offer/reveal', campaignId: campaign.id, offerId: campaign.offer.id });

    expect(revealed.metrics.offerReveals).toBe(state.metrics.offerReveals + 1);
    expect(revealed.revealedOfferIds).toContain(`${campaign.id}:${campaign.offer.id}`);
    expect(repeated).toBe(revealed);
  });

  it('submits a customizable sample lead and updates linked campaign metrics', () => {
    const state = createInitialDemoWorkspaceState();
    const campaign = state.campaigns[1];
    const next = demoWorkspaceReducer(state, {
      type: 'lead/submit-sample',
      payload: {
        name: 'Demo Visitor',
        email: 'visitor@example.com',
        phone: null,
        campaignId: campaign.id,
        source: 'interactive_campaign',
      },
    });

    expect(next.leads[0]).toMatchObject({
      isSample: true,
      name: 'Demo Visitor',
      email: 'visitor@example.com',
      phone: null,
      status: 'new',
      campaignId: campaign.id,
    });
    expect(next.metrics.leads).toBe(state.metrics.leads + 1);
    expect(next.campaigns.find(item => item.id === campaign.id)?.metrics.leads).toBe(campaign.metrics.leads + 1);
  });

  it('counts a booking request as both a lead and a booking', () => {
    const state = createInitialDemoWorkspaceState();
    const campaign = state.campaigns[0];
    const next = demoWorkspaceReducer(state, {
      type: 'lead/submit-sample',
      payload: {
        name: 'Demo Booking Visitor',
        email: 'booking@example.com',
        phone: null,
        message: 'I would like a sample design visit.',
        campaignId: campaign.id,
        source: 'booking_request',
      },
    });

    expect(next.metrics.leads).toBe(state.metrics.leads + 1);
    expect(next.metrics.bookings).toBe(state.metrics.bookings + 1);
  });

  it('does not record customer activity for inactive campaigns', () => {
    const state = createInitialDemoWorkspaceState();
    const campaign = state.campaigns[2];
    const scan = demoWorkspaceReducer(state, { type: 'analytics/scan', campaignId: campaign.id });
    const reveal = demoWorkspaceReducer(state, { type: 'offer/reveal', campaignId: campaign.id, offerId: campaign.offer.id });
    const lead = demoWorkspaceReducer(state, {
      type: 'lead/submit-sample',
      payload: {
        name: 'Inactive Campaign Visitor',
        campaignId: campaign.id,
        source: 'booking_request',
      },
    });

    expect(scan).toBe(state);
    expect(reveal).toBe(state);
    expect(lead).toBe(state);
  });

  it('resets all session changes to a fresh fixture', () => {
    const initial = createInitialDemoWorkspaceState();
    const changed = demoWorkspaceReducer(initial, { type: 'analytics/scan', campaignId: initial.campaigns[0].id });
    const reset = demoWorkspaceReducer(changed, { type: 'workspace/reset' });

    expect(reset).toEqual(createInitialDemoWorkspaceState());
    expect(reset).not.toBe(initial);
  });
});

describe('demo workspace session serialization', () => {
  it('round-trips a valid workspace through the versioned envelope', () => {
    const state = createInitialDemoWorkspaceState();
    expect(deserializeDemoWorkspaceState(serializeDemoWorkspaceState(state))).toEqual(state);
  });

  it('rejects corrupted, outdated, and structurally invalid snapshots', () => {
    const state = createInitialDemoWorkspaceState();
    expect(deserializeDemoWorkspaceState('{not json')).toBeNull();
    expect(deserializeDemoWorkspaceState(JSON.stringify({ version: 99, workspace: state }))).toBeNull();
    expect(deserializeDemoWorkspaceState(JSON.stringify({ version: 1, workspace: { ...state, metrics: null } }))).toBeNull();
  });

  it('loads, saves, clears, and safely falls back using a storage adapter', () => {
    const storage = createMemoryStorage();
    const state = createInitialDemoWorkspaceState();
    const changed = demoWorkspaceReducer(state, { type: 'analytics/scan', campaignId: state.campaigns[0].id });

    expect(loadDemoWorkspaceState(storage)).toEqual(state);
    saveDemoWorkspaceState(changed, storage);
    expect(storage.values.has(DEMO_WORKSPACE_STORAGE_KEY)).toBe(true);
    expect(loadDemoWorkspaceState(storage)).toEqual(changed);
    clearDemoWorkspaceState(storage);
    expect(storage.values.has(DEMO_WORKSPACE_STORAGE_KEY)).toBe(false);
    expect(loadDemoWorkspaceState(storage)).toEqual(state);
  });
});

describe('demo metrics', () => {
  it('calculates a stable lead conversion percentage', () => {
    expect(getDemoConversionRate({
      profileViews: 0,
      campaignViews: 200,
      qrScans: 0,
      offerReveals: 0,
      leads: 17,
      bookings: 0,
      offerClaims: 0,
    })).toBe(8.5);
  });
});
