import type { CampaignOutputRecord, CampaignRecord } from './ads';
import { evaluateCampaignReadinessBatch, type CampaignReadinessContext, type CampaignReadinessResult } from './campaignReadiness';
import { supabase } from './supabase';

type BusinessRow = {
  name: string;
  category: string | null;
  service_area: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  active: boolean;
};

type CardRow = {
  business_name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  is_published: boolean;
};

export async function loadBusinessCampaignReadiness(
  userId: string,
  campaigns: CampaignRecord[],
  suppliedOutputs?: CampaignOutputRecord[],
): Promise<Map<string, CampaignReadinessResult>> {
  if (campaigns.length === 0) return new Map();
  const campaignIds = campaigns.map(campaign => campaign.id);
  const assetIds = campaigns.map(campaign => campaign.primary_image_id).filter((id): id is string => Boolean(id));
  const qrIds = campaigns.map(campaign => campaign.primary_qr_id).filter((id): id is string => Boolean(id));
  const [businessResult, cardResult, outputsResult, assetsResult, qrResult] = await Promise.all([
    supabase.from('businesses').select('name,category,service_area,address,website,phone,active').eq('owner_user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('business_cards').select('business_name,logo_url,cover_image_url,is_published').eq('owner_user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    suppliedOutputs ? Promise.resolve({ data: suppliedOutputs, error: null }) : supabase.from('campaign_outputs').select('*').in('campaign_id', campaignIds),
    assetIds.length ? supabase.from('business_marketing_assets').select('id,file_url,external_url,thumbnail_url').in('id', assetIds) : Promise.resolve({ data: [], error: null }),
    qrIds.length ? supabase.from('qr_links').select('id,destination_url,status,slug').in('id', qrIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError = [businessResult.error, cardResult.error, outputsResult.error, assetsResult.error, qrResult.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);
  const business = businessResult.data as BusinessRow | null;
  const card = cardResult.data as CardRow | null;
  const outputs = (outputsResult.data ?? []) as CampaignOutputRecord[];
  const assets = new Map((assetsResult.data ?? []).map(asset => [asset.id, asset]));
  const qrLinks = new Map((qrResult.data ?? []).map(qr => [qr.id, qr]));
  const contexts: CampaignReadinessContext[] = campaigns.map(campaign => {
    const asset = campaign.primary_image_id ? assets.get(campaign.primary_image_id) : null;
    const qr = campaign.primary_qr_id ? qrLinks.get(campaign.primary_qr_id) : null;
    return {
      campaign,
      business: {
        name: business?.name || card?.business_name,
        logoUrl: card?.logo_url,
        category: business?.category,
        location: business?.service_area || business?.address,
        website: business?.website,
        phone: business?.phone,
        profilePublished: card?.is_published ?? false,
        active: business?.active ?? false,
      },
      campaignImageUrl: asset?.file_url || asset?.thumbnail_url || asset?.external_url || card?.cover_image_url || null,
      outputs: outputs.filter(output => output.campaign_id === campaign.id),
      qr: qr ? {
        exists: true,
        valid: Boolean(qr.destination_url),
        publishable: qr.status === 'active',
        publicRouteResolves: Boolean(qr.slug),
      } : null,
    };
  });
  return new Map(evaluateCampaignReadinessBatch(contexts).map(result => [result.campaignId, result]));
}
