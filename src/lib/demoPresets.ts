import type {
  DemoActivity,
  DemoBusiness,
  DemoCampaign,
  DemoCampaignFormat,
  DemoCampaignOutput,
  DemoLead,
  DemoLeadSource,
  DemoLeadStatus,
  DemoWorkspaceMetrics,
  DemoWorkspaceState,
} from './demoWorkspace';

export type DemoService = {
  name: string;
  detail: string;
  duration: string;
};

export type DemoBusinessPreset = {
  slug: string;
  industry: string;
  flagship?: boolean;
  challenge: string;
  journey: string;
  outcome: string;
  accent: string;
  heroImage: string;
  beforeImage: string;
  afterImage: string;
  business: Omit<DemoBusiness, 'id' | 'slug' | 'isSample' | 'profilePublished'>;
  services: DemoService[];
  campaigns: CampaignSeed[];
  leads: LeadSeed[];
  metrics: DemoWorkspaceMetrics;
};

type CampaignSeed = {
  slug: string;
  title: string;
  headline: string;
  description: string;
  offerTitle: string;
  offerDescription: string;
  ctaLabel: string;
  status: DemoCampaign['status'];
  format: DemoCampaignFormat;
  outputs: DemoCampaignOutput[];
  metrics: DemoCampaign['metrics'];
};

type LeadSeed = {
  name: string;
  message: string;
  source: DemoLeadSource;
  campaignIndex: number;
  status: DemoLeadStatus;
};

const allOutputs: DemoCampaignOutput[] = [
  'smart_card',
  'interactive_ad',
  'qr_landing',
  'community_mailer',
  'facebook',
  'instagram',
  'email',
  'flyer',
];

const standardOutputs: DemoCampaignOutput[] = [
  'smart_card',
  'interactive_ad',
  'qr_landing',
  'facebook',
  'instagram',
  'email',
];

export const DEMO_BUSINESS_PRESETS: readonly DemoBusinessPreset[] = [
  {
    slug: 'river-city-outdoor-living',
    industry: 'Outdoor living',
    flagship: true,
    challenge: 'Turn seasonal neighborhood awareness into qualified design conversations for higher-consideration outdoor projects.',
    journey: 'A community mailer and Pad QR open an interactive transformation story, reveal a consultation offer, and guide homeowners into a design request.',
    outcome: 'Visitors can follow attributed scans, offer reveals, consultation requests, and lead follow-up without relying on invented revenue claims.',
    accent: '#8EDB39',
    heroImage: '/demo/river-city-hero.svg',
    beforeImage: '/demo/river-city-before.svg',
    afterImage: '/demo/river-city-after.svg',
    business: {
      name: 'River City Outdoor Living',
      tagline: 'Thoughtful outdoor spaces, built for the way you live.',
      description: 'A fictional Jacksonville design-and-build company showing how one seasonal campaign connects neighborhood discovery to a qualified project conversation.',
      location: 'Jacksonville, Florida',
      phone: '(904) 555-0148',
      email: 'hello@rivercityoutdoor.example',
      website: 'https://adpadz.co/examples',
    },
    services: [
      { name: 'Design Direction Session', detail: 'A focused discovery session with a prioritized outdoor design plan.', duration: '75 min session' },
      { name: 'Patio & Outdoor Kitchen Concept', detail: 'Layout, materials, gathering zones, and project priorities in one concept.', duration: '120 min session' },
      { name: 'Backyard Possibility Walkthrough', detail: 'A practical site review with high-impact recommendations.', duration: '60 min walkthrough' },
    ],
    campaigns: [
      campaign('summer-patio', 'Summer Patio Transformation', 'Turn the patio you have into the retreat you want', 'A seasonal story connecting a visual reveal, consultation offer, QR experience, social copy, email, and neighborhood print.', 'Complimentary outdoor design consultation', 'Includes a 30-minute discovery call and a personalized project inspiration board.', 'Plan My Outdoor Space', 'active', 'tap_reveal', allOutputs, 842, 104, 231, 15),
      campaign('backyard-reveal', 'Backyard Before & After', 'Slide from overlooked yard to unforgettable gathering space', 'An interactive proof story that demonstrates design quality and invites a qualified consultation request.', 'Complimentary landscape-lighting concept', 'Available with a qualifying patio or outdoor-kitchen design agreement.', 'See What Is Possible', 'active', 'before_after', standardOutputs, 611, 60, 148, 8),
      campaign('firelight', 'Firelight Season Preview', 'Scratch to uncover a warmer way to gather', 'An autumn campaign prepared once for interactive, QR, mailer, social, email, and flyer experiences.', 'Free fire-feature planning session', 'Explore placement, fuel, finish, seating, and safety with a project designer.', 'Reserve a Planning Session', 'scheduled', 'scratch', allOutputs, 0, 0, 0, 0),
    ],
    leads: [
      lead('Avery Monroe', 'Interested in an outdoor kitchen consultation next week.', 'booking_request', 0, 'new'),
      lead('Morgan Lee', 'The before-and-after project is close to what we want for our yard.', 'interactive_campaign', 1, 'qualified'),
      lead('Riley Chen', 'Please send details about the complimentary design consultation.', 'qr_campaign', 0, 'contacted'),
      lead('Cameron Hayes', 'Looking for a paver patio and landscape lighting estimate.', 'smart_card', 1, 'new'),
      lead('Quinn Parker', 'We booked our discovery call and are ready for the next step.', 'booking_request', 0, 'closed'),
    ],
    metrics: metrics(2389, 1453, 186, 379, 27, 22, 45),
  },
  {
    slug: 'harbor-and-hearth',
    industry: 'Restaurant',
    challenge: 'Fill slower midweek tables while helping nearby residents discover the restaurant beyond crowded social feeds.',
    journey: 'A neighborhood mailer opens a chef-led interactive special, then routes guests to a reservation request and a trackable dining offer.',
    outcome: 'The story demonstrates measurable menu views, QR visits, offer reveals, reservation requests, and repeat local engagement.',
    accent: '#FFB84D',
    heroImage: '/demo/harbor-hearth.svg',
    beforeImage: '/demo/harbor-hearth.svg',
    afterImage: '/demo/harbor-hearth.svg',
    business: {
      name: 'Harbor & Hearth Kitchen',
      tagline: 'Coastal comfort, gathered around the neighborhood table.',
      description: 'A fictional neighborhood restaurant using Adpadz to make a midweek dining story discoverable from print through reservation.',
      location: 'St. Augustine, Florida',
      phone: '(904) 555-0214',
      email: 'table@harborandhearth.example',
      website: 'https://adpadz.co/examples',
    },
    services: [
      { name: 'Dinner Reservation', detail: 'Seasonal coastal menu with indoor and courtyard seating.', duration: '90 min table' },
      { name: 'Chef Table Experience', detail: 'A guided multi-course evening for small celebrations.', duration: '2 hour experience' },
      { name: 'Neighborhood Catering', detail: 'Flexible menus for local gatherings and workplace lunches.', duration: 'Custom planning' },
    ],
    campaigns: [
      campaign('midweek-table', 'The Midweek Table', 'Wednesday deserves something worth gathering for', 'A chef-led reveal connecting a neighborhood postcard to a seasonal prix-fixe menu and reservation request.', 'Complimentary shared dessert', 'Reserve the seasonal Wednesday menu for two or more guests.', 'Request a Table', 'active', 'tap_reveal', allOutputs, 764, 132, 286, 42),
      campaign('courtyard-evenings', 'Courtyard Evenings', 'See the neighborhood table after sunset', 'A visual story introducing live acoustic evenings and courtyard reservations.', 'First round of house lemonades', 'Available with a courtyard reservation during the featured series.', 'Explore Courtyard Nights', 'active', 'before_after', standardOutputs, 489, 74, 119, 24),
      campaign('fall-menu', 'First Taste of Fall', 'Scratch to reveal the chefâ€™s next seasonal plate', 'A scheduled menu preview ready for print, email, QR, and social handoff.', 'Seasonal tasting invitation', 'Join the preview list for the first fall menu weekend.', 'Join the Preview List', 'scheduled', 'scratch', allOutputs, 0, 0, 0, 0),
    ],
    leads: [
      lead('Mia Carter', 'Table for four next Wednesday around 7:00.', 'booking_request', 0, 'new'),
      lead('Noah Brooks', 'Is the courtyard available for an anniversary dinner?', 'qr_campaign', 1, 'qualified'),
      lead('Sofia James', 'Please send the catering menu for a team lunch.', 'smart_card', 0, 'contacted'),
    ],
    metrics: metrics(1812, 1253, 221, 405, 66, 51, 73),
  },
  {
    slug: 'brightline-home-care',
    industry: 'Home services',
    challenge: 'Build trust before the first call and separate a careful local service company from anonymous lead-generation listings.',
    journey: 'A service-area mailer opens a before-and-after proof campaign, explains the diagnostic process, and leads directly into a service request.',
    outcome: 'The demo follows proof views, QR scans, diagnostic offer engagement, service requests, and lead qualification.',
    accent: '#62D8FF',
    heroImage: '/demo/brightline-home.svg',
    beforeImage: '/demo/brightline-home.svg',
    afterImage: '/demo/brightline-home.svg',
    business: {
      name: 'BrightLine Home Care',
      tagline: 'Clear answers and careful work for the home you count on.',
      description: 'A fictional locally owned home-services team showing how proof, service clarity, and fast follow-up can work as one connected campaign.',
      location: 'Raleigh, North Carolina',
      phone: '(919) 555-0176',
      email: 'help@brightlinehome.example',
      website: 'https://adpadz.co/examples',
    },
    services: [
      { name: 'Home Comfort Diagnostic', detail: 'A clear inspection and prioritized next-step report.', duration: '60 min visit' },
      { name: 'Seasonal System Tune-Up', detail: 'Preventive service focused on reliability and efficiency.', duration: '75 min service' },
      { name: 'Indoor Air Review', detail: 'Practical recommendations for filtration and airflow.', duration: '45 min review' },
    ],
    campaigns: [
      campaign('comfort-check', 'The Home Comfort Check', 'Find the small issue before it becomes the weekend emergency', 'A trust-first diagnostic campaign combining local proof, a QR explainer, and a service request.', 'No-cost comfort conversation', 'A 15-minute call to identify the right diagnostic visit for the home.', 'Request Service', 'active', 'tap_reveal', allOutputs, 932, 166, 207, 38),
      campaign('airflow-proof', 'Room-to-Room Comfort Proof', 'Slide from uneven airflow to a balanced home plan', 'A before-and-after education story for homeowners dealing with uneven rooms.', 'Complimentary airflow checklist', 'A practical checklist delivered after a qualifying diagnostic visit.', 'See the Diagnostic Process', 'active', 'before_after', standardOutputs, 578, 91, 136, 19),
      campaign('winter-ready', 'Winter-Ready Home', 'Scratch to reveal the seasonal maintenance list', 'A scheduled readiness campaign prepared for QR, mailer, email, and flyer outputs.', 'Priority tune-up window', 'Request an early seasonal appointment before the first cold snap.', 'Reserve a Tune-Up', 'scheduled', 'scratch', allOutputs, 0, 0, 0, 0),
    ],
    leads: [
      lead('Ethan Ward', 'Upstairs is much warmer than the rest of the house.', 'booking_request', 0, 'new'),
      lead('Grace Kim', 'The airflow story sounds exactly like our home.', 'interactive_campaign', 1, 'qualified'),
      lead('Lucas Reed', 'Can you call about a seasonal tune-up?', 'qr_campaign', 0, 'contacted'),
    ],
    metrics: metrics(2076, 1510, 274, 343, 49, 36, 58),
  },
  {
    slug: 'paws-and-polish',
    industry: 'Pet grooming',
    challenge: 'Help anxious pet owners understand the calm-care process before asking them to book a first appointment.',
    journey: 'Local print and QR introduce a reassuring groomer profile, a transformation story, and a low-pressure first-visit request.',
    outcome: 'The experience measures care-guide views, offer reveals, first-visit requests, and returning-customer interest.',
    accent: '#FF78B7',
    heroImage: '/demo/paws-polish.svg',
    beforeImage: '/demo/paws-polish.svg',
    afterImage: '/demo/paws-polish.svg',
    business: {
      name: 'Paws & Polish Grooming Co.',
      tagline: 'Patient grooming for pets who deserve a gentler visit.',
      description: 'A fictional independent groomer using a calm, visual customer journey to build confidence before the first appointment.',
      location: 'Savannah, Georgia',
      phone: '(912) 555-0139',
      email: 'hello@pawsandpolish.example',
      website: 'https://adpadz.co/examples',
    },
    services: [
      { name: 'Gentle Full Groom', detail: 'A paced appointment tailored to coat, comfort, and temperament.', duration: '2â€“3 hour visit' },
      { name: 'Bath & Brush Reset', detail: 'Coat care, nails, ears, and a comfortable finishing brush.', duration: '90 min visit' },
      { name: 'Puppy First Visit', detail: 'A shorter positive introduction to sounds, tools, and handling.', duration: '45 min visit' },
    ],
    campaigns: [
      campaign('calm-first-visit', 'A Calmer First Groom', 'Meet the gentle routine before your pet walks through the door', 'A reassuring interactive experience that explains the visit and invites a first appointment request.', 'Complimentary comfort consultation', 'Share your petâ€™s needs with a groomer before scheduling the first service.', 'Plan a First Visit', 'active', 'tap_reveal', allOutputs, 689, 118, 244, 47),
      campaign('coat-transformation', 'Fresh Coat Transformation', 'Slide from overdue coat to comfortable, polished pup', 'A proof-focused before-and-after story with transparent care notes.', 'Free take-home coat guide', 'Included after a qualifying full-groom appointment.', 'See the Care Story', 'active', 'before_after', standardOutputs, 521, 67, 153, 31),
      campaign('holiday-ready', 'Holiday Photo Ready', 'Scratch to reveal the seasonal finishing touch', 'A scheduled holiday grooming campaign for local print and digital outputs.', 'Seasonal bandana upgrade', 'Included with a holiday grooming appointment while supplies last.', 'Request Holiday Grooming', 'scheduled', 'scratch', allOutputs, 0, 0, 0, 0),
    ],
    leads: [
      lead('Olivia Martin', 'Our rescue dog is nervous around dryers. Can we talk first?', 'booking_request', 0, 'new'),
      lead('Henry Davis', 'Interested in the puppy first-visit option.', 'smart_card', 0, 'qualified'),
      lead('Amelia Scott', 'The coat guide would be helpful for our doodle.', 'interactive_campaign', 1, 'contacted'),
    ],
    metrics: metrics(1644, 1210, 197, 397, 71, 58, 82),
  },
  {
    slug: 'lumen-house-studio',
    industry: 'Salon & beauty',
    challenge: 'Turn beautiful work into consultative bookings instead of passive inspiration and price-shopping messages.',
    journey: 'A visual campaign introduces the stylistâ€™s process, reveals a consultation offer, and routes visitors to the right service request.',
    outcome: 'The story connects portfolio engagement, offer reveals, consultation requests, and lead follow-up.',
    accent: '#D7A6FF',
    heroImage: '/demo/lumen-house.svg',
    beforeImage: '/demo/lumen-house.svg',
    afterImage: '/demo/lumen-house.svg',
    business: {
      name: 'Lumen House Studio',
      tagline: 'Modern color and thoughtful care, designed around you.',
      description: 'A fictional independent beauty studio demonstrating how visual proof becomes a clear consultation path instead of another disconnected post.',
      location: 'Charlotte, North Carolina',
      phone: '(704) 555-0198',
      email: 'studio@lumenhouse.example',
      website: 'https://adpadz.co/examples',
    },
    services: [
      { name: 'Color Direction Consultation', detail: 'A personalized color plan based on goals, history, and maintenance.', duration: '30 min consultation' },
      { name: 'Dimensional Color Session', detail: 'Custom placement, toning, treatment, and finish.', duration: '3â€“4 hour session' },
      { name: 'Signature Cut & Finish', detail: 'Shape, care guidance, and a polished finish.', duration: '75 min appointment' },
    ],
    campaigns: [
      campaign('color-story', 'Your Next Color Story', 'Reveal a color direction built for your real routine', 'A consultation-led campaign connecting transformation proof, care expectations, and booking intent.', 'Complimentary color direction call', 'A focused conversation before committing to a dimensional color appointment.', 'Request a Color Consultation', 'active', 'tap_reveal', allOutputs, 817, 96, 312, 54),
      campaign('dimensional-proof', 'Dimensional Color, Up Close', 'Slide through the placement, tone, and finished movement', 'A before-and-after proof experience designed to answer quality questions visually.', 'Personalized maintenance plan', 'Included after a qualifying dimensional color service.', 'Explore the Transformation', 'active', 'before_after', standardOutputs, 634, 58, 201, 29),
      campaign('event-season', 'Event Season Finish', 'Scratch to reveal the studio finishing ritual', 'A scheduled occasion campaign prepared for email, QR, social, and flyer outputs.', 'Finishing treatment upgrade', 'Available with select event-season appointments.', 'Request an Appointment', 'scheduled', 'scratch', allOutputs, 0, 0, 0, 0),
    ],
    leads: [
      lead('Isabella Young', 'I want lower-maintenance dimension and would love a consultation.', 'booking_request', 0, 'new'),
      lead('Charlotte Hall', 'The transformation shows the tone I have been trying to describe.', 'interactive_campaign', 1, 'qualified'),
      lead('Evelyn Allen', 'Can someone explain the maintenance plan?', 'qr_campaign', 0, 'contacted'),
    ],
    metrics: metrics(1933, 1451, 163, 513, 78, 62, 91),
  },
  {
    slug: 'northstar-story-co',
    industry: 'Photography',
    challenge: 'Help families understand the experience and emotional value before reducing the decision to a list of package prices.',
    journey: 'A neighborhood campaign opens a story-led portfolio, reveals a planning session, and guides families into a session inquiry.',
    outcome: 'The demo tracks portfolio views, QR discovery, guide reveals, session inquiries, and qualified follow-up.',
    accent: '#FFD96A',
    heroImage: '/demo/northstar-story.svg',
    beforeImage: '/demo/northstar-story.svg',
    afterImage: '/demo/northstar-story.svg',
    business: {
      name: 'Northstar Story Co.',
      tagline: 'Honest photographs of the people and seasons you want to remember.',
      description: 'A fictional family photographer using an editorial campaign journey to move visitors from inspiration to a well-prepared session inquiry.',
      location: 'Richmond, Virginia',
      phone: '(804) 555-0165',
      email: 'stories@northstarstory.example',
      website: 'https://adpadz.co/examples',
    },
    services: [
      { name: 'Family Story Session', detail: 'A relaxed, guided session at home or in a meaningful local setting.', duration: '90 min session' },
      { name: 'Newborn at Home', detail: 'Quiet documentary coverage built around the familyâ€™s pace.', duration: '2 hour session' },
      { name: 'Senior Story Session', detail: 'A personalized session reflecting interests, place, and personality.', duration: '90 min session' },
    ],
    campaigns: [
      campaign('family-season', 'The Season You Are In', 'Turn ordinary afternoons into the photographs you keep', 'An editorial campaign connecting portfolio storytelling, a planning guide, and session inquiries.', 'Complimentary story-planning call', 'Choose the setting, pace, and details that make the session feel like your family.', 'Plan a Family Session', 'active', 'tap_reveal', allOutputs, 703, 88, 226, 35),
      campaign('album-proof', 'From Session to Heirloom', 'Slide from a camera roll to a finished family story', 'A proof experience showing how photographs become a coherent printed collection.', 'Complimentary album design preview', 'Available after a qualifying family or newborn session.', 'See the Finished Story', 'active', 'before_after', standardOutputs, 467, 51, 127, 18),
      campaign('autumn-stories', 'Autumn Story Dates', 'Scratch to reveal the quietest session window', 'A scheduled seasonal campaign prepared for neighborhood, QR, email, and social discovery.', 'Early planning guide', 'Receive the location and wardrobe guide before public session dates open.', 'Join the Date List', 'scheduled', 'scratch', allOutputs, 0, 0, 0, 0),
    ],
    leads: [
      lead('Harper Evans', 'We are interested in an at-home family story session.', 'booking_request', 0, 'new'),
      lead('Jack Turner', 'Could you show us what an album design preview includes?', 'interactive_campaign', 1, 'qualified'),
      lead('Lily Cooper', 'Please send the autumn planning guide.', 'qr_campaign', 0, 'contacted'),
    ],
    metrics: metrics(1518, 1037, 139, 353, 49, 37, 64),
  },
] as const;

export const DEMO_DEFAULT_BUSINESS_SLUG = DEMO_BUSINESS_PRESETS[0].slug;

export function getDemoBusinessPreset(slug: string | null | undefined): DemoBusinessPreset | null {
  if (!slug) return null;
  return DEMO_BUSINESS_PRESETS.find(preset => preset.slug === slug) ?? null;
}

export function createDemoPresetWorkspace(slug = DEMO_DEFAULT_BUSINESS_SLUG): DemoWorkspaceState {
  const preset = getDemoBusinessPreset(slug) ?? DEMO_BUSINESS_PRESETS[0];
  const createdAt = '2026-07-10T14:00:00.000Z';
  const campaigns = preset.campaigns.map((seed, index) => createCampaignFromSeed(preset.slug, seed, index));
  const leads = preset.leads.map((seed, index) => createLeadFromSeed(preset, campaigns, seed, index));
  const activity = createActivities(preset, campaigns, leads);
  return {
    schemaVersion: 3,
    sampleData: true,
    sampleDataNotice: 'Fictional sample data for demonstrating Adpadz. No real customers or results are represented.',
    business: {
      id: `demo-business-${preset.slug}`,
      slug: preset.slug,
      isSample: true,
      profilePublished: true,
      ...preset.business,
    },
    campaigns,
    leads,
    metrics: { ...preset.metrics },
    activity,
    revealedOfferIds: [],
    claimedOfferIds: [],
    sequence: 100,
    updatedAt: createdAt,
  };
}

function campaign(
  slug: string,
  title: string,
  headline: string,
  description: string,
  offerTitle: string,
  offerDescription: string,
  ctaLabel: string,
  status: DemoCampaign['status'],
  format: DemoCampaignFormat,
  outputs: DemoCampaignOutput[],
  views: number,
  qrScans: number,
  offerReveals: number,
  leads: number,
): CampaignSeed {
  return { slug, title, headline, description, offerTitle, offerDescription, ctaLabel, status, format, outputs, metrics: { views, qrScans, offerReveals, leads } };
}

function lead(name: string, message: string, source: DemoLeadSource, campaignIndex: number, status: DemoLeadStatus): LeadSeed {
  return { name, message, source, campaignIndex, status };
}

function metrics(profileViews: number, campaignViews: number, qrScans: number, offerReveals: number, leads: number, bookings: number, offerClaims: number): DemoWorkspaceMetrics {
  return { profileViews, campaignViews, qrScans, offerReveals, leads, bookings, offerClaims };
}

function createCampaignFromSeed(businessSlug: string, seed: CampaignSeed, index: number): DemoCampaign {
  const id = `demo-${businessSlug}-campaign-${seed.slug}`;
  return {
    id,
    isSample: true,
    title: seed.title,
    headline: seed.headline,
    description: seed.description,
    offer: {
      id: `demo-${businessSlug}-offer-${seed.slug}`,
      title: seed.offerTitle,
      description: seed.offerDescription,
    },
    ctaLabel: seed.ctaLabel,
    status: seed.status,
    format: seed.format,
    outputs: [...seed.outputs],
    startDate: index === 2 ? '2026-09-01T12:00:00.000Z' : '2026-06-15T12:00:00.000Z',
    endDate: index === 2 ? '2026-11-30T23:59:59.000Z' : '2026-10-01T23:59:59.000Z',
    createdAt: `2026-06-${String(2 + index * 9).padStart(2, '0')}T15:30:00.000Z`,
    updatedAt: `2026-07-10T1${3 - index}:40:00.000Z`,
    metrics: { ...seed.metrics },
  };
}

function createLeadFromSeed(preset: DemoBusinessPreset, campaigns: DemoCampaign[], seed: LeadSeed, index: number): DemoLead {
  const campaign = campaigns[seed.campaignIndex] ?? campaigns[0];
  const compactName = seed.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.+|\.+$/g, '');
  const createdAt = `2026-07-${String(10 - index).padStart(2, '0')}T13:${String(42 - index * 7).padStart(2, '0')}:00.000Z`;
  return {
    id: `demo-${preset.slug}-lead-${index + 1}`,
    isSample: true,
    name: seed.name,
    email: `${compactName}@example.com`,
    phone: `(${preset.business.phone.slice(1, 4)}) 555-${String(1100 + index * 37).padStart(4, '0')}`,
    message: seed.message,
    source: seed.source,
    campaignId: campaign.id,
    status: seed.status,
    createdAt,
    updatedAt: createdAt,
  };
}

function createActivities(preset: DemoBusinessPreset, campaigns: DemoCampaign[], leads: DemoLead[]): DemoActivity[] {
  const campaign = campaigns[0];
  const lead = leads[0];
  return [
    activity(`${preset.slug}-activity-1`, 'lead_submitted', 'New customer request', `${lead.name} entered the ${preset.industry.toLowerCase()} campaign journey.`, '2026-07-10T13:42:00.000Z', campaign.id, lead.id),
    activity(`${preset.slug}-activity-2`, 'qr_scan', 'Campaign QR scanned', `${campaign.title} opened from a local printed placement.`, '2026-07-10T13:36:00.000Z', campaign.id, null),
    activity(`${preset.slug}-activity-3`, 'offer_reveal', 'Offer revealed', `A visitor unlocked ${campaign.offer.title.toLowerCase()}.`, '2026-07-10T13:31:00.000Z', campaign.id, null),
  ];
}

function activity(
  id: string,
  type: DemoActivity['type'],
  title: string,
  detail: string,
  occurredAt: string,
  campaignId: string | null,
  leadId: string | null,
): DemoActivity {
  return { id: `demo-${id}`, isSample: true, type, title, detail, occurredAt, campaignId, leadId };
}
