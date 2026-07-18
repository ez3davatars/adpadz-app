import { DEMO_DEFAULT_BUSINESS_SLUG, createDemoPresetWorkspace, getDemoBusinessPreset } from './demoPresets';

/**
 * Client-side sales demo state.
 *
 * Every record in this module is fictional sample data. Nothing here should
 * be represented as a real customer, lead, campaign result, or testimonial.
 */

export const DEMO_WORKSPACE_SCHEMA_VERSION = 3 as const;
export const DEMO_WORKSPACE_STORAGE_KEY = 'adpadz-demo-workspace-v3';
export const DEMO_LAST_BUSINESS_STORAGE_KEY = 'adpadz-demo-last-business-v3';
export const DEMO_SAMPLE_DATA_NOTICE = 'Fictional sample data for demonstrating Adpadz. No real customers or results are represented.';

export const DEMO_CAMPAIGN_STATUSES = ['draft', 'scheduled', 'active', 'expired'] as const;
export type DemoCampaignStatus = (typeof DEMO_CAMPAIGN_STATUSES)[number];

export const DEMO_LEAD_STATUSES = ['new', 'contacted', 'qualified', 'closed', 'archived'] as const;
export type DemoLeadStatus = (typeof DEMO_LEAD_STATUSES)[number];

export const DEMO_CAMPAIGN_FORMATS = ['tap_reveal', 'scratch', 'before_after'] as const;
export type DemoCampaignFormat = (typeof DEMO_CAMPAIGN_FORMATS)[number];

export const DEMO_CAMPAIGN_OUTPUTS = [
  'smart_card',
  'interactive_ad',
  'qr_landing',
  'community_mailer',
  'facebook',
  'instagram',
  'email',
  'flyer',
] as const;
export type DemoCampaignOutput = (typeof DEMO_CAMPAIGN_OUTPUTS)[number];

export type DemoLeadSource = 'smart_card' | 'qr_campaign' | 'booking_request' | 'interactive_campaign';

export type DemoBusiness = {
  id: string;
  isSample: true;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  location: string;
  phone: string;
  email: string;
  website: string;
  profilePublished: boolean;
};

export type DemoCampaignMetrics = {
  views: number;
  qrScans: number;
  offerReveals: number;
  leads: number;
};

export type DemoCampaign = {
  id: string;
  isSample: true;
  title: string;
  headline: string;
  description: string;
  offer: {
    id: string;
    title: string;
    description: string;
  };
  ctaLabel: string;
  status: DemoCampaignStatus;
  format: DemoCampaignFormat;
  outputs: DemoCampaignOutput[];
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  metrics: DemoCampaignMetrics;
};

export type DemoLead = {
  id: string;
  isSample: true;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  source: DemoLeadSource;
  campaignId: string | null;
  status: DemoLeadStatus;
  createdAt: string;
  updatedAt: string;
};

export type DemoWorkspaceMetrics = {
  profileViews: number;
  campaignViews: number;
  qrScans: number;
  offerReveals: number;
  leads: number;
  bookings: number;
  offerClaims: number;
};

export type DemoActivityType =
  | 'campaign_created'
  | 'campaign_status_changed'
  | 'qr_scan'
  | 'offer_reveal'
  | 'offer_claim'
  | 'profile_view'
  | 'campaign_updated'
  | 'business_updated'
  | 'lead_submitted'
  | 'lead_status_changed';

export type DemoActivity = {
  id: string;
  isSample: true;
  type: DemoActivityType;
  title: string;
  detail: string;
  occurredAt: string;
  campaignId: string | null;
  leadId: string | null;
};

export type DemoWorkspaceState = {
  schemaVersion: typeof DEMO_WORKSPACE_SCHEMA_VERSION;
  sampleData: true;
  sampleDataNotice: string;
  business: DemoBusiness;
  campaigns: DemoCampaign[];
  leads: DemoLead[];
  metrics: DemoWorkspaceMetrics;
  activity: DemoActivity[];
  /** Composite `campaignId:offerId` keys revealed during this demo session. */
  revealedOfferIds: string[];
  /** Composite offer keys claimed during this business demo. */
  claimedOfferIds: string[];
  /** Deterministic sequence used for client-created sample IDs. */
  sequence: number;
  updatedAt: string;
};

export type DemoCreateCampaignInput = {
  title: string;
  headline?: string;
  description?: string;
  offerTitle?: string;
  offerDescription?: string;
  ctaLabel?: string;
  status?: DemoCampaignStatus;
  format?: DemoCampaignFormat;
  outputs?: DemoCampaignOutput[];
  startDate?: string | null;
  endDate?: string | null;
};


export type DemoUpdateCampaignInput = Partial<Omit<DemoCreateCampaignInput, 'title'>> & { title?: string };

export type DemoUpdateBusinessInput = Partial<Pick<DemoBusiness, 'name' | 'tagline' | 'description' | 'location' | 'phone' | 'email' | 'website'>>;
export type DemoSampleLeadInput = {
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  source: DemoLeadSource;
  campaignId: string | null;
};

export type DemoWorkspaceAction =
  | { type: 'campaign/create'; payload: DemoCreateCampaignInput }
  | { type: 'campaign/status'; campaignId: string; status: DemoCampaignStatus }
  | { type: 'campaign/update'; campaignId: string; payload: DemoUpdateCampaignInput }
  | { type: 'business/update'; payload: DemoUpdateBusinessInput }
  | { type: 'analytics/scan'; campaignId: string }
  | { type: 'offer/reveal'; campaignId: string; offerId: string }
  | { type: 'offer/claim'; campaignId: string; offerId: string }
  | { type: 'analytics/profile-view' }
  | { type: 'lead/submit-sample'; payload?: Partial<DemoSampleLeadInput> }
  | { type: 'lead/status'; leadId: string; status: DemoLeadStatus }
  | { type: 'workspace/reset' };

export type DemoWorkspaceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const INITIAL_UPDATED_AT = '2026-07-10T14:00:00.000Z';
const MAX_ACTIVITY_ITEMS = 30;
const CUSTOMER_EXPERIENCE_OUTPUTS: readonly DemoCampaignOutput[] = ['smart_card', 'interactive_ad', 'qr_landing'];

/** Returns a fresh fictional workspace. River City remains the default flagship. */
export function createInitialDemoWorkspaceState(businessSlug = DEMO_DEFAULT_BUSINESS_SLUG): DemoWorkspaceState {
  return createDemoPresetWorkspace(businessSlug);
}
export function demoWorkspaceReducer(state: DemoWorkspaceState, action: DemoWorkspaceAction): DemoWorkspaceState {
  switch (action.type) {
    case 'campaign/create':
      return createCampaign(state, action.payload);
    case 'campaign/status':
      return setCampaignStatus(state, action.campaignId, action.status);
    case 'campaign/update':
      return updateCampaign(state, action.campaignId, action.payload);
    case 'business/update':
      return updateBusiness(state, action.payload);
    case 'analytics/scan':
      return simulateScan(state, action.campaignId);
    case 'offer/reveal':
      return revealOffer(state, action.campaignId, action.offerId);
    case 'offer/claim':
      return claimOffer(state, action.campaignId, action.offerId);
    case 'analytics/profile-view':
      return recordProfileView(state);
    case 'lead/submit-sample':
      return submitSampleLead(state, action.payload);
    case 'lead/status':
      return setLeadStatus(state, action.leadId, action.status);
    case 'workspace/reset':
      return createInitialDemoWorkspaceState(state.business.slug);
    default:
      return state;
  }
}

export const demoWorkspaceActions = {
  createCampaign: (payload: DemoCreateCampaignInput): DemoWorkspaceAction => ({ type: 'campaign/create', payload }),
  setCampaignStatus: (campaignId: string, status: DemoCampaignStatus): DemoWorkspaceAction => ({ type: 'campaign/status', campaignId, status }),
  updateCampaign: (campaignId: string, payload: DemoUpdateCampaignInput): DemoWorkspaceAction => ({ type: 'campaign/update', campaignId, payload }),
  updateBusiness: (payload: DemoUpdateBusinessInput): DemoWorkspaceAction => ({ type: 'business/update', payload }),
  simulateScan: (campaignId: string): DemoWorkspaceAction => ({ type: 'analytics/scan', campaignId }),
  revealOffer: (campaignId: string, offerId: string): DemoWorkspaceAction => ({ type: 'offer/reveal', campaignId, offerId }),
  claimOffer: (campaignId: string, offerId: string): DemoWorkspaceAction => ({ type: 'offer/claim', campaignId, offerId }),
  recordProfileView: (): DemoWorkspaceAction => ({ type: 'analytics/profile-view' }),
  submitSampleLead: (payload?: Partial<DemoSampleLeadInput>): DemoWorkspaceAction => ({ type: 'lead/submit-sample', payload }),
  setLeadStatus: (leadId: string, status: DemoLeadStatus): DemoWorkspaceAction => ({ type: 'lead/status', leadId, status }),
  reset: (): DemoWorkspaceAction => ({ type: 'workspace/reset' }),
};

export function serializeDemoWorkspaceState(state: DemoWorkspaceState): string {
  return JSON.stringify({ version: DEMO_WORKSPACE_SCHEMA_VERSION, workspace: state });
}

export function deserializeDemoWorkspaceState(serialized: string | null | undefined): DemoWorkspaceState | null {
  if (!serialized) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed) || parsed.version !== DEMO_WORKSPACE_SCHEMA_VERSION) return null;
    return isDemoWorkspaceState(parsed.workspace) ? parsed.workspace : null;
  } catch {
    return null;
  }
}

export function getDemoWorkspaceStorageKey(businessSlug: string): string {
  return `${DEMO_WORKSPACE_STORAGE_KEY}:${businessSlug}`;
}

/** Loads a valid business-scoped demo snapshot or returns its fresh fictional story. */
export function loadDemoWorkspaceState(
  storage: DemoWorkspaceStorage | null = getLocalStorage(),
  businessSlug = DEMO_DEFAULT_BUSINESS_SLUG,
): DemoWorkspaceState {
  const safeSlug = getDemoBusinessPreset(businessSlug)?.slug ?? DEMO_DEFAULT_BUSINESS_SLUG;
  if (!storage) return createInitialDemoWorkspaceState(safeSlug);
  try {
    return deserializeDemoWorkspaceState(storage.getItem(getDemoWorkspaceStorageKey(safeSlug)))
      ?? createInitialDemoWorkspaceState(safeSlug);
  } catch {
    return createInitialDemoWorkspaceState(safeSlug);
  }
}

export function saveDemoWorkspaceState(
  state: DemoWorkspaceState,
  storage: DemoWorkspaceStorage | null = getLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(getDemoWorkspaceStorageKey(state.business.slug), serializeDemoWorkspaceState(state));
    storage.setItem(DEMO_LAST_BUSINESS_STORAGE_KEY, state.business.slug);
  } catch {
    // A blocked or full local store must not break the self-contained demo.
  }
}

export function clearDemoWorkspaceState(
  storage: DemoWorkspaceStorage | null = getLocalStorage(),
  businessSlug = DEMO_DEFAULT_BUSINESS_SLUG,
): void {
  if (!storage) return;
  try {
    storage.removeItem(getDemoWorkspaceStorageKey(businessSlug));
  } catch {
    // A blocked local store is equivalent to an already-cleared demo.
  }
}

export function loadLastDemoBusinessSlug(storage: DemoWorkspaceStorage | null = getLocalStorage()): string | null {
  if (!storage) return null;
  try {
    const slug = storage.getItem(DEMO_LAST_BUSINESS_STORAGE_KEY);
    return getDemoBusinessPreset(slug)?.slug ?? null;
  } catch {
    return null;
  }
}

export function getDemoConversionRate(metrics: DemoWorkspaceMetrics): number {
  if (metrics.campaignViews <= 0) return 0;
  return Math.round((metrics.leads / metrics.campaignViews) * 1000) / 10;
}

function createCampaign(state: DemoWorkspaceState, input: DemoCreateCampaignInput): DemoWorkspaceState {
  const title = input.title.trim();
  if (!title) return state;

  const change = nextChange(state);
  const campaignId = `demo-campaign-created-${change.sequence}`;
  const offerId = `demo-offer-created-${change.sequence}`;
  const outputs = normalizeOutputs(input.outputs);
  const campaign: DemoCampaign = {
    id: campaignId,
    isSample: true,
    title,
    headline: input.headline?.trim() || title,
    description: input.description?.trim() || 'A fictional sample campaign created inside the Adpadz demo workspace.',
    offer: {
      id: offerId,
      title: input.offerTitle?.trim() || 'Sample consultation offer',
      description: input.offerDescription?.trim() || 'This is a fictional offer used only to demonstrate the campaign workflow.',
    },
    ctaLabel: input.ctaLabel?.trim() || 'Learn More',
    status: input.status ?? 'draft',
    format: input.format ?? 'tap_reveal',
    outputs,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    createdAt: change.occurredAt,
    updatedAt: change.occurredAt,
    metrics: { views: 0, qrScans: 0, offerReveals: 0, leads: 0 },
  };

  return withActivity({
    ...state,
    campaigns: [campaign, ...state.campaigns],
    sequence: change.sequence,
    updatedAt: change.occurredAt,
  }, {
    id: change.activityId,
    isSample: true,
    type: 'campaign_created',
    title: 'Sample campaign created',
    detail: `${campaign.title} was added as a fictional ${campaign.status} campaign.`,
    occurredAt: change.occurredAt,
    campaignId,
    leadId: null,
  });
}

function updateCampaign(state: DemoWorkspaceState, campaignId: string, input: DemoUpdateCampaignInput): DemoWorkspaceState {
  const campaign = state.campaigns.find(item => item.id === campaignId);
  if (!campaign) return state;
  const change = nextChange(state);
  const outputs = input.outputs === undefined ? campaign.outputs : normalizeOutputs(input.outputs);
  const updated: DemoCampaign = {
    ...campaign,
    title: input.title?.trim() || campaign.title,
    headline: input.headline?.trim() || campaign.headline,
    description: input.description?.trim() || campaign.description,
    offer: {
      ...campaign.offer,
      title: input.offerTitle?.trim() || campaign.offer.title,
      description: input.offerDescription?.trim() || campaign.offer.description,
    },
    ctaLabel: input.ctaLabel?.trim() || campaign.ctaLabel,
    status: input.status ?? campaign.status,
    format: input.format ?? campaign.format,
    outputs,
    startDate: input.startDate === undefined ? campaign.startDate : input.startDate,
    endDate: input.endDate === undefined ? campaign.endDate : input.endDate,
    updatedAt: change.occurredAt,
  };
  return withActivity({
    ...state,
    campaigns: state.campaigns.map(item => item.id === campaignId ? updated : item),
    sequence: change.sequence,
    updatedAt: change.occurredAt,
  }, {
    id: change.activityId,
    isSample: true,
    type: 'campaign_updated',
    title: 'Campaign updated',
    detail: `${updated.title} now powers every enabled sample output.`,
    occurredAt: change.occurredAt,
    campaignId,
    leadId: null,
  });
}

function updateBusiness(state: DemoWorkspaceState, input: DemoUpdateBusinessInput): DemoWorkspaceState {
  const normalized = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  ) as DemoUpdateBusinessInput;
  if (!Object.values(normalized).some(Boolean)) return state;
  const change = nextChange(state);
  return withActivity({
    ...state,
    business: { ...state.business, ...normalized },
    sequence: change.sequence,
    updatedAt: change.occurredAt,
  }, {
    id: change.activityId,
    isSample: true,
    type: 'business_updated',
    title: 'Business profile updated',
    detail: `${normalized.name || state.business.name} now appears across the shared demo experience.`,
    occurredAt: change.occurredAt,
    campaignId: null,
    leadId: null,
  });
}
function setCampaignStatus(state: DemoWorkspaceState, campaignId: string, status: DemoCampaignStatus): DemoWorkspaceState {
  const campaign = state.campaigns.find(item => item.id === campaignId);
  if (!campaign || campaign.status === status) return state;
  const change = nextChange(state);
  return withActivity({
    ...state,
    campaigns: state.campaigns.map(item => item.id === campaignId ? { ...item, status, updatedAt: change.occurredAt } : item),
    sequence: change.sequence,
    updatedAt: change.occurredAt,
  }, {
    id: change.activityId,
    isSample: true,
    type: 'campaign_status_changed',
    title: 'Campaign status updated',
    detail: `${campaign.title} is now ${status}.`,
    occurredAt: change.occurredAt,
    campaignId,
    leadId: null,
  });
}

function simulateScan(state: DemoWorkspaceState, campaignId: string): DemoWorkspaceState {
  const campaign = state.campaigns.find(item => item.id === campaignId);
  if (!campaign || campaign.status !== 'active' || !campaign.outputs.includes('qr_landing')) return state;
  const change = nextChange(state);
  return withActivity({
    ...state,
    campaigns: state.campaigns.map(item => item.id === campaignId
      ? { ...item, updatedAt: change.occurredAt, metrics: { ...item.metrics, qrScans: item.metrics.qrScans + 1 } }
      : item),
    metrics: { ...state.metrics, qrScans: state.metrics.qrScans + 1 },
    sequence: change.sequence,
    updatedAt: change.occurredAt,
  }, {
    id: change.activityId,
    isSample: true,
    type: 'qr_scan',
    title: 'Sample QR scan recorded',
    detail: `${campaign.title} received a simulated QR scan.`,
    occurredAt: change.occurredAt,
    campaignId,
    leadId: null,
  });
}

function revealOffer(state: DemoWorkspaceState, campaignId: string, offerId: string): DemoWorkspaceState {
  const campaign = state.campaigns.find(item => item.id === campaignId && item.offer.id === offerId);
  const revealKey = `${campaignId}:${offerId}`;
  if (!campaign || !isCampaignCustomerReady(campaign) || state.revealedOfferIds.includes(revealKey)) return state;
  const change = nextChange(state);
  return withActivity({
    ...state,
    campaigns: state.campaigns.map(item => item.id === campaignId
      ? { ...item, updatedAt: change.occurredAt, metrics: { ...item.metrics, offerReveals: item.metrics.offerReveals + 1 } }
      : item),
    metrics: { ...state.metrics, offerReveals: state.metrics.offerReveals + 1 },
    revealedOfferIds: [...state.revealedOfferIds, revealKey],
    sequence: change.sequence,
    updatedAt: change.occurredAt,
  }, {
    id: change.activityId,
    isSample: true,
    type: 'offer_reveal',
    title: 'Sample offer revealed',
    detail: `${campaign.offer.title} was revealed in the interactive demo.`,
    occurredAt: change.occurredAt,
    campaignId,
    leadId: null,
  });
}

function claimOffer(state: DemoWorkspaceState, campaignId: string, offerId: string): DemoWorkspaceState {
  const campaign = state.campaigns.find(item => item.id === campaignId && item.offer.id === offerId);
  const claimKey = `${campaignId}:${offerId}`;
  if (!campaign || !isCampaignCustomerReady(campaign) || state.claimedOfferIds.includes(claimKey)) return state;
  const change = nextChange(state);
  return withActivity({
    ...state,
    metrics: { ...state.metrics, offerClaims: state.metrics.offerClaims + 1 },
    claimedOfferIds: [...state.claimedOfferIds, claimKey],
    sequence: change.sequence,
    updatedAt: change.occurredAt,
  }, {
    id: change.activityId,
    isSample: true,
    type: 'offer_claim',
    title: 'Sample offer claimed',
    detail: `${campaign.offer.title} moved from interest to a measurable customer action.`,
    occurredAt: change.occurredAt,
    campaignId,
    leadId: null,
  });
}

function recordProfileView(state: DemoWorkspaceState): DemoWorkspaceState {
  const change = nextChange(state);
  return withActivity({
    ...state,
    metrics: { ...state.metrics, profileViews: state.metrics.profileViews + 1 },
    sequence: change.sequence,
    updatedAt: change.occurredAt,
  }, {
    id: change.activityId,
    isSample: true,
    type: 'profile_view',
    title: 'Business Profile viewed',
    detail: `${state.business.name} received a measurable sample profile visit.`,
    occurredAt: change.occurredAt,
    campaignId: null,
    leadId: null,
  });
}
function submitSampleLead(state: DemoWorkspaceState, input?: Partial<DemoSampleLeadInput>): DemoWorkspaceState {
  const firstCampaign = state.campaigns.find(item => item.status === 'active') ?? state.campaigns[0];
  const template: DemoSampleLeadInput = {
    name: 'Demo Visitor',
    email: 'visitor@example.com',
    phone: state.business.phone,
    message: `Interested in ${firstCampaign?.title ?? state.business.name}.`,
    source: 'smart_card',
    campaignId: firstCampaign?.id ?? null,
  };
  const requestedCampaignId = input?.campaignId === null ? null : input?.campaignId ?? template.campaignId;
  const campaign = requestedCampaignId
    ? state.campaigns.find(item => item.id === requestedCampaignId) ?? null
    : null;
  const source = input?.source ?? template.source;
  if (requestedCampaignId && (!campaign || !canCampaignAcceptLead(campaign, source))) return state;
  const name = input?.name?.trim() || template.name;
  const change = nextChange(state);
  const leadId = `demo-lead-created-${change.sequence}`;
  const lead: DemoLead = {
    id: leadId,
    isSample: true,
    name,
    email: normalizeContact(input?.email === undefined ? template.email : input.email),
    phone: normalizeContact(input?.phone === undefined ? template.phone : input.phone),
    message: input?.message?.trim() || template.message,
    source,
    campaignId: campaign?.id ?? null,
    status: 'new',
    createdAt: change.occurredAt,
    updatedAt: change.occurredAt,
  };

  return withActivity({
    ...state,
    leads: [lead, ...state.leads],
    campaigns: campaign ? state.campaigns.map(item => item.id === campaign.id
      ? { ...item, metrics: { ...item.metrics, leads: item.metrics.leads + 1 }, updatedAt: change.occurredAt }
      : item) : state.campaigns,
    metrics: {
      ...state.metrics,
      leads: state.metrics.leads + 1,
      bookings: state.metrics.bookings + (lead.source === 'booking_request' ? 1 : 0),
    },
    sequence: change.sequence,
    updatedAt: change.occurredAt,
  }, {
    id: change.activityId,
    isSample: true,
    type: 'lead_submitted',
    title: 'Sample lead captured',
    detail: `${lead.name} entered the fictional demonstration pipeline.`,
    occurredAt: change.occurredAt,
    campaignId: lead.campaignId,
    leadId,
  });
}

function isCampaignCustomerReady(campaign: DemoCampaign): boolean {
  return campaign.status === 'active'
    && campaign.outputs.some(output => CUSTOMER_EXPERIENCE_OUTPUTS.includes(output));
}

function canCampaignAcceptLead(campaign: DemoCampaign, source: DemoLeadSource): boolean {
  if (!isCampaignCustomerReady(campaign)) return false;
  if (source === 'qr_campaign') return campaign.outputs.includes('qr_landing');
  if (source === 'smart_card') return campaign.outputs.includes('smart_card');
  if (source === 'interactive_campaign') return campaign.outputs.includes('interactive_ad');
  return true;
}

function setLeadStatus(state: DemoWorkspaceState, leadId: string, status: DemoLeadStatus): DemoWorkspaceState {
  const lead = state.leads.find(item => item.id === leadId);
  if (!lead || lead.status === status) return state;
  const change = nextChange(state);
  return withActivity({
    ...state,
    leads: state.leads.map(item => item.id === leadId ? { ...item, status, updatedAt: change.occurredAt } : item),
    sequence: change.sequence,
    updatedAt: change.occurredAt,
  }, {
    id: change.activityId,
    isSample: true,
    type: 'lead_status_changed',
    title: 'Sample lead status updated',
    detail: `${lead.name} moved from ${lead.status} to ${status}.`,
    occurredAt: change.occurredAt,
    campaignId: lead.campaignId,
    leadId,
  });
}

function nextChange(state: DemoWorkspaceState): { sequence: number; occurredAt: string; activityId: string } {
  const sequence = state.sequence + 1;
  const currentTime = Date.parse(state.updatedAt);
  const occurredAt = new Date((Number.isFinite(currentTime) ? currentTime : Date.parse(INITIAL_UPDATED_AT)) + 60_000).toISOString();
  return { sequence, occurredAt, activityId: `demo-activity-created-${sequence}` };
}

function withActivity(state: DemoWorkspaceState, activity: DemoActivity): DemoWorkspaceState {
  return { ...state, activity: [activity, ...state.activity].slice(0, MAX_ACTIVITY_ITEMS) };
}

function normalizeOutputs(outputs: DemoCampaignOutput[] | undefined): DemoCampaignOutput[] {
  const selected = outputs?.filter((output, index) => DEMO_CAMPAIGN_OUTPUTS.includes(output) && outputs.indexOf(output) === index) ?? [];
  return selected.length > 0 ? selected : ['smart_card', 'interactive_ad'];
}

function normalizeContact(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

function getLocalStorage(): DemoWorkspaceStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isDemoWorkspaceState(value: unknown): value is DemoWorkspaceState {
  if (!isRecord(value)) return false;
  return value.schemaVersion === DEMO_WORKSPACE_SCHEMA_VERSION
    && value.sampleData === true
    && typeof value.sampleDataNotice === 'string'
    && isDemoBusiness(value.business)
    && Array.isArray(value.campaigns)
    && value.campaigns.every(isDemoCampaign)
    && Array.isArray(value.leads)
    && value.leads.every(isDemoLead)
    && isDemoMetrics(value.metrics)
    && Array.isArray(value.activity)
    && value.activity.every(isDemoActivity)
    && Array.isArray(value.revealedOfferIds)
    && value.revealedOfferIds.every(item => typeof item === 'string')
    && Array.isArray(value.claimedOfferIds)
    && value.claimedOfferIds.every(item => typeof item === 'string')
    && isNonNegativeInteger(value.sequence)
    && typeof value.updatedAt === 'string';
}

function isDemoBusiness(value: unknown): value is DemoBusiness {
  return isRecord(value)
    && value.isSample === true
    && ['id', 'name', 'slug', 'tagline', 'description', 'location', 'phone', 'email', 'website'].every(key => typeof value[key] === 'string')
    && typeof value.profilePublished === 'boolean';
}

function isDemoCampaign(value: unknown): value is DemoCampaign {
  if (!isRecord(value) || !isRecord(value.offer) || !isDemoCampaignMetrics(value.metrics)) return false;
  const offer = value.offer;
  return value.isSample === true
    && ['id', 'title', 'headline', 'description', 'ctaLabel', 'createdAt', 'updatedAt'].every(key => typeof value[key] === 'string')
    && ['id', 'title', 'description'].every(key => typeof offer[key] === 'string')
    && isEnumValue(DEMO_CAMPAIGN_STATUSES, value.status)
    && isEnumValue(DEMO_CAMPAIGN_FORMATS, value.format)
    && Array.isArray(value.outputs)
    && value.outputs.every(output => isEnumValue(DEMO_CAMPAIGN_OUTPUTS, output))
    && isNullableString(value.startDate)
    && isNullableString(value.endDate);
}

function isDemoCampaignMetrics(value: unknown): value is DemoCampaignMetrics {
  return isRecord(value)
    && ['views', 'qrScans', 'offerReveals', 'leads'].every(key => isNonNegativeNumber(value[key]));
}

function isDemoLead(value: unknown): value is DemoLead {
  return isRecord(value)
    && value.isSample === true
    && ['id', 'name', 'message', 'createdAt', 'updatedAt'].every(key => typeof value[key] === 'string')
    && isNullableString(value.email)
    && isNullableString(value.phone)
    && isNullableString(value.campaignId)
    && isDemoLeadSource(value.source)
    && isEnumValue(DEMO_LEAD_STATUSES, value.status);
}

function isDemoMetrics(value: unknown): value is DemoWorkspaceMetrics {
  return isRecord(value)
    && ['profileViews', 'campaignViews', 'qrScans', 'offerReveals', 'leads', 'bookings', 'offerClaims']
      .every(key => isNonNegativeNumber(value[key]));
}

function isDemoActivity(value: unknown): value is DemoActivity {
  const activityTypes: DemoActivityType[] = ['campaign_created', 'campaign_status_changed', 'campaign_updated', 'business_updated', 'qr_scan', 'profile_view', 'offer_reveal', 'offer_claim', 'lead_submitted', 'lead_status_changed'];
  return isRecord(value)
    && value.isSample === true
    && ['id', 'title', 'detail', 'occurredAt'].every(key => typeof value[key] === 'string')
    && activityTypes.includes(value.type as DemoActivityType)
    && isNullableString(value.campaignId)
    && isNullableString(value.leadId);
}

function isDemoLeadSource(value: unknown): value is DemoLeadSource {
  return value === 'smart_card' || value === 'qr_campaign' || value === 'booking_request' || value === 'interactive_campaign';
}

function isEnumValue<const T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
