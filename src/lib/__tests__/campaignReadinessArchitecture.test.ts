import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('campaign readiness architecture', () => {
  it('uses the shared evaluator across business surfaces', () => {
    expect(read('pages/business/CreateAd.tsx')).toContain('evaluateCampaignReadiness');
    expect(read('pages/business/Campaigns.tsx')).toContain('loadBusinessCampaignReadiness');
    expect(read('pages/business/Dashboard.tsx')).toContain('loadBusinessCampaignReadiness');
    expect(read('pages/business/CampaignDistribution.tsx')).toContain('evaluateCampaignReadiness');
  });

  it('keeps social readiness as a compatibility adapter over the canonical engine', () => {
    expect(read('lib/campaignDistribution.ts')).toContain('evaluateCampaignReadiness({');
  });

  it('gives Mission Control an admin-only computed projection without readiness persistence', () => {
    const migration = read('../supabase/migrations/20260718020000_add_admin_campaign_readiness_rpc.sql');
    expect(migration).toContain('public.is_adpadz_admin(auth.uid())');
    expect(migration).toContain('REVOKE ALL');
    expect(migration).not.toContain('campaign_readiness_snapshots');
  });
});
