import type { CampaignOutputRecord, CampaignRecord } from './ads';

export type CampaignReadinessSectionKey = 'core' | 'mailer' | 'qr' | 'discovery' | 'social' | 'publishing' | 'approval';
export type CampaignReadinessStatus = 'incomplete' | 'needs_attention' | 'ready' | 'blocked';
export type CampaignReadinessSeverity = 'blocker' | 'warning' | 'info';
export type CampaignReadinessRole = 'business' | 'admin';

export type CampaignReadinessIssue = {
  id: string;
  section: CampaignReadinessSectionKey;
  severity: CampaignReadinessSeverity;
  field?: string;
  message: string;
  actionLabel?: string;
  actionDestination?: string;
};

export type CampaignNextAction = {
  id: string;
  label: string;
  destination: string;
  reason: string;
  priority: number;
};

export type CampaignReadinessSection = {
  key: CampaignReadinessSectionKey;
  label: string;
  status: CampaignReadinessStatus;
  completionPercent: number;
  issues: CampaignReadinessIssue[];
};

export type CampaignReadinessResult = {
  campaignId: string;
  overallStatus: CampaignReadinessStatus;
  completionPercent: number;
  nextAction: CampaignNextAction | null;
  sections: CampaignReadinessSection[];
  blockers: CampaignReadinessIssue[];
  warnings: CampaignReadinessIssue[];
};

export type CampaignReadinessContext = {
  campaign: CampaignRecord;
  business?: {
    name?: string | null;
    logoUrl?: string | null;
    category?: string | null;
    location?: string | null;
    website?: string | null;
    phone?: string | null;
    profilePublished?: boolean;
    active?: boolean;
  } | null;
  campaignImageUrl?: string | null;
  campaignImageWidth?: number | null;
  campaignImageHeight?: number | null;
  outputs?: CampaignOutputRecord[];
  qr?: {
    exists: boolean;
    valid: boolean;
    publishable: boolean;
    publicRouteResolves: boolean;
  } | null;
  mailer?: {
    placementExists: boolean;
    placementConfirmed: boolean;
    paymentStatus?: string | null;
    proofStatus?: 'not_started' | 'pending' | 'changes_requested' | 'approved' | string | null;
    artworkUsable?: boolean;
  } | null;
  role?: CampaignReadinessRole;
  social?: {
    templateRequiresLogo?: boolean;
    qrEnabled?: boolean;
  };
};

const SECTION_LABELS: Record<CampaignReadinessSectionKey, string> = {
  core: 'Core campaign',
  mailer: 'Community Mailer',
  qr: 'QR Landing Page',
  discovery: 'Consumer Discovery',
  social: 'Social Distribution',
  publishing: 'Publishing',
  approval: 'Approval',
};

// Weighted completion model. Purchase state never reduces creative completion.
// Core 40 + visual 20 + CTA/destination 15 + category/location 10 +
// distribution 10 + approval/publishing 5 = 100.
const WEIGHTS = {
  campaignName: 8,
  headlineOrOffer: 12,
  description: 6,
  businessName: 6,
  businessLogo: 8,
  campaignImage: 20,
  ctaLabel: 5,
  destination: 10,
  category: 5,
  location: 5,
  qr: 4,
  discovery: 3,
  social: 3,
  approval: 2,
  publishing: 3,
} as const;

export function evaluateCampaignReadiness(context: CampaignReadinessContext): CampaignReadinessResult {
  const { campaign, business = null, outputs = [], qr = null, mailer = null, role = 'business' } = context;
  const issues: CampaignReadinessIssue[] = [];
  const points = new Map<keyof typeof WEIGHTS, boolean>();
  const editRoute = `/app/business/campaigns/${campaign.id}/edit`;
  const distributionRoute = `/app/business/campaigns/${campaign.id}/distribution`;
  const socialRoute = `${distributionRoute}/social`;
  const add = (
    condition: boolean,
    weight: keyof typeof WEIGHTS,
    issue?: Omit<CampaignReadinessIssue, 'id'> & { id?: string },
  ) => {
    points.set(weight, condition);
    if (!condition && issue) issues.push({ id: issue.id ?? `${issue.section}-${issue.field ?? weight}`, ...issue });
  };

  const hasMessage = Boolean(campaign.headline?.trim() || campaign.offer_title?.trim());
  const hasDescription = Boolean(campaign.description?.trim() || campaign.offer_description?.trim());
  const hasDestination = Boolean(campaign.cta_url?.trim() || business?.website?.trim() || business?.phone?.trim());
  const hasImage = Boolean(context.campaignImageUrl);
  const qrReady = Boolean(qr?.exists && qr.valid && qr.publishable && qr.publicRouteResolves && campaign.status !== 'expired');
  const discoveryOutput = outputs.some(output => output.output_type === 'interactive_ad' && output.enabled);
  const discoveryReady = hasImage && hasMessage && Boolean(business?.category?.trim()) && Boolean(business?.location?.trim()) && campaign.status !== 'expired';
  const socialReady = hasImage && hasMessage && Boolean(campaign.cta_label?.trim() || campaign.cta_url?.trim())
    && (!context.social?.templateRequiresLogo || Boolean(business?.logoUrl))
    && (!context.social?.qrEnabled || Boolean(qr?.exists));
  const invalidExpiration = Boolean(campaign.start_date && campaign.end_date && new Date(campaign.end_date) < new Date(campaign.start_date));
  const correctionRequired = mailer?.proofStatus === 'changes_requested';
  const approvalPending = mailer?.proofStatus === 'pending';
  const approvalRequired = Boolean(mailer?.placementExists);
  const approvalReady = !approvalRequired || mailer?.proofStatus === 'approved';
  const publishingReady = campaign.status !== 'expired' && !invalidExpiration && hasMessage && hasImage && hasDestination && Boolean(business?.profilePublished);

  add(Boolean(campaign.title?.trim()), 'campaignName', issue('core', 'blocker', 'title', 'Add a campaign name.', 'Add campaign name', `${editRoute}?section=details`));
  add(hasMessage, 'headlineOrOffer', issue('core', 'blocker', 'headline', 'Add a campaign headline or offer.', 'Add campaign message', `${editRoute}?section=details`));
  add(hasDescription, 'description', issue('core', 'warning', 'description', 'Add a supporting campaign description.', 'Add description', `${editRoute}?section=details`));
  add(Boolean(business?.name?.trim()), 'businessName', issue('core', 'blocker', 'business_name', 'Add the Business Hub name.', 'Open Business Settings', '/app/business/settings'));
  add(Boolean(business?.logoUrl), 'businessLogo', issue('core', 'warning', 'business_logo', 'Add a Business Hub logo.', 'Add business logo', '/app/business/smart-cards'));
  add(hasImage, 'campaignImage', issue('core', 'blocker', 'primary_image', 'Add a primary campaign image.', 'Add campaign image', `${editRoute}?section=media`));
  add(Boolean(campaign.cta_label?.trim()), 'ctaLabel', issue('core', 'blocker', 'cta_label', 'Add a clear call to action.', 'Add call to action', `${editRoute}?section=details`));
  add(hasDestination, 'destination', issue('core', 'blocker', 'cta_destination', 'Add a website, phone number, or campaign destination.', 'Add destination', `${editRoute}?section=details`));
  add(Boolean(business?.category?.trim()), 'category', issue('discovery', 'warning', 'category', 'Add a business category for discovery.', 'Add category', '/app/business/settings'));
  add(Boolean(business?.location?.trim()), 'location', issue('discovery', 'warning', 'location', 'Add a location or service area.', 'Add location', '/app/business/settings'));
  add(qrReady, 'qr', issue('qr', 'warning', 'primary_qr_id', 'Connect a valid, publishable QR destination.', 'Open QR Studio', '/app/business/qr-studio'));
  add(discoveryReady, 'discovery', issue('discovery', 'warning', 'discovery', 'Complete the visual, category, location, and campaign message for discovery.', 'Complete discovery details', editRoute));
  add(socialReady, 'social', issue('social', 'warning', 'social', 'Complete the campaign fields required for social assets.', 'Complete social campaign', socialRoute));
  add(approvalReady, 'approval');
  add(publishingReady, 'publishing', issue('publishing', 'warning', 'publishing', campaign.status === 'expired' ? 'Archived campaigns cannot be published.' : 'Complete a public destination before publishing.', campaign.status === 'expired' ? 'Review campaign' : 'Open distribution', distributionRoute));

  if (invalidExpiration) issues.push(issue('publishing', 'blocker', 'expiration', 'The campaign end date must be after its start date.', 'Fix campaign dates', `${editRoute}?section=details`));
  if (correctionRequired) issues.push(issue('approval', 'blocker', 'proof_status', 'Artwork corrections were requested.', role === 'admin' ? 'Review artwork' : 'Update artwork', role === 'admin' ? '/admin/community-mailers' : '/app/business/community-campaigns'));
  if (approvalPending) issues.push(issue('approval', 'info', 'proof_status', 'Artwork is awaiting review.', role === 'admin' ? 'Review artwork' : undefined, role === 'admin' ? '/admin/community-mailers' : undefined));
  if (!mailer?.placementExists) issues.push(issue('mailer', 'info', 'placement', 'No Community Mailer placement is selected.', role === 'business' ? 'Select mailer placement' : undefined, role === 'business' ? '/app/business/community-campaigns' : undefined));
  if (mailer?.placementExists && !mailer.artworkUsable) issues.push(issue('mailer', 'blocker', 'artwork', 'The mailer placement needs usable artwork.', role === 'admin' ? 'Review placement' : 'Add artwork', role === 'admin' ? '/admin/community-mailers' : '/app/business/community-campaigns'));
  if (mailer?.placementExists && !mailer.placementConfirmed) issues.push(issue('mailer', 'info', 'placement_confirmation', 'The mailer placement is not confirmed yet.', role === 'admin' ? 'Confirm placement' : 'Review placement', role === 'admin' ? '/admin/community-mailers' : '/app/business/community-campaigns'));
  if (context.campaignImageWidth && context.campaignImageHeight && (context.campaignImageWidth < 1080 || context.campaignImageHeight < 628)) {
    issues.push(issue('mailer', 'warning', 'image_quality', 'The campaign image may be too small for high-quality print and social output.', 'Replace image', `${editRoute}?section=media`));
  }

  const completionPercent = Math.round((Object.entries(WEIGHTS) as Array<[keyof typeof WEIGHTS, number]>)
    .reduce((total, [key, weight]) => total + (points.get(key) ? weight : 0), 0));
  const sections = buildSections(issues, {
    core: percent(points, ['campaignName', 'headlineOrOffer', 'description', 'businessName', 'businessLogo', 'campaignImage', 'ctaLabel', 'destination']),
    mailer: mailer?.placementExists ? (mailer.artworkUsable ? (mailer.placementConfirmed ? 100 : 75) : 40) : 100,
    qr: qrReady ? 100 : 0,
    discovery: discoveryReady ? 100 : 0,
    social: socialReady ? 100 : 0,
    publishing: publishingReady ? 100 : 0,
    approval: approvalReady ? 100 : correctionRequired ? 0 : approvalPending ? 60 : 40,
  });
  const blockers = issues.filter(item => item.severity === 'blocker');
  const warnings = issues.filter(item => item.severity === 'warning');
  const overallStatus: CampaignReadinessStatus = blockers.length ? 'blocked' : completionPercent === 100 ? 'ready' : completionPercent < 55 ? 'incomplete' : 'needs_attention';
  return {
    campaignId: campaign.id,
    overallStatus,
    completionPercent,
    nextAction: chooseNextAction({ campaign, issues, completionPercent, publishingReady, discoveryOutput, role }),
    sections,
    blockers,
    warnings,
  };
}

export function evaluateCampaignReadinessBatch(contexts: CampaignReadinessContext[]): CampaignReadinessResult[] {
  return contexts.map(evaluateCampaignReadiness);
}

function issue(section: CampaignReadinessSectionKey, severity: CampaignReadinessSeverity, field: string, message: string, actionLabel?: string, actionDestination?: string): CampaignReadinessIssue {
  return { id: `${section}-${field}`, section, severity, field, message, actionLabel, actionDestination };
}

function buildSections(issues: CampaignReadinessIssue[], percentages: Record<CampaignReadinessSectionKey, number>): CampaignReadinessSection[] {
  return (Object.keys(SECTION_LABELS) as CampaignReadinessSectionKey[]).map(key => {
    const sectionIssues = issues.filter(item => item.section === key);
    const status: CampaignReadinessStatus = sectionIssues.some(item => item.severity === 'blocker')
      ? 'blocked'
      : percentages[key] === 100
        ? 'ready'
        : percentages[key] < 50
          ? 'incomplete'
          : 'needs_attention';
    return { key, label: SECTION_LABELS[key], status, completionPercent: percentages[key], issues: sectionIssues };
  });
}

function percent(points: Map<keyof typeof WEIGHTS, boolean>, keys: Array<keyof typeof WEIGHTS>): number {
  const possible = keys.reduce((total, key) => total + WEIGHTS[key], 0);
  const earned = keys.reduce((total, key) => total + (points.get(key) ? WEIGHTS[key] : 0), 0);
  return Math.round((earned / possible) * 100);
}

function chooseNextAction(input: { campaign: CampaignRecord; issues: CampaignReadinessIssue[]; completionPercent: number; publishingReady: boolean; discoveryOutput: boolean; role: CampaignReadinessRole }): CampaignNextAction | null {
  const { campaign, issues, completionPercent, publishingReady, discoveryOutput, role } = input;
  const ranked = issues
    .filter(item => item.actionLabel && item.actionDestination && (role === 'business' || item.actionDestination.startsWith('/admin/')))
    .map(item => ({
      id: item.id,
      label: item.actionLabel!,
      destination: item.actionDestination!,
      reason: item.message,
      priority: issuePriority(item),
    }))
    .sort((a, b) => a.priority - b.priority);
  if (ranked[0]) return ranked[0];
  if (role === 'admin') return null;
  if (publishingReady && campaign.status === 'draft') return { id: 'publish-campaign', label: 'Publish campaign', destination: `/app/business/campaigns/${campaign.id}/edit`, reason: 'The campaign is complete and ready to publish.', priority: 80 };
  if (completionPercent === 100 && !discoveryOutput) return { id: 'open-distribution', label: 'Open distribution', destination: `/app/business/campaigns/${campaign.id}/distribution`, reason: 'The campaign is ready for destination-specific outputs.', priority: 90 };
  return null;
}

function issuePriority(item: CampaignReadinessIssue): number {
  if (item.severity === 'blocker' && item.section === 'core') return 10;
  if (item.field === 'primary_image') return 20;
  if (item.field === 'cta_label' || item.field === 'cta_destination') return 30;
  if (item.field === 'category' || item.field === 'location') return 40;
  if (item.field === 'proof_status') return 50;
  if (item.field === 'placement') return 70;
  if (item.section === 'publishing') return 80;
  if (item.section === 'social') return 90;
  return item.severity === 'blocker' ? 15 : item.severity === 'warning' ? 60 : 70;
}
