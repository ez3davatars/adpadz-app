import type { CampaignRecord } from './ads';
import { evaluateCampaignReadiness } from './campaignReadiness';

export const SOCIAL_FORMATS = [
  { key: 'square', label: 'Square Post', width: 1080, height: 1080, description: 'Facebook and Instagram feeds' },
  { key: 'portrait', label: 'Portrait Post', width: 1080, height: 1350, description: 'Instagram and Facebook feeds' },
  { key: 'landscape', label: 'Landscape Post', width: 1200, height: 628, description: 'Facebook links and landscape promotion' },
  { key: 'story', label: 'Story', width: 1080, height: 1920, description: 'Facebook and Instagram Stories' },
] as const;

export const SOCIAL_TEMPLATES = [
  { key: 'hero-visual', label: 'Hero Visual', description: 'Gives the campaign image center stage.' },
  { key: 'offer-first', label: 'Offer First', description: 'Makes the offer the strongest element.' },
  { key: 'brand-focus', label: 'Brand Focus', description: 'Leads with the business identity.' },
  { key: 'featured-sponsor', label: 'Featured Sponsor', description: 'A premium layout for high-visibility placements.' },
] as const;

export type SocialFormatKey = (typeof SOCIAL_FORMATS)[number]['key'];
export type SocialTemplateKey = (typeof SOCIAL_TEMPLATES)[number]['key'];
export type DistributionDestination = 'mailer' | 'discovery' | 'social-square' | 'social-portrait' | 'social-landscape' | 'social-story' | 'tv';

export type CampaignCreativeData = {
  campaign: CampaignRecord;
  businessName: string;
  businessLogoUrl: string | null;
  campaignImageUrl: string | null;
  primaryColor: string;
  accentColor: string;
  website: string | null;
  phone: string | null;
  category: string | null;
  city: string | null;
  campaignUrl: string | null;
};

export type ReadinessIssue = {
  field: 'campaign' | 'business' | 'business_name' | 'headline' | 'hero_image' | 'cta' | 'logo' | 'qr_destination';
  message: string;
  section: 'campaign-details' | 'campaign-media' | 'business-profile' | 'qr-studio';
  action: string;
};

export function isDistributionQrUsable(
  qr: { status?: unknown; expires_at?: unknown } | null,
  now = Date.now(),
): boolean {
  if (!qr || qr.status !== 'active') return false;
  if (qr.expires_at === null || qr.expires_at === undefined || qr.expires_at === '') return true;
  if (typeof qr.expires_at !== 'string') return false;
  const expiresAt = Date.parse(qr.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > now;
}
export function getSocialFormat(key: SocialFormatKey) {
  return SOCIAL_FORMATS.find(format => format.key === key) ?? SOCIAL_FORMATS[0];
}

export function evaluateDistributionReadiness(
  creative: CampaignCreativeData | null,
  options: { template: SocialTemplateKey; showQr: boolean },
): { ready: boolean; issues: ReadinessIssue[] } {
  if (!creative?.campaign) return { ready: false, issues: [{ field: 'campaign', message: 'Choose an existing campaign.', section: 'campaign-details', action: 'Choose campaign' }] };
  const result = evaluateCampaignReadiness({
    campaign: creative.campaign,
    campaignImageUrl: creative.campaignImageUrl,
    business: { name: creative.businessName, logoUrl: creative.businessLogoUrl, category: creative.category, location: creative.city, website: creative.website, phone: creative.phone, profilePublished: true },
    qr: creative.campaignUrl ? { exists: true, valid: true, publishable: true, publicRouteResolves: true } : null,
    social: { templateRequiresLogo: options.template === 'brand-focus', qrEnabled: options.showQr },
  });
  const relevant = [...result.blockers, ...result.warnings].filter(issue => ['business_name', 'headline', 'primary_image', 'cta_label', 'cta_destination'].includes(issue.field ?? '') || issue.field === 'social' && (options.template === 'brand-focus' && !creative.businessLogoUrl || options.showQr && !creative.campaignUrl));
  const issues = relevant.map<ReadinessIssue>(issue => {
    const brandLogo = issue.field === 'social' && options.template === 'brand-focus' && !creative.businessLogoUrl;
    const qrDestination = issue.field === 'social' && options.showQr && !creative.campaignUrl;
    return {
      field: issue.field === 'primary_image' ? 'hero_image' : issue.field === 'cta_label' || issue.field === 'cta_destination' ? 'cta' : brandLogo ? 'logo' : qrDestination ? 'qr_destination' : issue.field as ReadinessIssue['field'],
      message: brandLogo ? 'Brand Focus needs a business logo.' : qrDestination ? 'Choose a QR or campaign destination before showing a QR code.' : issue.message,
      section: issue.field === 'primary_image' ? 'campaign-media' : issue.field === 'business_name' || brandLogo ? 'business-profile' : qrDestination ? 'qr-studio' : 'campaign-details',
      action: issue.field === 'primary_image' ? 'Add image' : issue.field === 'business_name' ? 'Add business name' : brandLogo ? 'Add logo' : qrDestination ? 'Choose destination' : issue.actionLabel ?? 'Complete campaign',
    };
  });
  return { ready: issues.length === 0, issues };
}
export function buildSuggestedHashtags(input: Pick<CampaignCreativeData, 'businessName' | 'category' | 'city'>): string[] {
  const candidates = [
    'SupportLocal',
    input.city,
    input.category ? `Local ${input.category}` : null,
    input.businessName,
    'Adpadz',
  ];
  return Array.from(new Set(candidates
    .filter((value): value is string => Boolean(value?.trim()))
    .map(value => `#${value.replace(/[^a-z0-9]/gi, '')}`)
    .filter(value => value.length > 1))).slice(0, 5);
}

export function buildSuggestedCaption(creative: CampaignCreativeData): string {
  const campaign = creative.campaign;
  const sections = [
    campaign.headline?.trim() || campaign.title.trim(),
    campaign.offer_title?.trim() || campaign.offer_description?.trim() || campaign.description?.trim(),
    campaign.cta_label?.trim(),
    creative.campaignUrl || creative.website,
    campaign.end_date ? `Offer ends ${formatCaptionDate(campaign.end_date)}.` : null,
    buildSuggestedHashtags(creative).join(' '),
  ];
  return sections.filter(Boolean).join('\n\n');
}

export function buildSocialFilename(businessName: string, campaignName: string, format: SocialFormatKey): string {
  return `${slugify(businessName)}-${slugify(campaignName)}-${format}.png`;
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/['Ã¢â‚¬â„¢]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign';
}

function formatCaptionDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
