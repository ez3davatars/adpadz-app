/**
 * Client-side sales demo state.
 *
 * Every record in this module is fictional sample data. Nothing here should
 * be represented as a real customer, lead, campaign result, or testimonial.
 */

export const DEMO_WORKSPACE_SCHEMA_VERSION = 2 as const;
export const DEMO_WORKSPACE_STORAGE_KEY = 'adpadz-demo-workspace-v2';
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
  | { type: 'analytics/scan'; campaignId: string }
  | { type: 'offer/reveal'; campaignId: string; offerId: string }
  | { type: 'lead/submit-sample'; payload?: Partial<DemoSampleLeadInput> }
  | { type: 'lead/status'; leadId: string; status: DemoLeadStatus }
  | { type: 'workspace/reset' };

export type DemoWorkspaceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const INITIAL_UPDATED_AT = '2026-07-10T14:00:00.000Z';
const MAX_ACTIVITY_ITEMS = 30;
const CUSTOMER_EXPERIENCE_OUTPUTS: readonly DemoCampaignOutput[] = ['smart_card', 'interactive_ad', 'qr_landing'];

const sampleLeadTemplates: DemoSampleLeadInput[] = [
  {
    name: 'Taylor Morgan',
    email: 'taylor.morgan@example.com',
    phone: '(904) 555-0184',
    message: 'I would like a design consultation for a covered patio and outdoor kitchen.',
    source: 'smart_card',
    campaignId: 'demo-campaign-summer-patio',
  },
  {
    name: 'Jordan Ellis',
    email: 'jordan.ellis@example.com',
    phone: '(904) 555-0127',
    message: 'Can someone call me about the landscape-lighting concept featured in the QR offer?',
    source: 'qr_campaign',
    campaignId: 'demo-campaign-backyard-reveal',
  },
  {
    name: 'Casey Bennett',
    email: 'casey.bennett@example.com',
    phone: '(904) 555-0162',
    message: 'I am interested in a Saturday backyard planning appointment.',
    source: 'booking_request',
    campaignId: 'demo-campaign-backyard-reveal',
  },
];

/** Returns a fresh copy of the fictional River City Outdoor Living workspace. */
export function createInitialDemoWorkspaceState(): DemoWorkspaceState {
  return {
    schemaVersion: DEMO_WORKSPACE_SCHEMA_VERSION,
    sampleData: true,
    sampleDataNotice: DEMO_SAMPLE_DATA_NOTICE,
    business: {
      id: 'demo-business-river-city-outdoor-living',
      isSample: true,
      name: 'River City Outdoor Living',
      slug: 'river-city-outdoor-living-demo',
      tagline: 'Thoughtful outdoor spaces, built for the way you live.',
      description: 'A fictional Jacksonville design-and-build company used to demonstrate the complete Adpadz customer journey.',
      location: 'Jacksonville, Florida',
      phone: '(904) 555-0148',
      email: 'hello@rivercityoutdoor.example',
      website: 'https://adpadz.co/examples',
      profilePublished: true,
    },
    campaigns: [
      {
        id: 'demo-campaign-summer-patio',
        isSample: true,
        title: 'Summer Patio Transformation',
        headline: 'Turn the patio you have into the retreat you want',
        description: 'A premium seasonal campaign connecting a visual reveal, consultation offer, QR experience, social copy, email, and print-ready flyer.',
        offer: {
          id: 'demo-offer-design-consultation',
          title: 'Complimentary outdoor design consultation',
          description: 'Includes a 30-minute discovery call and a personalized project inspiration board.',
        },
        ctaLabel: 'Plan My Outdoor Space',
        status: 'active',
        format: 'tap_reveal',
        outputs: ['smart_card', 'interactive_ad', 'qr_landing', 'community_mailer', 'facebook', 'instagram', 'email', 'flyer'],
        startDate: '2026-06-15T12:00:00.000Z',
        endDate: '2026-09-15T23:59:59.000Z',
        createdAt: '2026-06-02T15:30:00.000Z',
        updatedAt: '2026-07-10T13:40:00.000Z',
        metrics: { views: 842, qrScans: 104, offerReveals: 231, leads: 15 },
      },
      {
        id: 'demo-campaign-backyard-reveal',
        isSample: true,
        title: 'Backyard Before & After',
        headline: 'Slide from overlooked yard to unforgettable gathering space',
        description: 'An interactive before-and-after story showcasing design quality while driving qualified consultation requests.',
        offer: {
          id: 'demo-offer-lighting-upgrade',
          title: 'Complimentary landscape-lighting concept',
          description: 'Available with a qualifying patio or outdoor-kitchen design agreement.',
        },
        ctaLabel: 'See What Is Possible',
        status: 'active',
        format: 'before_after',
        outputs: ['smart_card', 'interactive_ad', 'qr_landing', 'facebook', 'instagram', 'email'],
        startDate: '2026-07-01T12:00:00.000Z',
        endDate: '2026-10-01T23:59:59.000Z',
        createdAt: '2026-06-21T16:15:00.000Z',
        updatedAt: '2026-07-10T13:25:00.000Z',
        metrics: { views: 611, qrScans: 60, offerReveals: 148, leads: 8 },
      },
      {
        id: 'demo-campaign-firelight',
        isSample: true,
        title: 'Firelight Season Preview',
        headline: 'Scratch to uncover a warmer way to gather',
        description: 'A scheduled autumn campaign prepared once for interactive, QR, mailer, social, email, and flyer distribution.',
        offer: {
          id: 'demo-offer-fire-pit-plan',
          title: 'Free fire-feature planning session',
          description: 'Explore placement, fuel, finish, seating, and safety options with a project designer.',
        },
        ctaLabel: 'Reserve a Planning Session',
        status: 'scheduled',
        format: 'scratch',
        outputs: ['smart_card', 'interactive_ad', 'qr_landing', 'community_mailer', 'facebook', 'instagram', 'email', 'flyer'],
        startDate: '2026-09-01T12:00:00.000Z',
        endDate: '2026-11-30T23:59:59.000Z',
        createdAt: '2026-07-02T14:45:00.000Z',
        updatedAt: '2026-07-10T12:55:00.000Z',
        metrics: { views: 0, qrScans: 0, offerReveals: 0, leads: 0 },
      },
    ],
    leads: [
      sampleLead('demo-lead-avery', 'Avery Monroe', 'avery.monroe@example.com', '(904) 555-0109', 'Interested in an outdoor kitchen consultation next week.', 'booking_request', 'demo-campaign-summer-patio', 'new', '2026-07-10T13:42:00.000Z'),
      sampleLead('demo-lead-morgan', 'Morgan Lee', 'morgan.lee@example.com', '(904) 555-0191', 'The before-and-after project is close to what we want for our yard.', 'interactive_campaign', 'demo-campaign-backyard-reveal', 'qualified', '2026-07-10T12:18:00.000Z'),
      sampleLead('demo-lead-riley', 'Riley Chen', 'riley.chen@example.com', '(904) 555-0173', 'Please send details about the complimentary design consultation.', 'qr_campaign', 'demo-campaign-summer-patio', 'contacted', '2026-07-09T19:24:00.000Z'),
      sampleLead('demo-lead-cameron', 'Cameron Hayes', 'cameron.hayes@example.com', '(904) 555-0136', 'Looking for a paver patio and landscape lighting estimate.', 'smart_card', 'demo-campaign-backyard-reveal', 'new', '2026-07-09T15:36:00.000Z'),
      sampleLead('demo-lead-quinn', 'Quinn Parker', 'quinn.parker@example.com', '(904) 555-0115', 'We booked our discovery call and are ready for the next step.', 'booking_request', 'demo-campaign-summer-patio', 'closed', '2026-07-08T17:05:00.000Z'),
    ],
    metrics: {
      profileViews: 2389,
      campaignViews: 1453,
      qrScans: 186,
      offerReveals: 379,
      leads: 27,
      bookings: 22,
      offerClaims: 45,
    },
    activity: [
      sampleActivity('demo-activity-1', 'lead_submitted', 'New consultation request', 'Avery Monroe requested an outdoor kitchen consultation.', '2026-07-10T13:42:00.000Z', 'demo-campaign-summer-patio', 'demo-lead-avery'),
      sampleActivity('demo-activity-2', 'qr_scan', 'Campaign QR scanned', 'Summer Patio Transformation opened from a neighborhood mailer.', '2026-07-10T13:36:00.000Z', 'demo-campaign-summer-patio', null),
      sampleActivity('demo-activity-3', 'offer_reveal', 'Offer revealed', 'A visitor unlocked the complimentary design consultation.', '2026-07-10T13:31:00.000Z', 'demo-campaign-summer-patio', null),
      sampleActivity('demo-activity-4', 'lead_status_changed', 'Lead qualified', 'Morgan Lee moved from contacted to qualified.', '2026-07-10T12:48:00.000Z', 'demo-campaign-backyard-reveal', 'demo-lead-morgan'),
      sampleActivity('demo-activity-5', 'qr_scan', 'Campaign QR scanned', 'Backyard Before & After opened from a printed leave-behind.', '2026-07-10T12:34:00.000Z', 'demo-campaign-backyard-reveal', null),
    ],
    revealedOfferIds: [],
    sequence: 100,
    updatedAt: INITIAL_UPDATED_AT,
  };
}

export function demoWorkspaceReducer(state: DemoWorkspaceState, action: DemoWorkspaceAction): DemoWorkspaceState {
  switch (action.type) {
    case 'campaign/create':
      return createCampaign(state, action.payload);
    case 'campaign/status':
      return setCampaignStatus(state, action.campaignId, action.status);
    case 'analytics/scan':
      return simulateScan(state, action.campaignId);
    case 'offer/reveal':
      return revealOffer(state, action.campaignId, action.offerId);
    case 'lead/submit-sample':
      return submitSampleLead(state, action.payload);
    case 'lead/status':
      return setLeadStatus(state, action.leadId, action.status);
    case 'workspace/reset':
      return createInitialDemoWorkspaceState();
    default:
      return state;
  }
}

export const demoWorkspaceActions = {
  createCampaign: (payload: DemoCreateCampaignInput): DemoWorkspaceAction => ({ type: 'campaign/create', payload }),
  setCampaignStatus: (campaignId: string, status: DemoCampaignStatus): DemoWorkspaceAction => ({ type: 'campaign/status', campaignId, status }),
  simulateScan: (campaignId: string): DemoWorkspaceAction => ({ type: 'analytics/scan', campaignId }),
  revealOffer: (campaignId: string, offerId: string): DemoWorkspaceAction => ({ type: 'offer/reveal', campaignId, offerId }),
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

/** Loads a valid demo snapshot or returns a fresh fictional sample workspace. */
export function loadDemoWorkspaceState(storage: DemoWorkspaceStorage | null = getSessionStorage()): DemoWorkspaceState {
  if (!storage) return createInitialDemoWorkspaceState();
  try {
    return deserializeDemoWorkspaceState(storage.getItem(DEMO_WORKSPACE_STORAGE_KEY))
      ?? createInitialDemoWorkspaceState();
  } catch {
    return createInitialDemoWorkspaceState();
  }
}

export function saveDemoWorkspaceState(
  state: DemoWorkspaceState,
  storage: DemoWorkspaceStorage | null = getSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(DEMO_WORKSPACE_STORAGE_KEY, serializeDemoWorkspaceState(state));
  } catch {
    // A blocked or full session store must not break the self-contained demo.
  }
}

export function clearDemoWorkspaceState(storage: DemoWorkspaceStorage | null = getSessionStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(DEMO_WORKSPACE_STORAGE_KEY);
  } catch {
    // A blocked session store is equivalent to an already-cleared demo.
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

function submitSampleLead(state: DemoWorkspaceState, input?: Partial<DemoSampleLeadInput>): DemoWorkspaceState {
  const template = sampleLeadTemplates[state.sequence % sampleLeadTemplates.length];
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

function sampleLead(
  id: string,
  name: string,
  email: string,
  phone: string,
  message: string,
  source: DemoLeadSource,
  campaignId: string,
  status: DemoLeadStatus,
  createdAt: string,
): DemoLead {
  return { id, isSample: true, name, email, phone, message, source, campaignId, status, createdAt, updatedAt: createdAt };
}

function sampleActivity(
  id: string,
  type: DemoActivityType,
  title: string,
  detail: string,
  occurredAt: string,
  campaignId: string | null,
  leadId: string | null,
): DemoActivity {
  return { id, isSample: true, type, title, detail, occurredAt, campaignId, leadId };
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

function getSessionStorage(): DemoWorkspaceStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
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
  const activityTypes: DemoActivityType[] = ['campaign_created', 'campaign_status_changed', 'qr_scan', 'offer_reveal', 'lead_submitted', 'lead_status_changed'];
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
