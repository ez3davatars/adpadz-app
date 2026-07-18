import type { CampaignOutputRecord, CampaignRecord } from '../ads';
import { evaluateCampaignReadinessBatch, type CampaignReadinessResult } from '../campaignReadiness';
import { supabase } from '../supabase';

type AdminCampaignInput = CampaignRecord & {
  business_name: string | null; business_logo_url: string | null; business_category: string | null;
  business_location: string | null; business_website: string | null; business_phone: string | null;
  business_active: boolean | null; profile_published: boolean; campaign_image_url: string | null;
  qr_destination_url: string | null; qr_status: string | null; qr_slug: string | null;
  outputs: CampaignOutputRecord[] | null;
};

export type AdminCampaignReadiness = { campaign: CampaignRecord; businessName: string; readiness: CampaignReadinessResult };

export async function getAdminCampaignReadiness(limit = 20): Promise<AdminCampaignReadiness[]> {
  const { data, error } = await supabase.rpc('get_admin_campaign_readiness_inputs', { limit_count: limit });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AdminCampaignInput[];
  const results = evaluateCampaignReadinessBatch(rows.map(row => ({
    campaign: row, role: 'admin' as const,
    business: { name: row.business_name, logoUrl: row.business_logo_url, category: row.business_category, location: row.business_location, website: row.business_website, phone: row.business_phone, active: row.business_active ?? false, profilePublished: row.profile_published },
    campaignImageUrl: row.campaign_image_url, outputs: row.outputs ?? [],
    qr: row.primary_qr_id ? { exists: true, valid: Boolean(row.qr_destination_url), publishable: row.qr_status === 'active', publicRouteResolves: Boolean(row.qr_slug) } : null,
  })));
  return rows.map((row, index) => ({ campaign: row, businessName: row.business_name || 'Business Hub', readiness: results[index] }));
}
