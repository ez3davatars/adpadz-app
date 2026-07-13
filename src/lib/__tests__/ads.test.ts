import { describe, expect, it } from 'vitest';
import {
  getCampaignFormatLabel,
  getCampaignOffer,
  getCampaignSection,
  getCampaignTitle,
  isCampaignPublicNow,
  normalizeCampaignOutput,
  type CampaignOutputRecord,
  type CampaignRecord,
  type SmartCardCampaign,
} from '../ads';

const campaign: CampaignRecord = {
  id: 'campaign-1',
  owner_id: 'owner-1',
  title: 'Summer Tune-Up',
  headline: 'Keep your AC running',
  offer_title: 'Save 20%',
  status: 'active',
};

function makeOutput(
  overrides: Partial<CampaignOutputRecord> = {},
): CampaignOutputRecord {
  return {
    campaign_id: campaign.id,
    output_type: 'smart_card',
    enabled: true,
    sort_order: 0,
    metadata: { section: 'promotions', format: 'interactive_story' },
    campaigns: campaign,
    ...overrides,
  };
}

function requireNormalized(record = makeOutput()): SmartCardCampaign {
  const normalized = normalizeCampaignOutput(record);
  if (!normalized) throw new Error('Expected campaign output to normalize');
  return normalized;
}

describe('campaign output normalization', () => {
  it('normalizes joined campaign objects and supplies empty metadata', () => {
    const normalized = requireNormalized(makeOutput({ metadata: null }));
    expect(normalized.campaign).toEqual(campaign);
    expect(normalized.metadata).toEqual({});
  });

  it('uses the first record returned by array-shaped Supabase joins', () => {
    const secondCampaign = { ...campaign, id: 'campaign-2', title: 'Second' };
    const normalized = requireNormalized(makeOutput({
      campaigns: [campaign, secondCampaign],
    }));

    expect(normalized.campaign.id).toBe('campaign-1');
  });

  it('rejects missing and empty campaign joins', () => {
    expect(normalizeCampaignOutput(makeOutput({ campaigns: null }))).toBeNull();
    expect(normalizeCampaignOutput(makeOutput({ campaigns: [] }))).toBeNull();
  });
});

describe('public campaign schedule checks', () => {
  const now = new Date('2026-07-10T16:00:00.000Z');
  const publicCampaign: CampaignRecord = {
    ...campaign,
    business_id: 'business-1',
    start_date: '2026-07-10T15:00:00.000Z',
    end_date: '2026-07-10T17:00:00.000Z',
  };

  it('allows active and started scheduled campaigns inside their window', () => {
    expect(isCampaignPublicNow(publicCampaign, now)).toBe(true);
    expect(isCampaignPublicNow({ ...publicCampaign, status: 'scheduled' }, now)).toBe(true);
  });

  it('rejects drafts, missing Hubs, early schedules, and ended campaigns', () => {
    expect(isCampaignPublicNow({ ...publicCampaign, status: 'draft' }, now)).toBe(false);
    expect(isCampaignPublicNow({ ...publicCampaign, business_id: null }, now)).toBe(false);
    expect(isCampaignPublicNow({ ...publicCampaign, status: 'scheduled', start_date: null }, now)).toBe(false);
    expect(isCampaignPublicNow({ ...publicCampaign, start_date: '2026-07-10T17:00:00.000Z' }, now)).toBe(false);
    expect(isCampaignPublicNow({ ...publicCampaign, end_date: '2026-07-10T15:00:00.000Z' }, now)).toBe(false);
  });
});

describe('campaign presentation helpers', () => {
  it('selects sections and defaults missing sections to promotions', () => {
    expect(getCampaignSection(requireNormalized())).toBe('promotions');
    expect(getCampaignSection(requireNormalized(makeOutput({ metadata: {} })))).toBe('promotions');
    expect(getCampaignSection(requireNormalized(makeOutput({
      metadata: { section: 'proof' },
    })))).toBe('proof');
  });

  it('uses title, headline, and generic fallbacks in priority order', () => {
    expect(getCampaignTitle(requireNormalized())).toBe('Summer Tune-Up');
    expect(getCampaignTitle(requireNormalized(makeOutput({
      campaigns: { ...campaign, title: '', headline: 'Headline fallback' },
    })))).toBe('Headline fallback');
    expect(getCampaignTitle(requireNormalized(makeOutput({
      campaigns: { ...campaign, title: '', headline: '' },
    })))).toBe('Campaign');
  });

  it('humanizes output format labels', () => {
    expect(getCampaignFormatLabel(requireNormalized())).toBe('Interactive Story');
    expect(getCampaignFormatLabel(requireNormalized(makeOutput({ metadata: {} })))).toBe('Interactive');
  });

  it('selects the first available campaign offer', () => {
    expect(getCampaignOffer(requireNormalized())).toBe('Save 20%');
    expect(getCampaignOffer(requireNormalized(makeOutput({
      campaigns: {
        ...campaign,
        offer_title: '',
        offer_description: 'Free inspection',
      },
    })))).toBe('Free inspection');
    expect(getCampaignOffer(requireNormalized(makeOutput({
      campaigns: {
        ...campaign,
        offer_title: null,
        offer_description: null,
      },
    })))).toBeNull();
  });
});
