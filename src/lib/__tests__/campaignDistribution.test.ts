import { describe, expect, it } from 'vitest';
import {
  SOCIAL_FORMATS, SOCIAL_TEMPLATES, buildSocialFilename, buildSuggestedCaption,
  buildSuggestedHashtags, evaluateDistributionReadiness, type CampaignCreativeData,
} from '../campaignDistribution';

const creative: CampaignCreativeData = {
  campaign: {
    id: 'campaign-1', owner_id: 'owner-1', title: 'Summer Special', headline: 'Cool down locally',
    offer_title: '20% off lunch', cta_label: 'Order today', cta_url: 'https://example.com/summer',
    status: 'active', end_date: '2026-08-31T12:00:00Z', primary_image_id: 'asset-1',
  },
  businessName: 'Harbor & Hearth', businessLogoUrl: 'https://example.com/logo.png',
  campaignImageUrl: 'https://example.com/campaign.png', primaryColor: '#13251b', accentColor: '#b0ff00',
  website: 'https://example.com', phone: null, category: 'Dining', city: 'Jacksonville NC',
  campaignUrl: 'https://example.com/summer',
};

describe('campaign distribution', () => {
  it('defines the four exact launch formats', () => {
    expect(SOCIAL_FORMATS.map(({ width, height }) => [width, height])).toEqual([[1080, 1080], [1080, 1350], [1200, 628], [1080, 1920]]);
  });

  it('limits launch templates to three', () => expect(SOCIAL_TEMPLATES).toHaveLength(3));

  it('builds a modest deterministic hashtag list', () => {
    expect(buildSuggestedHashtags(creative)).toEqual(['#SupportLocal', '#JacksonvilleNC', '#LocalDining', '#HarborHearth', '#Adpadz']);
  });

  it('builds a caption from campaign-owned content', () => {
    const caption = buildSuggestedCaption(creative);
    expect(caption).toContain('Cool down locally');
    expect(caption).toContain('20% off lunch');
    expect(caption).toContain('#SupportLocal');
  });

  it('builds a meaningful filename', () => {
    expect(buildSocialFilename('Harbor & Hearth', 'Summer Special', 'square')).toBe('harbor-hearth-summer-special-square.png');
  });

  it('reports missing image and message', () => {
    const incomplete = { ...creative, campaignImageUrl: null, campaign: { ...creative.campaign, headline: null, offer_title: null } };
    expect(evaluateDistributionReadiness(incomplete, { template: 'offer', showQr: false }).issues.map(issue => issue.field)).toEqual(['headline', 'hero_image']);
  });

  it('reports a QR destination only when QR is enabled', () => {
    const withoutDestination = { ...creative, campaignUrl: null };
    expect(evaluateDistributionReadiness(withoutDestination, { template: 'offer', showQr: false }).ready).toBe(true);
    expect(evaluateDistributionReadiness(withoutDestination, { template: 'offer', showQr: true }).issues[0].field).toBe('qr_destination');
  });

  it('requires a logo for Brand Focus', () => {
    expect(evaluateDistributionReadiness({ ...creative, businessLogoUrl: null }, { template: 'brand', showQr: false }).issues[0].field).toBe('logo');
  });
});
