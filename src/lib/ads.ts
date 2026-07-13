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

export function isCampaignPublicNow(campaign: CampaignRecord, now = new Date()): boolean {
  if (!campaign.business_id || (campaign.status !== 'active' && campaign.status !== 'scheduled')) return false;

  const nowTime = now.getTime();
  if (!Number.isFinite(nowTime)) return false;

  const startTime = campaign.start_date ? Date.parse(campaign.start_date) : null;
  const endTime = campaign.end_date ? Date.parse(campaign.end_date) : null;
  if (startTime !== null && !Number.isFinite(startTime)) return false;
  if (endTime !== null && !Number.isFinite(endTime)) return false;
  if (campaign.status === 'scheduled' && startTime === null) return false;
  if (startTime !== null && startTime > nowTime) return false;
  if (endTime !== null && endTime < nowTime) return false;

  return true;
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

export type CampaignContentChannel = 'facebook' | 'instagram' | 'email' | 'flyer' | 'community_mailer';

export function buildCampaignChannelCopy(campaign: CampaignRecord, businessName: string, channel: CampaignContentChannel): string {
  const title = cleanCampaignValue(campaign.headline) || cleanCampaignValue(campaign.title) || 'A local offer';
  const offer = cleanCampaignValue(campaign.offer_title) || title;
  const description = cleanCampaignValue(campaign.offer_description) || cleanCampaignValue(campaign.description) || 'Discover this local campaign through Adpadz.';
  const cta = cleanCampaignValue(campaign.cta_label) || 'Learn More';
  const dateRange = formatCampaignDateRange(campaign.start_date, campaign.end_date);

  switch (channel) {
    case 'instagram':
      return `${offer} from ${businessName}. ${description}\n\n${cta}\n\n#SupportLocal #LocalDeals #Adpadz`;
    case 'email':
      return `Subject: ${offer} from ${businessName}\n\nHi there,\n\n${businessName} is currently offering ${offer}.\n\n${description}\n\n${cta}\n\nAvailable ${dateRange}.`;
    case 'flyer':
      return `${title}\n\n${offer}\n${description}\n\n${cta}\n\nScan to explore this Adpadz local campaign.\nAvailable ${dateRange}.`;
    case 'community_mailer':
      return `${businessName}\n${title}\n\n${offer}\n${description}\n\n${cta} · Scan the Adpadz QR to engage.\n${dateRange}`;
    case 'facebook':
    default:
      return `${title}\n\n${businessName} is offering ${offer}. ${description}\n\n${cta}`;
  }
}

export function formatCampaignDateRange(start?: string | null, end?: string | null): string {
  const startText = formatCampaignDate(start);
  const endText = formatCampaignDate(end);
  if (!startText && !endText) return 'while supplies last';
  if (startText && endText) return `${startText} – ${endText}`;
  return startText ? `starting ${startText}` : `through ${endText}`;
}

function formatCampaignDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function cleanCampaignValue(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}
