import { getPublicAppUrl, normalizeSlug } from './qr/qrUtils';

export type BusinessCardTheme = 'market-pop' | 'neon-local' | 'sunset-shop' | 'fresh-service';
export type BusinessCardTemplate =
  | 'modern_glass'
  | 'luxury'
  | 'restaurant'
  | 'home_services'
  | 'realtor'
  | 'fitness'
  | 'automotive'
  | 'minimal';

export type ImageFitMode = 'cover' | 'contain' | 'custom';
export type BusinessCardBookingMode = 'external' | 'request';

export type ImageDisplayPreferences = {
  fit: ImageFitMode;
  position_x: number;
  position_y: number;
  zoom: number;
};

export type BusinessCardEventType =
  | 'card_view'
  | 'qr_scan'
  | 'call_click'
  | 'text_click'
  | 'email_click'
  | 'website_click'
  | 'directions_click'
  | 'offer_view'
  | 'offer_claim'
  | 'save_contact'
  | 'document_view'
  | 'document_click'
  | 'virtual_tour_view'
  | 'virtual_tour_click'
  | 'before_after_view'
  | 'before_after_interaction'
  | 'testimonial_view'
  | 'lead_submit'
  | 'booking_click'
  | 'booking_request_submit'
  | 'interactive_ad_click'
  | 'media_click';

export type BusinessCardRecord = {
  id: string;
  owner_user_id: string | null;
  business_id: string | null;
  business_name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  logo_image_id?: string | null;
  logo_fit?: ImageFitMode | null;
  logo_position_x?: number | null;
  logo_position_y?: number | null;
  logo_zoom?: number | null;
  cover_image_url: string | null;
  cover_image_id?: string | null;
  cover_fit?: ImageFitMode | null;
  cover_position_x?: number | null;
  cover_position_y?: number | null;
  cover_zoom?: number | null;
  cover_overlay_opacity?: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  google_maps_url: string | null;
  bio: string | null;
  theme: BusinessCardTheme;
  template?: BusinessCardTemplate | null;
  primary_color: string;
  accent_color: string;
  is_published: boolean;
  featured_video_enabled?: boolean;
  featured_video_url?: string | null;
  featured_video_title?: string | null;
  booking_enabled?: boolean;
  booking_mode?: BusinessCardBookingMode | null;
  booking_url?: string | null;
  booking_label?: string | null;
  booking_provider?: string | null;
  booking_request_enabled?: boolean;
  booking_request_title?: string | null;
  booking_request_description?: string | null;
  booking_request_button_label?: string | null;
  lead_form_enabled?: boolean;
  lead_form_title?: string | null;
  lead_form_description?: string | null;
  lead_form_button_label?: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type BusinessCardLinkRecord = {
  id: string;
  business_card_id: string;
  label: string;
  url: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type BusinessCardOfferRecord = {
  id: string;
  business_card_id: string;
  title: string;
  description: string | null;
  claim_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  view_count: number;
  claim_count: number;
  created_at?: string;
  updated_at?: string;
};

export type BusinessCardGalleryRecord = {
  id: string;
  card_id: string;
  image_url: string;
  cloudflare_image_id?: string | null;
  fit?: ImageFitMode | null;
  position_x?: number | null;
  position_y?: number | null;
  zoom?: number | null;
  caption: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type BusinessCardBookingServiceRecord = {
  id: string;
  card_id: string;
  owner_id: string;
  service_id?: string | null;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price: number | string | null;
  currency: string | null;
  booking_url: string | null;
  service_is_active: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type BusinessCardFormLink = {
  id: string;
  label: string;
  url: string;
  sort_order: number;
  is_active: boolean;
};

export type BusinessCardFormOffer = {
  id: string;
  title: string;
  description: string;
  claim_url: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

export type BusinessCardFormGalleryItem = {
  id: string;
  image_url: string;
  cloudflare_image_id?: string | null;
  fit: ImageFitMode;
  position_x: number;
  position_y: number;
  zoom: number;
  caption: string;
  sort_order: number;
  is_active: boolean;
};

export type BusinessCardFormBookingService = {
  id: string;
  service_id?: string | null;
  name: string;
  description: string;
  duration_minutes: string;
  price: string;
  currency: string;
  booking_url: string;
  service_is_active: boolean;
  sort_order: number;
  is_active: boolean;
};

export type BusinessServiceRecord = {
  id: string;
  business_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price: number | string | null;
  currency: string | null;
  booking_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BusinessCardFormState = {
  business_name: string;
  slug: string;
  tagline: string;
  logo_url: string;
  logo_image_id: string;
  logo_fit: ImageFitMode;
  logo_position_x: number;
  logo_position_y: number;
  logo_zoom: number;
  cover_image_url: string;
  cover_image_id: string;
  cover_fit: ImageFitMode;
  cover_position_x: number;
  cover_position_y: number;
  cover_zoom: number;
  cover_overlay_opacity: number;
  phone: string;
  email: string;
  website: string;
  address: string;
  google_maps_url: string;
  bio: string;
  theme: BusinessCardTheme;
  template: BusinessCardTemplate;
  primary_color: string;
  accent_color: string;
  is_published: boolean;
  featured_video_enabled: boolean;
  featured_video_url: string;
  featured_video_title: string;
  booking_enabled: boolean;
  booking_mode: BusinessCardBookingMode;
  booking_url: string;
  booking_label: string;
  booking_provider: string;
  booking_request_enabled: boolean;
  booking_request_title: string;
  booking_request_description: string;
  booking_request_button_label: string;
  lead_form_enabled: boolean;
  lead_form_title: string;
  lead_form_description: string;
  lead_form_button_label: string;
  links: BusinessCardFormLink[];
  offers: BusinessCardFormOffer[];
  gallery: BusinessCardFormGalleryItem[];
};

export type SmartCardTemplateOption = {
  value: BusinessCardTemplate;
  label: string;
  description: string;
  treatment: 'dark' | 'light';
  colors: [string, string];
};

export const SMART_CARD_TEMPLATES: SmartCardTemplateOption[] = [
  { value: 'modern_glass', label: 'Modern Glass', description: 'Glass panels, glow accents, and bold local profile energy.', treatment: 'dark', colors: ['#B6FF00', '#14B8A6'] },
  { value: 'luxury', label: 'Luxury', description: 'Deep contrast, warm metallic accents, and editorial spacing.', treatment: 'dark', colors: ['#F5C542', '#8B5CF6'] },
  { value: 'restaurant', label: 'Restaurant', description: 'Appetizing warmth, offer-forward cards, and menu-friendly sections.', treatment: 'dark', colors: ['#FF6B35', '#FFD166'] },
  { value: 'home_services', label: 'Home Services', description: 'Trusty, bright, service-ready layout for quotes and calls.', treatment: 'light', colors: ['#2563EB', '#22C55E'] },
  { value: 'realtor', label: 'Realtor', description: 'Clean listing-card polish with confident premium gradients.', treatment: 'light', colors: ['#0F766E', '#D4AF37'] },
  { value: 'fitness', label: 'Fitness', description: 'High-energy visuals with punchy calls to action.', treatment: 'dark', colors: ['#A3E635', '#F97316'] },
  { value: 'automotive', label: 'Automotive', description: 'Strong contrast, sharp cards, and service-bay confidence.', treatment: 'dark', colors: ['#38BDF8', '#EF4444'] },
  { value: 'minimal', label: 'Minimal', description: 'Quiet, bright, and refined for simple professional profiles.', treatment: 'light', colors: ['#111827', '#64748B'] },
];

export const SMART_CARD_THEMES: Array<{ value: BusinessCardTheme; label: string; colors: [string, string] }> = [
  { value: 'market-pop', label: 'Market Pop', colors: ['#B6FF00', '#14B8A6'] },
  { value: 'neon-local', label: 'Neon Local', colors: ['#B6FF00', '#A855F7'] },
  { value: 'sunset-shop', label: 'Sunset Shop', colors: ['#FF6B35', '#FFD166'] },
  { value: 'fresh-service', label: 'Fresh Service', colors: ['#22C55E', '#38BDF8'] },
];

export const IMAGE_FIT_OPTIONS: Array<{ value: ImageFitMode; label: string }> = [
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'custom', label: 'Custom' },
];

export const DEFAULT_IMAGE_DISPLAY_PREFERENCES: ImageDisplayPreferences = {
  fit: 'cover',
  position_x: 50,
  position_y: 50,
  zoom: 1,
};

export const DEFAULT_SMART_CARD_FORM: BusinessCardFormState = {
  business_name: 'Bold City Coffee Bar',
  slug: 'bold-city-coffee-bar',
  tagline: 'Local coffee, fresh pastries, neighborhood energy.',
  logo_url: '',
  logo_image_id: '',
  logo_fit: 'cover',
  logo_position_x: 50,
  logo_position_y: 50,
  logo_zoom: 1,
  cover_image_url: '',
  cover_image_id: '',
  cover_fit: 'cover',
  cover_position_x: 50,
  cover_position_y: 50,
  cover_zoom: 1,
  cover_overlay_opacity: 90,
  phone: '(904) 555-0188',
  email: 'hello@boldcitycoffee.example',
  website: 'https://adpadz.co',
  address: '123 Main St, Jacksonville, FL',
  google_maps_url: 'https://maps.google.com/?q=123%20Main%20St%20Jacksonville%20FL',
  bio: 'A friendly neighborhood stop for morning meetings, after-school treats, and weekend pop-ups.',
  theme: 'market-pop',
  template: 'modern_glass',
  primary_color: '#B6FF00',
  accent_color: '#14B8A6',
  is_published: false,
  featured_video_enabled: false,
  featured_video_url: '',
  featured_video_title: 'Local Spotlight',
  booking_enabled: false,
  booking_mode: 'external',
  booking_url: '',
  booking_label: 'Book Now',
  booking_provider: '',
  booking_request_enabled: false,
  booking_request_title: 'Request an Appointment',
  booking_request_description: '',
  booking_request_button_label: 'Request Booking',
  lead_form_enabled: false,
  lead_form_title: 'Request Information',
  lead_form_description: '',
  lead_form_button_label: 'Send Request',
  links: [
    { id: 'draft-menu', label: 'View menu', url: 'https://adpadz.co', sort_order: 0, is_active: true },
    { id: 'draft-instagram', label: 'Instagram', url: 'https://adpadz.co', sort_order: 1, is_active: true },
  ],
  offers: [
    {
      id: 'draft-offer',
      title: 'Free pastry with any large coffee',
      description: 'Show this smart card in-store before 11 AM.',
      claim_url: '',
      starts_at: '',
      ends_at: '',
      is_active: true,
    },
  ],
  gallery: [],
};

export function createSmartCardSlug(name: string): string {
  return normalizeSlug(name) || `smart-card-${Date.now().toString(36)}`;
}

export function buildSmartCardUrl(slug: string, baseUrl = getPublicAppUrl()): string {
  return `${baseUrl.replace(/\/+$/g, '')}/c/${normalizeSlug(slug) || 'demo'}`;
}

export function getTemplateOption(value: BusinessCardTemplate | null | undefined): SmartCardTemplateOption {
  return SMART_CARD_TEMPLATES.find(template => template.value === value) ?? SMART_CARD_TEMPLATES[0];
}

export function normalizeImageFit(value: string | null | undefined): ImageFitMode {
  return value === 'contain' || value === 'custom' ? value : 'cover';
}

export function clampImagePosition(value: number | string | null | undefined): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.min(100, Math.max(0, numeric));
}

export function clampImageZoom(value: number | string | null | undefined): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(3, Math.max(0.5, numeric));
}

export function clampOverlayOpacity(value: number | string | null | undefined): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 90;
  return Math.min(100, Math.max(0, numeric));
}

export function getImageDisplayPreferences(preferences?: { fit?: ImageFitMode | null; position_x?: number | string | null; position_y?: number | string | null; zoom?: number | string | null } | null): ImageDisplayPreferences {
  return {
    fit: normalizeImageFit(preferences?.fit),
    position_x: clampImagePosition(preferences?.position_x),
    position_y: clampImagePosition(preferences?.position_y),
    zoom: clampImageZoom(preferences?.zoom),
  };
}

export function getImageDisplayStyle(preferences?: { fit?: ImageFitMode | null; position_x?: number | string | null; position_y?: number | string | null; zoom?: number | string | null } | null): {
  objectFit: 'cover' | 'contain';
  objectPosition: string;
  transform: string;
  transformOrigin: string;
} {
  const normalized = getImageDisplayPreferences(preferences);
  const objectPosition = `${normalized.position_x}% ${normalized.position_y}%`;
  const effectiveZoom = normalized.fit === 'cover' ? Math.max(normalized.zoom, 1.18) : normalized.zoom;

  return {
    objectFit: normalized.fit === 'cover' ? 'cover' : 'contain',
    objectPosition,
    transform: `scale(${effectiveZoom})`,
    transformOrigin: objectPosition,
  };
}

export function resetImageDisplayPreferences(): ImageDisplayPreferences {
  return { ...DEFAULT_IMAGE_DISPLAY_PREFERENCES };
}

export function getCoverOverlayStyle(opacityValue: number | string | null | undefined, lightMode = false): { background: string } {
  const opacity = clampOverlayOpacity(opacityValue) / 100;

  if (lightMode) {
    return {
      background: `linear-gradient(to top, rgba(255,255,255,${(opacity * 0.58).toFixed(3)}), rgba(255,255,255,${(opacity * 0.18).toFixed(3)}), rgba(255,255,255,0.02))`,
    };
  }

  return {
    background: `linear-gradient(to top, rgba(0,0,0,${opacity.toFixed(3)}), rgba(0,0,0,${(opacity * 0.42).toFixed(3)}), rgba(0,0,0,0.04))`,
  };
}

export function toBusinessCardForm(
  card: BusinessCardRecord,
  links: BusinessCardLinkRecord[],
  offers: BusinessCardOfferRecord[],
  gallery: BusinessCardGalleryRecord[] = [],
): BusinessCardFormState {
  return {
    business_name: card.business_name,
    slug: card.slug,
    tagline: card.tagline ?? '',
    logo_url: card.logo_url ?? '',
    logo_image_id: card.logo_image_id ?? '',
    logo_fit: normalizeImageFit(card.logo_fit),
    logo_position_x: clampImagePosition(card.logo_position_x),
    logo_position_y: clampImagePosition(card.logo_position_y),
    logo_zoom: clampImageZoom(card.logo_zoom),
    cover_image_url: card.cover_image_url ?? '',
    cover_image_id: card.cover_image_id ?? '',
    cover_fit: normalizeImageFit(card.cover_fit),
    cover_position_x: clampImagePosition(card.cover_position_x),
    cover_position_y: clampImagePosition(card.cover_position_y),
    cover_zoom: clampImageZoom(card.cover_zoom),
    cover_overlay_opacity: clampOverlayOpacity(card.cover_overlay_opacity),
    phone: card.phone ?? '',
    email: card.email ?? '',
    website: card.website ?? '',
    address: card.address ?? '',
    google_maps_url: card.google_maps_url ?? '',
    bio: card.bio ?? '',
    theme: card.theme,
    template: card.template ?? 'modern_glass',
    primary_color: normalizeHexColor(card.primary_color, DEFAULT_SMART_CARD_FORM.primary_color),
    accent_color: normalizeHexColor(card.accent_color, DEFAULT_SMART_CARD_FORM.accent_color),
    is_published: card.is_published,
    featured_video_enabled: card.featured_video_enabled ?? false,
    featured_video_url: card.featured_video_url ?? '',
    featured_video_title: card.featured_video_title ?? 'Local Spotlight',
    booking_enabled: card.booking_enabled ?? false,
    booking_mode: card.booking_mode === 'request' ? 'request' : 'external',
    booking_url: card.booking_url ?? '',
    booking_label: card.booking_label ?? 'Book Now',
    booking_provider: card.booking_provider ?? '',
    booking_request_enabled: card.booking_request_enabled ?? false,
    booking_request_title: card.booking_request_title ?? 'Request an Appointment',
    booking_request_description: card.booking_request_description ?? '',
    booking_request_button_label: card.booking_request_button_label ?? 'Request Booking',
    lead_form_enabled: card.lead_form_enabled ?? false,
    lead_form_title: card.lead_form_title ?? 'Request Information',
    lead_form_description: card.lead_form_description ?? '',
    lead_form_button_label: card.lead_form_button_label ?? 'Send Request',
    links: links.map(link => ({
      id: link.id,
      label: link.label,
      url: link.url,
      sort_order: link.sort_order,
      is_active: link.is_active,
    })),
    offers: offers.map(offer => ({
      id: offer.id,
      title: offer.title,
      description: offer.description ?? '',
      claim_url: offer.claim_url ?? '',
      starts_at: offer.starts_at ?? '',
      ends_at: offer.ends_at ?? '',
      is_active: offer.is_active,
    })),
    gallery: gallery.map(item => ({
      id: item.id,
      image_url: item.image_url,
      cloudflare_image_id: item.cloudflare_image_id ?? null,
      fit: normalizeImageFit(item.fit),
      position_x: clampImagePosition(item.position_x),
      position_y: clampImagePosition(item.position_y),
      zoom: clampImageZoom(item.zoom),
      caption: item.caption ?? '',
      sort_order: item.sort_order,
      is_active: item.is_active,
    })),
  };
}

export function normalizeOptionalUrl(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeHexColor(value: string | null | undefined, fallback: string): string {
  const trimmed = (value ?? '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return '#' + trimmed.toUpperCase();
  return fallback;
}

export function getCurrentOffer<T extends { starts_at: string | null; ends_at: string | null; is_active: boolean }>(offers: T[]): T | null {
  const now = Date.now();

  return offers.find(offer => {
    if (!offer.is_active) return false;
    const startsAt = offer.starts_at ? new Date(offer.starts_at).getTime() : null;
    const endsAt = offer.ends_at ? new Date(offer.ends_at).getTime() : null;
    return (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
  }) ?? null;
}

export type ProfileCompletionResult = {
  percentage: number;
  completed: string[];
  missing: string[];
};

export function calculateProfileCompletion(
  form: BusinessCardFormState,
  modules: {
    hasBrochure?: boolean;
    hasTestimonial?: boolean;
    hasBeforeAfter?: boolean;
    hasVirtualTour?: boolean;
  } = {},
): ProfileCompletionResult {
  const checks: Array<{ label: string; done: boolean }> = [
    { label: 'Logo', done: Boolean(form.logo_url.trim()) },
    { label: 'Cover image', done: Boolean(form.cover_image_url.trim()) },
    { label: 'Business name', done: Boolean(form.business_name.trim()) },
    { label: 'Phone or email', done: Boolean(form.phone.trim() || form.email.trim()) },
    { label: 'Active offer', done: Boolean(getCurrentOffer(form.offers)) },
    { label: 'Published', done: form.is_published },
    { label: 'Gallery', done: form.gallery.some(item => item.is_active && item.image_url.trim()) },
    { label: 'Video', done: Boolean(form.featured_video_enabled && form.featured_video_url.trim()) },
    { label: 'Booking', done: Boolean((form.booking_mode === 'external' && form.booking_enabled && form.booking_url.trim()) || (form.booking_mode === 'request' && form.booking_request_enabled)) },
    { label: 'Lead form', done: form.lead_form_enabled },
    { label: 'Brochure or menu', done: Boolean(modules.hasBrochure) },
    { label: 'Testimonial', done: Boolean(modules.hasTestimonial) },
    { label: 'Before/after', done: Boolean(modules.hasBeforeAfter) },
    { label: 'Virtual tour', done: Boolean(modules.hasVirtualTour) },
  ];
  const completed = checks.filter(check => check.done).map(check => check.label);
  const missing = checks.filter(check => !check.done).map(check => check.label);
  return {
    percentage: Math.round((completed.length / checks.length) * 100),
    completed,
    missing,
  };
}

export function formatOfferExpiration(value: string | null): string | null {
  if (!value) return null;

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export type MarketingAssetType =
  | 'image'
  | 'logo'
  | 'cover'
  | 'gallery'
  | 'video'
  | 'brochure'
  | 'menu'
  | 'virtual_tour'
  | 'before_after'
  | 'testimonial'
  | 'coupon'
  | 'document'
  | 'other';

export type BusinessMarketingAssetRecord = {
  id: string;
  business_id: string | null;
  smart_card_id: string | null;
  owner_id: string | null;
  asset_type: MarketingAssetType;
  title: string;
  description: string | null;
  file_url: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  provider: string | null;
  provider_asset_id: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessCardBeforeAfterRecord = {
  id: string;
  card_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  before_image_url: string;
  after_image_url: string;
  before_image_id: string | null;
  after_image_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BusinessCardTestimonialRecord = {
  id: string;
  card_id: string;
  owner_id: string;
  customer_name: string;
  rating: number | null;
  quote: string;
  image_url: string | null;
  video_url: string | null;
  source: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BusinessCardLeadRecord = {
  id: string;
  card_id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  lead_type: string;
  source: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export const SMART_CARD_PLAN_LIMITS = {
  free: {
    smartCards: 1,
    images: 2,
    videos: 0,
    documents: 0,
    leadForm: false,
    testimonials: false,
    beforeAfter: false,
    virtualTour: false,
    communityMailerConnection: false,
  },
  pro: {
    smartCards: 1,
    images: 10,
    videos: 1,
    documents: 3,
    leadForm: true,
    testimonials: true,
    beforeAfter: false,
    virtualTour: false,
    communityMailerConnection: false,
  },
  campaign: {
    smartCards: 1,
    images: 20,
    videos: 3,
    documents: 10,
    leadForm: true,
    testimonials: true,
    beforeAfter: true,
    virtualTour: true,
    communityMailerConnection: true,
  },
} as const;

export const DEFAULT_SMART_CARD_PLAN: keyof typeof SMART_CARD_PLAN_LIMITS = 'campaign';






