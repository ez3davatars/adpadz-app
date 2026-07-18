import { describe, expect, it } from 'vitest';
import type { CampaignRecord } from '../ads';
import { evaluateCampaignReadiness, evaluateCampaignReadinessBatch, type CampaignReadinessContext } from '../campaignReadiness';

const campaign: CampaignRecord = {
  id: 'campaign-1', owner_id: 'owner-1', title: 'Spring Cleaning', headline: 'A brighter home starts here',
  description: 'Book a local spring cleaning visit.', offer_title: '20% off', cta_label: 'Book now',
  cta_url: 'https://example.com/book', status: 'draft', primary_image_id: 'asset-1', primary_qr_id: 'qr-1',
};

const complete: CampaignReadinessContext = {
  campaign,
  business: { name: 'Brightline Home', logoUrl: '/logo.png', category: 'Home Services', location: 'Jacksonville', website: 'https://example.com', profilePublished: true, active: true },
  campaignImageUrl: '/campaign.png',
  outputs: [{ campaign_id: campaign.id, output_type: 'interactive_ad', enabled: true, sort_order: 0 }],
  qr: { exists: true, valid: true, publishable: true, publicRouteResolves: true },
  mailer: null,
};

describe('campaign readiness engine', () => {
  it('evaluates an empty campaign as blocked and incomplete', () => {
    const result = evaluateCampaignReadiness({ campaign: { id: 'empty', owner_id: 'owner', title: '', status: 'draft' } });
    expect(result.overallStatus).toBe('blocked');
    expect(result.completionPercent).toBeLessThan(20);
    expect(result.nextAction?.id).toBe('core-title');
  });

  it('returns a deterministic 100% for a complete campaign', () => {
    const result = evaluateCampaignReadiness(complete);
    expect(result.completionPercent).toBe(100);
    expect(result.overallStatus).toBe('ready');
  });

  it('does not reduce completion for an optional mailer purchase', () => {
    expect(evaluateCampaignReadiness({ ...complete, mailer: null }).completionPercent).toBe(100);
  });

  it.each([
    ['image', { campaignImageUrl: null, campaign: { ...campaign, primary_image_id: null } }, 'core-primary_image'],
    ['CTA', { campaign: { ...campaign, cta_label: null } }, 'core-cta_label'],
    ['category', { business: { ...complete.business, category: null } }, 'discovery-category'],
    ['location', { business: { ...complete.business, location: null } }, 'discovery-location'],
  ])('prioritizes missing %s', (_label, changes, expected) => {
    const result = evaluateCampaignReadiness({ ...complete, ...changes } as CampaignReadinessContext);
    expect(result.nextAction?.id).toBe(expected);
    expect(result.completionPercent).toBeLessThan(100);
  });

  it('blocks an invalid expiration window', () => {
    const result = evaluateCampaignReadiness({ ...complete, campaign: { ...campaign, start_date: '2026-08-01', end_date: '2026-07-01' } });
    expect(result.blockers.some(issue => issue.field === 'expiration')).toBe(true);
  });

  it('reports a missing QR destination', () => {
    const result = evaluateCampaignReadiness({ ...complete, qr: null });
    expect(result.sections.find(section => section.key === 'qr')?.status).toBe('incomplete');
  });

  it('treats an unpurchased mailer placement as guidance, not lost completion', () => {
    const result = evaluateCampaignReadiness({ ...complete, mailer: { placementExists: false, placementConfirmed: false } });
    expect(result.completionPercent).toBe(100);
    expect(result.sections.find(section => section.key === 'mailer')?.status).toBe('ready');
  });

  it('represents approval pending and corrections without inventing campaign statuses', () => {
    const pending = evaluateCampaignReadiness({ ...complete, mailer: { placementExists: true, placementConfirmed: true, artworkUsable: true, proofStatus: 'pending' } });
    const correction = evaluateCampaignReadiness({ ...complete, mailer: { placementExists: true, placementConfirmed: true, artworkUsable: true, proofStatus: 'changes_requested' } });
    expect(pending.sections.find(section => section.key === 'approval')?.status).toBe('needs_attention');
    expect(correction.overallStatus).toBe('blocked');
  });

  it('marks archived campaigns as not publishable', () => {
    const result = evaluateCampaignReadiness({ ...complete, campaign: { ...campaign, status: 'expired' } });
    expect(result.sections.find(section => section.key === 'publishing')?.status).not.toBe('ready');
  });

  it('uses role-appropriate admin actions', () => {
    const result = evaluateCampaignReadiness({ ...complete, role: 'admin', mailer: { placementExists: true, placementConfirmed: true, artworkUsable: true, proofStatus: 'changes_requested' } });
    expect(result.nextAction?.destination).toBe('/admin/community-mailers');
  });

  it('supports batch evaluation without I/O', () => {
    expect(evaluateCampaignReadinessBatch([complete, { ...complete, campaign: { ...campaign, id: 'campaign-2' } }]).map(result => result.campaignId)).toEqual(['campaign-1', 'campaign-2']);
  });
});
