import { describe, expect, it } from 'vitest';
import {
  DEMO_BUSINESS_PRESETS,
  DEMO_DEFAULT_BUSINESS_SLUG,
  createDemoPresetWorkspace,
  getDemoBusinessPreset,
} from '../demoPresets';
import {
  clearDemoWorkspaceState,
  demoWorkspaceActions,
  demoWorkspaceReducer,
  getDemoWorkspaceStorageKey,
  loadDemoWorkspaceState,
  saveDemoWorkspaceState,
  type DemoWorkspaceStorage,
} from '../demoWorkspace';
import { buildDemoRoute, parseDemoRoute } from '../demoRouting';

function memoryStorage(): DemoWorkspaceStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

describe('demo business preset integrity', () => {
  it('provides six complete, unique fictional business stories', () => {
    expect(DEMO_BUSINESS_PRESETS).toHaveLength(6);
    expect(new Set(DEMO_BUSINESS_PRESETS.map(preset => preset.slug)).size).toBe(6);
    for (const preset of DEMO_BUSINESS_PRESETS) {
      expect(preset.challenge.length).toBeGreaterThan(40);
      expect(preset.journey.length).toBeGreaterThan(40);
      expect(preset.outcome.length).toBeGreaterThan(40);
      expect(preset.services.length).toBeGreaterThanOrEqual(3);
      expect(preset.campaigns.length).toBeGreaterThanOrEqual(3);
      expect(preset.leads.length).toBeGreaterThanOrEqual(3);
      const state = createDemoPresetWorkspace(preset.slug);
      expect(state.business.slug).toBe(preset.slug);
      expect(state.campaigns.some(campaign => campaign.status === 'active')).toBe(true);
      expect(state.campaigns.every(campaign => campaign.isSample)).toBe(true);
      expect(state.leads.every(lead => lead.email?.endsWith('@example.com'))).toBe(true);
    }
    expect(getDemoBusinessPreset(DEMO_DEFAULT_BUSINESS_SLUG)?.flagship).toBe(true);
  });
});

describe('business-scoped demo state', () => {
  it('keeps changes isolated between businesses and resets only the selected story', () => {
    const storage = memoryStorage();
    const river = createDemoPresetWorkspace('river-city-outdoor-living');
    const restaurant = createDemoPresetWorkspace('harbor-and-hearth');
    const changedRiver = demoWorkspaceReducer(river, demoWorkspaceActions.simulateScan(river.campaigns[0].id));
    const changedRestaurant = demoWorkspaceReducer(restaurant, demoWorkspaceActions.updateBusiness({ tagline: 'A changed restaurant story.' }));

    saveDemoWorkspaceState(changedRiver, storage);
    saveDemoWorkspaceState(changedRestaurant, storage);

    expect(loadDemoWorkspaceState(storage, river.business.slug).metrics.qrScans).toBe(river.metrics.qrScans + 1);
    expect(loadDemoWorkspaceState(storage, restaurant.business.slug).business.tagline).toBe('A changed restaurant story.');

    clearDemoWorkspaceState(storage, river.business.slug);
    expect(loadDemoWorkspaceState(storage, river.business.slug)).toEqual(river);
    expect(loadDemoWorkspaceState(storage, restaurant.business.slug).business.tagline).toBe('A changed restaurant story.');
    expect(storage.values.has(getDemoWorkspaceStorageKey(restaurant.business.slug))).toBe(true);
  });

  it('propagates campaign edits and publishing through the shared state', () => {
    const state = createDemoPresetWorkspace('paws-and-polish');
    const campaign = state.campaigns[2];
    const edited = demoWorkspaceReducer(state, demoWorkspaceActions.updateCampaign(campaign.id, {
      title: 'Holiday Calm-Care Appointments',
      offerTitle: 'Comfort-first holiday upgrade',
    }));
    const published = demoWorkspaceReducer(edited, demoWorkspaceActions.setCampaignStatus(campaign.id, 'active'));

    expect(published.campaigns.find(item => item.id === campaign.id)).toMatchObject({
      title: 'Holiday Calm-Care Appointments',
      status: 'active',
      offer: { title: 'Comfort-first holiday upgrade' },
    });
  });

  it('records measurable engagement without duplicating a claim', () => {
    const state = createDemoPresetWorkspace('northstar-story-co');
    const campaign = state.campaigns[0];
    const viewed = demoWorkspaceReducer(state, demoWorkspaceActions.recordProfileView());
    const claimed = demoWorkspaceReducer(viewed, demoWorkspaceActions.claimOffer(campaign.id, campaign.offer.id));
    const duplicate = demoWorkspaceReducer(claimed, demoWorkspaceActions.claimOffer(campaign.id, campaign.offer.id));
    expect(viewed.metrics.profileViews).toBe(state.metrics.profileViews + 1);
    expect(claimed.metrics.offerClaims).toBe(state.metrics.offerClaims + 1);
    expect(duplicate).toBe(claimed);
  });
});

describe('shareable demo routes', () => {
  it('parses valid values and safely rejects invalid business, view, and empty campaign values', () => {
    expect(parseDemoRoute('?business=harbor-and-hearth&view=customer&campaign=campaign-1&audit=1')).toEqual({
      businessSlug: 'harbor-and-hearth',
      view: 'customer',
      campaignId: 'campaign-1',
      audit: true,
    });
    expect(parseDemoRoute('?business=missing&view=unknown&campaign=')).toEqual({
      businessSlug: null,
      view: 'overview',
      campaignId: null,
      audit: false,
    });
  });

  it('builds a stable shareable route with safe defaults', () => {
    expect(buildDemoRoute('harbor-and-hearth', 'analytics')).toBe('/demo/workspace?business=harbor-and-hearth&view=analytics');
    expect(buildDemoRoute('missing', 'overview')).toContain(`business=${DEMO_DEFAULT_BUSINESS_SLUG}`);
  });
});
