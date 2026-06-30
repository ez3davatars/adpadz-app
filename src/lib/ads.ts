export type SmartCardCampaignSection = 'promotions' | 'media' | 'proof' | string;
export type CampaignStatus = 'draft' | 'active' | 'scheduled' | 'expired' | string;
export type CampaignOutputType = 'smart_card' | 'interactive_ad' | 'community_mailer' | 'qr_landing' | 'facebook' | 'instagram' | 'email' | 'flyer' | string;

export type CampaignRecord = {
  id: string;
  business_id?: string | null;
  owner_id: string;
  title: string;
  headline?: string | null;
  description?: string | null;
  offer_title?: string | null;
  offer_description?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  status: CampaignStatus;
  start_date?: string | null;
  end_date?: string | null;
  primary_image_id?: string | null;
  primary_video_id?: string | null;
  primary_qr_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CampaignOutputMetadata = {
  smart_card_id?: string;
  section?: SmartCardCampaignSection;
  format?: string;
  tone?: string;
  [key: string]: unknown;
};

export type CampaignOutputRecord = {
  campaign_id: string;
  output_type: CampaignOutputType;
  enabled: boolean;
  sort_order: number;
  metadata?: CampaignOutputMetadata | null;
  created_at?: string | null;
  updated_at?: string | null;
  campaigns?: CampaignRecord | CampaignRecord[] | null;
};

export type SmartCardCampaign = CampaignOutputRecord & {
  campaign: CampaignRecord;
  metadata: CampaignOutputMetadata;
};

export type SmartCardSummary = {
  id: string;
  business_name: string;
  slug: string;
  is_published: boolean;
};

export const SMART_CARD_CAMPAIGN_SECTIONS = [
  { value: 'promotions', label: 'Promotion' },
  { value: 'media', label: 'Media' },
  { value: 'proof', label: 'Proof / Results' },
] as const;

export function normalizeCampaignOutput(record: CampaignOutputRecord): SmartCardCampaign | null {
  const campaign = Array.isArray(record.campaigns) ? record.campaigns[0] : record.campaigns;
  if (!campaign) return null;
  return {
    ...record,
    metadata: record.metadata ?? {},
    campaign,
  };
}

export function getCampaignSection(output: Pick<SmartCardCampaign, 'metadata'>): SmartCardCampaignSection {
  return output.metadata?.section || 'promotions';
}

export function getCampaignTitle(output: SmartCardCampaign): string {
  return output.campaign.title || output.campaign.headline || 'Campaign';
}

export function getCampaignFormatLabel(output: SmartCardCampaign): string {
  const format = typeof output.metadata?.format === 'string' ? output.metadata.format : 'interactive';
  return format
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

export function getCampaignOffer(output: SmartCardCampaign): string | null {
  return output.campaign.offer_title || output.campaign.offer_description || null;
}