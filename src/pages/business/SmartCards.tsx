import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  BadgePercent,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  QrCode,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getCampaignFormatLabel, getCampaignSection, getCampaignTitle, normalizeCampaignOutput, SMART_CARD_CAMPAIGN_SECTIONS, type CampaignOutputRecord, type SmartCardCampaign } from '../../lib/ads';
import { SmartCardShell } from '../../components/smart-cards/SmartCardShell';
import {
  DEFAULT_SMART_CARD_IMAGE_LIMIT,
  uploadSmartCardImage,
  validateSmartCardImageFile,
  validateSmartCardImageLimit,
  type SmartCardImageType,
  type UploadProgress,
} from '../../lib/cloudflareImages';
import { buildShortUrl, createSlugFromTitle, formatDateTime, normalizeSlug, validateHttpUrl } from '../../lib/qr/qrUtils';
import {
  buildSmartCardUrl,
  calculateProfileCompletion,
  clampImagePosition,
  clampImageZoom,
  clampOverlayOpacity,
  createSmartCardSlug,
  DEFAULT_SMART_CARD_FORM,
  getCurrentOffer,
  getCoverOverlayStyle,
  getImageDisplayStyle,
  getTemplateOption,
  IMAGE_FIT_OPTIONS,
  normalizeHexColor,
  normalizeImageFit,
  normalizeOptionalUrl,
  resetImageDisplayPreferences,
  SMART_CARD_TEMPLATES,
  SMART_CARD_THEMES,
  toBusinessCardForm,
  type BusinessCardFormBookingService,
  type BusinessCardFormState,
  type BusinessCardGalleryRecord,
  type BusinessCardBookingServiceRecord,
  type BusinessMarketingAssetRecord,
  type BusinessCardBeforeAfterRecord,
  type BusinessCardTestimonialRecord,
  type BusinessCardLeadRecord,
  type BusinessCardLinkRecord,
  type BusinessCardOfferRecord,
  type BusinessCardRecord,
  type ImageDisplayPreferences,
} from '../../lib/smartCards';
type ConnectedQr = { id: string; slug: string; scan_count: number; updated_at: string | null };
type AnalyticsSummary = { views: number; qrScans: number; callClicks: number; websiteClicks: number; offerClaims: number; saveContacts: number };
const EMPTY_ANALYTICS: AnalyticsSummary = { views: 0, qrScans: 0, callClicks: 0, websiteClicks: 0, offerClaims: 0, saveContacts: 0 };

type MediaTab = 'images' | 'videos' | 'documents' | 'tours' | 'before_after' | 'testimonials';
type MarketingAssetDraft = {
  id: string;
  asset_type: 'video' | 'brochure' | 'menu' | 'document' | 'virtual_tour';
  title: string;
  description: string;
  file_url: string;
  external_url: string;
  thumbnail_url: string;
  provider: string;
  sort_order: number;
  is_active: boolean;
};
type BeforeAfterDraft = {
  id: string;
  title: string;
  description: string;
  before_image_url: string;
  after_image_url: string;
  before_image_id: string;
  after_image_id: string;
  is_active: boolean;
  sort_order: number;
};
type TestimonialDraft = {
  id: string;
  customer_name: string;
  rating: string;
  quote: string;
  image_url: string;
  video_url: string;
  source: string;
  is_active: boolean;
  sort_order: number;
};

type BookingServiceDraft = BusinessCardFormBookingService;

export default function SmartCards({ mode = 'list' }: { mode?: 'list' | 'new' | 'edit' }) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [cards, setCards] = useState<BusinessCardRecord[]>([]);
  const [form, setForm] = useState<BusinessCardFormState>(DEFAULT_SMART_CARD_FORM);
  const [selectedCard, setSelectedCard] = useState<BusinessCardRecord | null>(null);
  const [connectedQr, setConnectedQr] = useState<ConnectedQr | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary>(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress | null>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string | null>>({});
  const [activeMediaTab, setActiveMediaTab] = useState<MediaTab>('images');
  const [marketingAssets, setMarketingAssets] = useState<MarketingAssetDraft[]>([]);
  const [beforeAfterItems, setBeforeAfterItems] = useState<BeforeAfterDraft[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialDraft[]>([]);
  const [bookingServices, setBookingServices] = useState<BookingServiceDraft[]>([]);
  const [recentLeads, setRecentLeads] = useState<BusinessCardLeadRecord[]>([]);
  const [smartCardCampaigns, setSmartCardCampaigns] = useState<SmartCardCampaign[]>([]);

  const isBuilder = mode === 'new' || mode === 'edit';
  const publicUrl = useMemo(() => buildSmartCardUrl(form.slug), [form.slug]);
  const completion = useMemo(() => calculateProfileCompletion(form, {
    hasBrochure: marketingAssets.some(asset => asset.is_active && ['brochure', 'menu', 'document'].includes(asset.asset_type) && (asset.file_url.trim() || asset.external_url.trim())),
    hasTestimonial: testimonials.some(item => item.is_active && item.customer_name.trim() && item.quote.trim()),
    hasBeforeAfter: beforeAfterItems.some(item => item.is_active && item.before_image_url.trim() && item.after_image_url.trim()),
    hasVirtualTour: marketingAssets.some(asset => asset.is_active && asset.asset_type === 'virtual_tour' && (asset.file_url.trim() || asset.external_url.trim())),
  }), [beforeAfterItems, form, marketingAssets, testimonials]);

  useEffect(() => {
    if (isBuilder) {
      void loadBuilder();
    } else {
      void loadCards();
    }
  }, [id, isBuilder]);

  async function loadCards() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setError(authError?.message ?? 'Sign in before loading smart cards.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('business_cards')
      .select('*')
      .eq('owner_user_id', authData.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      setError(error.message);
      setCards([]);
    } else {
      setCards((data ?? []) as BusinessCardRecord[]);
    }

    setLoading(false);
  }

  async function loadBuilder() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setConnectedQr(null);
    setAnalytics(EMPTY_ANALYTICS);

    if (mode === 'new') {
      setSelectedCard(null);
      setBookingServices([]);
      setSmartCardCampaigns([]);
      setForm({
        ...DEFAULT_SMART_CARD_FORM,
        slug: createSmartCardSlug(DEFAULT_SMART_CARD_FORM.business_name),
        is_published: false,
      });
      setLoading(false);
      return;
    }

    if (!id) {
      setError('Missing smart card ID.');
      setLoading(false);
      return;
    }

    const { data: cardData, error: cardError } = await supabase
      .from('business_cards')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (cardError || !cardData) {
      setError(cardError?.message ?? 'Smart card not found.');
      setLoading(false);
      return;
    }

    const card = cardData as BusinessCardRecord;
    const [{ data: linkData }, { data: offerData }, { data: galleryData }, { data: qrData }, { data: eventData }, { data: assetData }, { data: beforeAfterData }, { data: testimonialData }, { data: leadData }, { data: bookingServiceData }, { data: attachedAdData }] = await Promise.all([
      supabase
        .from('business_card_links')
        .select('*')
        .eq('business_card_id', card.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('business_card_offers')
        .select('*')
        .eq('business_card_id', card.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('business_card_gallery_items')
        .select('*')
        .eq('card_id', card.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('qr_links')
        .select('id,slug,scan_count,updated_at')
        .eq('destination_type', 'business_card')
        .eq('destination_id', card.id)
        .maybeSingle(),
      supabase
        .from('business_card_events')
        .select('event_type')
        .eq('business_card_id', card.id),
      supabase
        .from('business_marketing_assets')
        .select('*')
        .eq('smart_card_id', card.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('business_card_before_after_items')
        .select('*')
        .eq('card_id', card.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('business_card_testimonials')
        .select('*')
        .eq('card_id', card.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('business_card_leads')
        .select('*')
        .eq('card_id', card.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('business_card_booking_services')
        .select('*')
        .eq('card_id', card.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('campaign_outputs')
        .select('campaign_id,output_type,enabled,sort_order,metadata,created_at,updated_at,campaigns(*)')
        .eq('output_type', 'smart_card')
        .contains('metadata', { smart_card_id: card.id })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false }),
    ]);

    const summary = ((eventData ?? []) as Array<{ event_type: string }>).reduce<AnalyticsSummary>((acc, event) => {
      if (event.event_type === 'card_view') acc.views += 1;
      if (event.event_type === 'qr_scan') acc.qrScans += 1;
      if (event.event_type === 'call_click') acc.callClicks += 1;
      if (event.event_type === 'website_click') acc.websiteClicks += 1;
      if (event.event_type === 'offer_claim') acc.offerClaims += 1;
      if (event.event_type === 'save_contact') acc.saveContacts += 1;
      return acc;
    }, { ...EMPTY_ANALYTICS });

    setSelectedCard(card);
    setConnectedQr((qrData as ConnectedQr | null) ?? null);
    setAnalytics(summary);
    setMarketingAssets(((assetData ?? []) as BusinessMarketingAssetRecord[]).map(asset => ({
      id: asset.id,
      asset_type: asset.asset_type as MarketingAssetDraft['asset_type'],
      title: asset.title,
      description: asset.description ?? '',
      file_url: asset.file_url ?? '',
      external_url: asset.external_url ?? '',
      thumbnail_url: asset.thumbnail_url ?? '',
      provider: asset.provider ?? '',
      sort_order: asset.sort_order,
      is_active: asset.is_active,
    })).filter(asset => ['video', 'brochure', 'menu', 'document', 'virtual_tour'].includes(asset.asset_type)));
    setBeforeAfterItems(((beforeAfterData ?? []) as BusinessCardBeforeAfterRecord[]).map(item => ({
      id: item.id,
      title: item.title,
      description: item.description ?? '',
      before_image_url: item.before_image_url,
      after_image_url: item.after_image_url,
      before_image_id: item.before_image_id ?? '',
      after_image_id: item.after_image_id ?? '',
      is_active: item.is_active,
      sort_order: item.sort_order,
    })));
    setTestimonials(((testimonialData ?? []) as BusinessCardTestimonialRecord[]).map(item => ({
      id: item.id,
      customer_name: item.customer_name,
      rating: item.rating ? String(item.rating) : '',
      quote: item.quote,
      image_url: item.image_url ?? '',
      video_url: item.video_url ?? '',
      source: item.source ?? '',
      is_active: item.is_active,
      sort_order: item.sort_order,
    })));
    setRecentLeads((leadData ?? []) as BusinessCardLeadRecord[]);
    setSmartCardCampaigns(((attachedAdData ?? []) as CampaignOutputRecord[])
      .map(output => normalizeCampaignOutput(output))
      .filter((output): output is SmartCardCampaign => Boolean(output))); 
    setBookingServices(((bookingServiceData ?? []) as BusinessCardBookingServiceRecord[]).map(service => ({
      id: service.id,
      name: service.name,
      description: service.description ?? '',
      duration_minutes: service.duration_minutes ? String(service.duration_minutes) : '',
      sort_order: service.sort_order,
      is_active: service.is_active,
    })));
    setForm(toBusinessCardForm(
      card,
      (linkData ?? []) as BusinessCardLinkRecord[],
      (offerData ?? []) as BusinessCardOfferRecord[],
      (galleryData ?? []) as BusinessCardGalleryRecord[],
    ));
    setLoading(false);
  }

  function updateField<K extends keyof BusinessCardFormState>(key: K, value: BusinessCardFormState[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }


  async function togglePublished() {
    const nextPublished = !form.is_published;
    setError(null);
    setMessage(null);

    if (!selectedCard) {
      setForm(current => ({ ...current, is_published: nextPublished }));
      setMessage(nextPublished ? 'Publish selected. Click Save to create and publish this Smart Card.' : 'Publish removed. Click Save to keep it unpublished.');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from('business_cards')
      .update({ is_published: nextPublished })
      .eq('id', selectedCard.id)
      .select()
      .single();

    if (error || !data) {
      setError(error?.message ?? 'Could not update publish status.');
      setSaving(false);
      return;
    }

    const updatedCard = data as BusinessCardRecord;
    setSelectedCard(updatedCard);
    setCards(current => current.map(card => (card.id === updatedCard.id ? updatedCard : card)));
    setForm(current => ({ ...current, is_published: updatedCard.is_published }));
    setMessage(updatedCard.is_published ? 'Smart Card published.' : 'Smart Card unpublished.');
    setSaving(false);
  }

  function updateName(name: string) {
    setForm(current => ({
      ...current,
      business_name: name,
      slug: selectedCard ? current.slug : createSlugFromTitle(name),
    }));
  }

  function setTheme(themeValue: BusinessCardFormState['theme']) {
    const theme = SMART_CARD_THEMES.find(item => item.value === themeValue);
    setForm(current => ({
      ...current,
      theme: themeValue,
      primary_color: theme?.colors[0] ?? current.primary_color,
      accent_color: theme?.colors[1] ?? current.accent_color,
    }));
  }

  function setTemplate(templateValue: BusinessCardFormState['template']) {
    const template = getTemplateOption(templateValue);
    setForm(current => ({
      ...current,
      template: templateValue,
      primary_color: template.colors[0],
      accent_color: template.colors[1],
    }));
  }

  function updateLink(index: number, key: 'label' | 'url' | 'is_active', value: string | boolean) {
    setForm(current => ({
      ...current,
      links: current.links.map((link, linkIndex) => (linkIndex === index ? { ...link, [key]: value } : link)),
    }));
  }

  function updateOffer(index: number, key: 'title' | 'description' | 'claim_url' | 'is_active', value: string | boolean) {
    setForm(current => ({
      ...current,
      offers: current.offers.map((offer, offerIndex) => (offerIndex === index ? { ...offer, [key]: value } : offer)),
    }));
  }

  function updateGallery(index: number, key: 'image_url' | 'caption' | 'is_active' | 'fit' | 'position_x' | 'position_y' | 'zoom', value: string | boolean | number) {
    setForm(current => ({
      ...current,
      gallery: current.gallery.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    }));
  }

  function updateMarketingAsset(index: number, key: keyof MarketingAssetDraft, value: string | boolean | number) {
    setMarketingAssets(current => current.map((asset, assetIndex) => (assetIndex === index ? { ...asset, [key]: value } : asset)));
  }

  function updateBeforeAfter(index: number, key: keyof BeforeAfterDraft, value: string | boolean | number) {
    setBeforeAfterItems(current => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  function updateTestimonial(index: number, key: keyof TestimonialDraft, value: string | boolean | number) {
    setTestimonials(current => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  function updateBookingService(index: number, key: keyof BookingServiceDraft, value: string | boolean | number) {
    setBookingServices(current => current.map((service, serviceIndex) => (serviceIndex === index ? { ...service, [key]: value } : service)));
  }

  function getImageCount(nextForm = form): number {
    const logoCount = nextForm.logo_url.trim() ? 1 : 0;
    const coverCount = nextForm.cover_image_url.trim() ? 1 : 0;
    const galleryCount = nextForm.gallery.filter(item => item.is_active && item.image_url.trim()).length;
    return logoCount + coverCount + galleryCount;
  }

  function buildCardPayload(options: { forceDraft?: boolean } = {}) {
    const slug = normalizeSlug(form.slug);
    if (!slug) return null;

    return {
      business_name: form.business_name.trim() || 'Untitled business',
      slug,
      tagline: form.tagline.trim() || null,
      logo_url: normalizeOptionalUrl(form.logo_url),
      logo_image_id: form.logo_image_id.trim() || null,
      logo_fit: normalizeImageFit(form.logo_fit),
      logo_position_x: clampImagePosition(form.logo_position_x),
      logo_position_y: clampImagePosition(form.logo_position_y),
      logo_zoom: clampImageZoom(form.logo_zoom),
      cover_image_url: normalizeOptionalUrl(form.cover_image_url),
      cover_image_id: form.cover_image_id.trim() || null,
      cover_fit: normalizeImageFit(form.cover_fit),
      cover_position_x: clampImagePosition(form.cover_position_x),
      cover_position_y: clampImagePosition(form.cover_position_y),
      cover_zoom: clampImageZoom(form.cover_zoom),
      cover_overlay_opacity: clampOverlayOpacity(form.cover_overlay_opacity),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      website: normalizeOptionalUrl(form.website),
      address: form.address.trim() || null,
      google_maps_url: normalizeOptionalUrl(form.google_maps_url),
      bio: form.bio.trim() || null,
      theme: form.theme,
      template: form.template,
      primary_color: normalizeHexColor(form.primary_color, DEFAULT_SMART_CARD_FORM.primary_color),
      accent_color: normalizeHexColor(form.accent_color, DEFAULT_SMART_CARD_FORM.accent_color),
      is_published: options.forceDraft ? false : form.is_published,
      featured_video_enabled: form.featured_video_enabled,
      featured_video_url: normalizeOptionalUrl(form.featured_video_url),
      featured_video_title: form.featured_video_title.trim() || 'Local Spotlight',
      booking_enabled: form.booking_enabled,
      booking_mode: form.booking_mode,
      booking_url: normalizeOptionalUrl(form.booking_url),
      booking_label: form.booking_label.trim() || 'Book Now',
      booking_provider: form.booking_provider.trim() || null,
      booking_request_enabled: form.booking_request_enabled,
      booking_request_title: form.booking_request_title.trim() || 'Request an Appointment',
      booking_request_description: form.booking_request_description.trim() || null,
      booking_request_button_label: form.booking_request_button_label.trim() || 'Request Booking',
      lead_form_enabled: form.lead_form_enabled,
      lead_form_title: form.lead_form_title.trim() || 'Request Information',
      lead_form_description: form.lead_form_description.trim() || null,
      lead_form_button_label: form.lead_form_button_label.trim() || 'Send Request',
    };
  }

  async function ensureCardForUpload(): Promise<BusinessCardRecord | null> {
    if (selectedCard) return selectedCard;

    const payload = buildCardPayload({ forceDraft: true });
    if (!payload) {
      setError('Add a public slug before uploading images.');
      return null;
    }

    setSaving(true);
    setMessage('Saving a draft Smart Card so the image can be attached...');

    const { data, error } = await supabase.from('business_cards').insert(payload).select().single();
    setSaving(false);

    if (error || !data) {
      setError(error?.message ?? 'Could not create a draft Smart Card for upload.');
      return null;
    }

    const savedCard = data as BusinessCardRecord;
    setSelectedCard(savedCard);
    setForm(current => ({ ...current, slug: savedCard.slug, is_published: savedCard.is_published }));
    if (mode === 'new') {
      navigate(`/app/business/smart-cards/${savedCard.id}/edit`, { replace: true });
    }
    return savedCard;
  }
  async function handleImageUpload(imageType: SmartCardImageType, file: File | null, galleryIndex?: number) {
    if (!file) return;


    const fileError = validateSmartCardImageFile(file, imageType);
    if (fileError) {
      setError(fileError);
      return;
    }

    const isReplacing = imageType === 'logo'
      ? Boolean(form.logo_url.trim())
      : imageType === 'cover'
        ? Boolean(form.cover_image_url.trim())
        : typeof galleryIndex === 'number' && Boolean(form.gallery[galleryIndex]?.image_url.trim());
    const limitError = validateSmartCardImageLimit(getImageCount() - (isReplacing ? 1 : 0));
    if (limitError) {
      setError(limitError);
      return;
    }

    const progressKey = imageType === 'gallery' ? `gallery-${galleryIndex ?? form.gallery.length}` : imageType;
    setError(null);
    setUploadErrors(current => ({ ...current, [progressKey]: null }));
    setUploadProgress(current => ({ ...current, [progressKey]: { percentage: 1, label: 'Preparing upload' } }));

    try {
      const uploadCard = await ensureCardForUpload();
      if (!uploadCard) return;

      const result = await uploadSmartCardImage({
        file,
        cardId: uploadCard.id,
        imageType,
        onProgress: progress => setUploadProgress(current => ({ ...current, [progressKey]: progress })),
      });

      if (imageType === 'logo') {
        setForm(current => ({ ...current, logo_url: result.imageUrl, logo_image_id: result.imageId, logo_fit: 'cover', logo_position_x: 50, logo_position_y: 50, logo_zoom: 1 }));
      } else if (imageType === 'cover') {
        setForm(current => ({ ...current, cover_image_url: result.imageUrl, cover_image_id: result.imageId, cover_fit: 'cover', cover_position_x: 50, cover_position_y: 50, cover_zoom: 1, cover_overlay_opacity: 90 }));
      } else {
        setForm(current => {
          const index = typeof galleryIndex === 'number' ? galleryIndex : current.gallery.length;
          const nextGallery = [...current.gallery];
          nextGallery[index] = {
            id: nextGallery[index]?.id ?? `draft-${Date.now()}`,
            image_url: result.imageUrl,
            cloudflare_image_id: result.imageId,
            fit: 'cover',
            position_x: 50,
            position_y: 50,
            zoom: 1,
            caption: nextGallery[index]?.caption ?? '',
            sort_order: index,
            is_active: true,
          };
          return { ...current, gallery: nextGallery };
        });
      }

      setMessage('Image uploaded to Cloudflare Images. Save the Smart Card to keep this change.');
    } catch (uploadError) {
      const uploadMessage = uploadError instanceof Error ? uploadError.message : 'Image upload failed.';
      setError(uploadMessage);
      setUploadErrors(current => ({ ...current, [progressKey]: uploadMessage }));
    } finally {
      window.setTimeout(() => {
        setUploadProgress(current => ({ ...current, [progressKey]: null }));
      }, 900);
    }
  }

  function removeUploadedImage(imageType: SmartCardImageType, galleryIndex?: number) {
    if (imageType === 'logo') {
      setForm(current => ({ ...current, logo_url: '', logo_image_id: '', logo_fit: 'cover', logo_position_x: 50, logo_position_y: 50, logo_zoom: 1 }));
    } else if (imageType === 'cover') {
      setForm(current => ({ ...current, cover_image_url: '', cover_image_id: '', cover_fit: 'cover', cover_position_x: 50, cover_position_y: 50, cover_zoom: 1, cover_overlay_opacity: 90 }));
    } else if (typeof galleryIndex === 'number') {
      setForm(current => ({ ...current, gallery: current.gallery.filter((_, itemIndex) => itemIndex !== galleryIndex) }));
    }
  }

  async function saveCard() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error(authError?.message ?? 'Sign in before saving this Smart Card.');
      }

      const slug = normalizeSlug(form.slug);
      if (!slug) {
        throw new Error('Add a public slug before saving.');
      }

      const urlFields = [
        ['Website', form.website],
        ['Google Maps URL', form.google_maps_url],
        ['Logo URL', form.logo_url],
        ['Cover image URL', form.cover_image_url],
        ['Featured video URL', form.featured_video_url],
        ['Booking URL', form.booking_url],
        ...form.gallery.map((item, index) => [`Gallery image ${index + 1}`, item.image_url] as [string, string]),
        ...marketingAssets.flatMap((asset, index) => [
          [`Media asset ${index + 1} file URL`, asset.file_url] as [string, string],
          [`Media asset ${index + 1} external URL`, asset.external_url] as [string, string],
          [`Media asset ${index + 1} thumbnail URL`, asset.thumbnail_url] as [string, string],
        ]),
        ...beforeAfterItems.flatMap((item, index) => [
          [`Before image ${index + 1}`, item.before_image_url] as [string, string],
          [`After image ${index + 1}`, item.after_image_url] as [string, string],
        ]),
        ...testimonials.flatMap((item, index) => [
          [`Testimonial image ${index + 1}`, item.image_url] as [string, string],
          [`Testimonial video ${index + 1}`, item.video_url] as [string, string],
        ]),
      ];

      const invalidUrl = urlFields.find(([, value]) => typeof value === 'string' && value.trim() && !validateHttpUrl(value));
      if (invalidUrl) {
        throw new Error(`${invalidUrl[0]} must start with http:// or https://.`);
      }

      const invalidLink = form.links.find(link => link.label.trim() && link.url.trim() && !validateHttpUrl(link.url));
      if (invalidLink) {
        throw new Error(`The "${invalidLink.label}" link must start with http:// or https://.`);
      }

      const invalidOfferUrl = form.offers.find(offer => offer.claim_url.trim() && !validateHttpUrl(offer.claim_url));
      if (invalidOfferUrl) {
        throw new Error(`The "${invalidOfferUrl.title || 'offer'}" claim URL must start with http:// or https://.`);
      }

      const payload = buildCardPayload();
      if (!payload) {
        throw new Error('Add a public slug before saving.');
      }

      const cardPayload = { ...payload, owner_user_id: authData.user.id };
      const cardResult = selectedCard
        ? await supabase.from('business_cards').update(cardPayload).eq('id', selectedCard.id).select().single()
        : await supabase.from('business_cards').insert(cardPayload).select().single();

      if (cardResult.error || !cardResult.data) {
        throw new Error(cardResult.error?.message ?? 'Could not save smart card.');
      }

      const savedCard = cardResult.data as BusinessCardRecord;
      const activeLinks = form.links
        .map((link, index) => ({ ...link, sort_order: index }))
        .filter(link => link.label.trim() && link.url.trim());
      const activeOffers = form.offers.filter(offer => offer.title.trim());
      const activeGallery = form.gallery
        .map((item, index) => ({ ...item, sort_order: index }))
        .filter(item => item.image_url.trim());
      const activeBookingServices = bookingServices
        .map((service, index) => ({ ...service, sort_order: index }))
        .filter(service => service.name.trim());
      const activeAssets = marketingAssets
        .map((asset, index) => ({ ...asset, sort_order: index }))
        .filter(asset => asset.title.trim() && (asset.file_url.trim() || asset.external_url.trim()));
      const activeBeforeAfter = beforeAfterItems
        .map((item, index) => ({ ...item, sort_order: index }))
        .filter(item => item.title.trim() && item.before_image_url.trim() && item.after_image_url.trim());
      const activeTestimonials = testimonials
        .map((item, index) => ({ ...item, sort_order: index }))
        .filter(item => item.customer_name.trim() && item.quote.trim());

      const failOnError = (error: { message: string } | null | undefined, label: string) => {
        if (error) throw new Error(`${label}: ${error.message}`);
      };

      const { error: linksDeleteError } = await supabase.from('business_card_links').delete().eq('business_card_id', savedCard.id);
      failOnError(linksDeleteError, 'Could not replace smart card links');
      if (activeLinks.length > 0) {
        const { error: linkError } = await supabase.from('business_card_links').insert(
          activeLinks.map(link => ({
            business_card_id: savedCard.id,
            label: link.label.trim(),
            url: link.url.trim(),
            sort_order: link.sort_order,
            is_active: link.is_active,
          })),
        );
        failOnError(linkError, 'Could not save smart card links');
      }

      const { error: offersDeleteError } = await supabase.from('business_card_offers').delete().eq('business_card_id', savedCard.id);
      failOnError(offersDeleteError, 'Could not replace smart card offers');
      if (activeOffers.length > 0) {
        const { error: offerError } = await supabase.from('business_card_offers').insert(
          activeOffers.map(offer => ({
            business_card_id: savedCard.id,
            title: offer.title.trim(),
            description: offer.description.trim() || null,
            claim_url: normalizeOptionalUrl(offer.claim_url),
            starts_at: offer.starts_at || null,
            ends_at: offer.ends_at || null,
            is_active: offer.is_active,
          })),
        );
        failOnError(offerError, 'Could not save smart card offers');
      }

      const { error: galleryDeleteError } = await supabase.from('business_card_gallery_items').delete().eq('card_id', savedCard.id);
      failOnError(galleryDeleteError, 'Could not replace smart card gallery');
      if (activeGallery.length > 0) {
        const { error: galleryError } = await supabase.from('business_card_gallery_items').insert(
          activeGallery.map(item => ({
            card_id: savedCard.id,
            image_url: item.image_url.trim(),
            cloudflare_image_id: item.cloudflare_image_id || null,
            fit: normalizeImageFit(item.fit),
            position_x: clampImagePosition(item.position_x),
            position_y: clampImagePosition(item.position_y),
            zoom: clampImageZoom(item.zoom),
            caption: item.caption.trim() || null,
            sort_order: item.sort_order,
            is_active: item.is_active,
          })),
        );
        failOnError(galleryError, 'Could not save smart card gallery');
      }

      const { error: bookingServicesDeleteError } = await supabase.from('business_card_booking_services').delete().eq('card_id', savedCard.id);
      failOnError(bookingServicesDeleteError, 'Could not replace booking services');
      if (activeBookingServices.length > 0) {
        const { error: bookingServiceError } = await supabase.from('business_card_booking_services').insert(
          activeBookingServices.map(service => ({
            card_id: savedCard.id,
            owner_id: authData.user.id,
            name: service.name.trim(),
            description: service.description.trim() || null,
            duration_minutes: service.duration_minutes.trim() ? Number(service.duration_minutes) : null,
            sort_order: service.sort_order,
            is_active: service.is_active,
          })),
        );
        failOnError(bookingServiceError, 'Could not save booking services');
      }

      const { error: assetsDeleteError } = await supabase.from('business_marketing_assets').delete().eq('smart_card_id', savedCard.id);
      failOnError(assetsDeleteError, 'Could not replace marketing assets');
      if (activeAssets.length > 0) {
        const { error: assetError } = await supabase.from('business_marketing_assets').insert(
          activeAssets.map(asset => ({
            smart_card_id: savedCard.id,
            owner_id: authData.user.id,
            asset_type: asset.asset_type,
            title: asset.title.trim(),
            description: asset.description.trim() || null,
            file_url: normalizeOptionalUrl(asset.file_url),
            external_url: normalizeOptionalUrl(asset.external_url),
            thumbnail_url: normalizeOptionalUrl(asset.thumbnail_url),
            provider: asset.provider.trim() || null,
            sort_order: asset.sort_order,
            is_active: asset.is_active,
          })),
        );
        failOnError(assetError, 'Could not save marketing assets');
      }

      const { error: beforeAfterDeleteError } = await supabase.from('business_card_before_after_items').delete().eq('card_id', savedCard.id);
      failOnError(beforeAfterDeleteError, 'Could not replace before/after items');
      if (activeBeforeAfter.length > 0) {
        const { error: beforeAfterError } = await supabase.from('business_card_before_after_items').insert(
          activeBeforeAfter.map(item => ({
            card_id: savedCard.id,
            owner_id: authData.user.id,
            title: item.title.trim(),
            description: item.description.trim() || null,
            before_image_url: item.before_image_url.trim(),
            after_image_url: item.after_image_url.trim(),
            before_image_id: item.before_image_id.trim() || null,
            after_image_id: item.after_image_id.trim() || null,
            sort_order: item.sort_order,
            is_active: item.is_active,
          })),
        );
        failOnError(beforeAfterError, 'Could not save before/after items');
      }

      const { error: testimonialsDeleteError } = await supabase.from('business_card_testimonials').delete().eq('card_id', savedCard.id);
      failOnError(testimonialsDeleteError, 'Could not replace testimonials');
      if (activeTestimonials.length > 0) {
        const { error: testimonialError } = await supabase.from('business_card_testimonials').insert(
          activeTestimonials.map(item => ({
            card_id: savedCard.id,
            owner_id: authData.user.id,
            customer_name: item.customer_name.trim(),
            rating: item.rating ? Number(item.rating) : null,
            quote: item.quote.trim(),
            image_url: normalizeOptionalUrl(item.image_url),
            video_url: normalizeOptionalUrl(item.video_url),
            source: item.source.trim() || null,
            sort_order: item.sort_order,
            is_active: item.is_active,
          })),
        );
        failOnError(testimonialError, 'Could not save testimonials');
      }

      const [
        freshCardResult,
        freshLinksResult,
        freshOffersResult,
        freshGalleryResult,
        freshQrResult,
        freshEventsResult,
        freshAssetsResult,
        freshBeforeAfterResult,
        freshTestimonialsResult,
        freshLeadsResult,
        freshBookingServicesResult,
      ] = await Promise.all([
        supabase.from('business_cards').select('*').eq('id', savedCard.id).single(),
        supabase.from('business_card_links').select('*').eq('business_card_id', savedCard.id).order('sort_order', { ascending: true }),
        supabase.from('business_card_offers').select('*').eq('business_card_id', savedCard.id).order('created_at', { ascending: false }),
        supabase.from('business_card_gallery_items').select('*').eq('card_id', savedCard.id).order('sort_order', { ascending: true }),
        supabase.from('qr_links').select('id,slug,scan_count,updated_at').eq('destination_type', 'business_card').eq('destination_id', savedCard.id).maybeSingle(),
        supabase.from('business_card_events').select('event_type').eq('business_card_id', savedCard.id),
        supabase.from('business_marketing_assets').select('*').eq('smart_card_id', savedCard.id).order('sort_order', { ascending: true }),
        supabase.from('business_card_before_after_items').select('*').eq('card_id', savedCard.id).order('sort_order', { ascending: true }),
        supabase.from('business_card_testimonials').select('*').eq('card_id', savedCard.id).order('sort_order', { ascending: true }),
        supabase.from('business_card_leads').select('*').eq('card_id', savedCard.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('business_card_booking_services').select('*').eq('card_id', savedCard.id).order('sort_order', { ascending: true }),
      ]);

      failOnError(freshCardResult.error, 'Could not reload saved smart card');
      failOnError(freshLinksResult.error, 'Could not reload saved links');
      failOnError(freshOffersResult.error, 'Could not reload saved offers');
      failOnError(freshGalleryResult.error, 'Could not reload saved gallery');
      failOnError(freshQrResult.error, 'Could not reload connected QR');
      failOnError(freshEventsResult.error, 'Could not reload analytics');
      failOnError(freshAssetsResult.error, 'Could not reload marketing assets');
      failOnError(freshBeforeAfterResult.error, 'Could not reload before/after items');
      failOnError(freshTestimonialsResult.error, 'Could not reload testimonials');
      failOnError(freshLeadsResult.error, 'Could not reload recent leads');
      failOnError(freshBookingServicesResult.error, 'Could not reload booking services');

      const freshCard = freshCardResult.data as BusinessCardRecord;
      const freshEventData = (freshEventsResult.data ?? []) as Array<{ event_type: string }>;
      const summary = freshEventData.reduce<AnalyticsSummary>((acc, event) => {
        if (event.event_type === 'card_view') acc.views += 1;
        if (event.event_type === 'qr_scan') acc.qrScans += 1;
        if (event.event_type === 'call_click') acc.callClicks += 1;
        if (event.event_type === 'website_click') acc.websiteClicks += 1;
        if (event.event_type === 'offer_claim') acc.offerClaims += 1;
        if (event.event_type === 'save_contact') acc.saveContacts += 1;
        return acc;
      }, { ...EMPTY_ANALYTICS });

      const freshAssets = (freshAssetsResult.data ?? []) as BusinessMarketingAssetRecord[];
      const freshBeforeAfter = (freshBeforeAfterResult.data ?? []) as BusinessCardBeforeAfterRecord[];
      const freshTestimonials = (freshTestimonialsResult.data ?? []) as BusinessCardTestimonialRecord[];
      const freshBookingServices = (freshBookingServicesResult.data ?? []) as BusinessCardBookingServiceRecord[];

      setSelectedCard(freshCard);
      setConnectedQr((freshQrResult.data as ConnectedQr | null) ?? null);
      setAnalytics(summary);
      setMarketingAssets(freshAssets.map(asset => ({
        id: asset.id,
        asset_type: asset.asset_type as MarketingAssetDraft['asset_type'],
        title: asset.title,
        description: asset.description ?? '',
        file_url: asset.file_url ?? '',
        external_url: asset.external_url ?? '',
        thumbnail_url: asset.thumbnail_url ?? '',
        provider: asset.provider ?? '',
        sort_order: asset.sort_order,
        is_active: asset.is_active,
      })).filter(asset => ['video', 'brochure', 'menu', 'document', 'virtual_tour'].includes(asset.asset_type)));
      setBeforeAfterItems(freshBeforeAfter.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description ?? '',
        before_image_url: item.before_image_url,
        after_image_url: item.after_image_url,
        before_image_id: item.before_image_id ?? '',
        after_image_id: item.after_image_id ?? '',
        is_active: item.is_active,
        sort_order: item.sort_order,
      })));
      setTestimonials(freshTestimonials.map(item => ({
        id: item.id,
        customer_name: item.customer_name,
        rating: item.rating ? String(item.rating) : '',
        quote: item.quote,
        image_url: item.image_url ?? '',
        video_url: item.video_url ?? '',
        source: item.source ?? '',
        is_active: item.is_active,
        sort_order: item.sort_order,
      })));
      setRecentLeads((freshLeadsResult.data ?? []) as BusinessCardLeadRecord[]);
      setBookingServices(freshBookingServices.map(service => ({
        id: service.id,
        name: service.name,
        description: service.description ?? '',
        duration_minutes: service.duration_minutes ? String(service.duration_minutes) : '',
        sort_order: service.sort_order,
        is_active: service.is_active,
      })));
      setForm(toBusinessCardForm(
        freshCard,
        (freshLinksResult.data ?? []) as BusinessCardLinkRecord[],
        (freshOffersResult.data ?? []) as BusinessCardOfferRecord[],
        (freshGalleryResult.data ?? []) as BusinessCardGalleryRecord[],
      ));
      setMessage(freshCard.is_published ? 'Smart card saved and published.' : 'Smart card saved as unpublished.');

      if (mode === 'new') {
        navigate(`/app/business/smart-cards/${freshCard.id}/edit`, { replace: true });
      }
    } catch (saveError) {
      if (import.meta.env.DEV) {
        console.error('[SmartCards] save failed', saveError);
      }
      setError(saveError instanceof Error ? saveError.message : 'Could not save Smart Card.');
    } finally {
      setSaving(false);
    }
  }

  async function updateCampaignOutput(output: SmartCardCampaign, updates: { enabled?: boolean; section?: string; sort_order?: number }) {
    if (!selectedCard) {
      setError('Save the smart card before managing campaigns.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const nextMetadata = {
        ...output.metadata,
        smart_card_id: selectedCard.id,
        section: updates.section ?? getCampaignSection(output),
      };
      const payload = {
        enabled: updates.enabled ?? output.enabled,
        sort_order: updates.sort_order ?? output.sort_order,
        metadata: nextMetadata,
      };

      const { data, error: updateError } = await supabase
        .from('campaign_outputs')
        .update(payload)
        .eq('campaign_id', output.campaign_id)
        .eq('output_type', 'smart_card')
        .select('campaign_id,output_type,enabled,sort_order,metadata,created_at,updated_at,campaigns(*)')
        .single();

      if (updateError || !data) {
        throw new Error(updateError?.message ?? 'Could not update campaign output.');
      }

      const savedOutput = normalizeCampaignOutput(data as CampaignOutputRecord);
      if (!savedOutput) {
        throw new Error('Campaign output saved, but the campaign could not be reloaded.');
      }

      setSmartCardCampaigns(current => current
        .map(item => (item.campaign_id === savedOutput.campaign_id ? savedOutput : item))
        .sort((a, b) => a.sort_order - b.sort_order));
      setMessage('Campaign output updated.');
    } catch (updateError) {
      if (import.meta.env.DEV) {
        console.error('[SmartCards] campaign output update failed', updateError);
      }
      setError(updateError instanceof Error ? updateError.message : 'Could not update campaign output.');
    } finally {
      setSaving(false);
    }
  }
  async function copyPublicLink() {
    if (!form.is_published) {
      setError('Publish the Smart Card before copying its public link.');
      return;
    }
    await navigator.clipboard.writeText(publicUrl);
    setMessage('Public smart card link copied.');
  }

  async function copyQrLink() {
    if (!connectedQr) return;
    await navigator.clipboard.writeText(buildShortUrl(connectedQr.slug));
    setMessage('Connected QR short link copied.');
  }

  async function connectQrCode() {
    if (!selectedCard) {
      setError('Save the smart card before connecting it to QR Studio.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const { data: existing } = await supabase
      .from('qr_links')
      .select('id,slug')
      .eq('destination_type', 'business_card')
      .eq('destination_id', selectedCard.id)
      .maybeSingle();

    const qrSlug = normalizeSlug(`${selectedCard.slug}-card`);
    const payload = {
      title: `${selectedCard.business_name} Smart Card`,
      slug: existing?.slug ?? qrSlug,
      destination_url: publicUrl,
      destination_type: 'business_card',
      destination_id: selectedCard.id,
      campaign_name: 'Smart Card',
      purpose: 'local business profile',
      source: 'smart card builder',
      medium: 'qr',
      tags: ['smart-card', selectedCard.slug],
      style_preset: 'circular-pad',
      center_label: selectedCard.business_name.slice(0, 14),
      top_ring_text: selectedCard.business_name,
      bottom_ring_text: 'Scan for offers - contact - directions',
      foreground_color: '#111111',
      background_color: '#f4f4f1',
      accent_color: normalizeHexColor(selectedCard.accent_color, DEFAULT_SMART_CARD_FORM.accent_color),
      show_center_label: true,
      show_short_url: true,
      status: 'active',
    };

    const { data, error } = existing?.id
      ? await supabase.from('qr_links').update(payload).eq('id', existing.id).select().single()
      : await supabase.from('qr_links').insert(payload).select().single();

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setConnectedQr(data as ConnectedQr);
    setMessage(`Connected to QR Studio: ${buildShortUrl(data.slug)}`);
  }

  if (!isBuilder) {
    return (
      <div>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neon/10">
                <Sparkles className="h-5 w-5 text-neon" />
              </div>
              <span className="badge badge-active">Local profile builder</span>
            </div>
            <h1 className="text-2xl font-bold">Business Profile</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
              Manage the public Smart Card experience for your business.
            </p>
          </div>
          <Link to="/app/business/smart-cards/new" className="btn-primary px-5 py-2.5 text-sm">
            <Plus className="h-4 w-4" /> New Business Profile
          </Link>
        </div>

        {(message || error) && <Notice error={error}>{error || message}</Notice>}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading business profiles...
          </div>
        ) : cards.length === 0 ? (
          <div className="card-surface p-8 text-center">
            <Sparkles className="mx-auto mb-3 h-9 w-9 text-neon" />
            <h2 className="text-lg font-bold">No business profiles yet.</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Create your public Smart Card experience, publish it, then connect it to QR Studio.</p>
            <Link to="/app/business/smart-cards/new" className="btn-primary mt-5 px-5 py-2.5 text-sm">
              <Plus className="h-4 w-4" /> Build first card
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {cards.map(card => (
              <Link
                key={card.id}
                to={`/app/business/smart-cards/${card.id}/edit`}
                className="card-surface group overflow-hidden p-0 transition-transform hover:-translate-y-0.5"
              >
                <div className="relative h-28 overflow-hidden">
                  {card.cover_image_url ? (
                    <img
                      src={card.cover_image_url}
                      alt=""
                      className="absolute inset-0 h-full w-full"
                      style={getImageDisplayStyle({ fit: card.cover_fit, position_x: card.cover_position_x, position_y: card.cover_position_y, zoom: card.cover_zoom })}
                    />
                  ) : (
                    <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }} />
                  )}
                  <div className="absolute inset-0" style={getCoverOverlayStyle(card.cover_overlay_opacity)} />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold">{card.business_name}</h2>
                      <p className="mt-1 truncate text-sm text-[var(--text-muted)]">/c/{card.slug}</p>
                    </div>
                    <span className={`badge ${card.is_published ? 'badge-active' : 'badge-draft'}`}>
                      {card.is_published ? 'Published' : 'Unpublished'}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5 text-neon" /> {card.view_count.toLocaleString()} views
                    </span>
                    <span>Updated {formatDateTime(card.updated_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading smart card builder...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link to="/app/business/smart-cards" className="mb-2 inline-flex text-xs font-semibold text-neon">
            Back to Business Profile
          </Link>
          <h1 className="text-2xl font-bold">{selectedCard ? 'Edit Business Profile' : 'New Business Profile'}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Manage the public Smart Card experience for your business.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={togglePublished} disabled={saving} className="btn-secondary px-4 py-2.5 text-sm">
            {form.is_published ? 'Unpublish' : 'Publish'}
          </button>
          <button type="button" onClick={copyPublicLink} className="btn-secondary px-4 py-2.5 text-sm">
            <Copy className="h-4 w-4" /> Copy Link
          </button>
          <button type="button" onClick={connectQrCode} disabled={saving || !selectedCard} className="btn-secondary px-4 py-2.5 text-sm">
            <QrCode className="h-4 w-4" /> Connect QR
          </button>
          <button type="button" onClick={saveCard} disabled={saving} className="btn-primary px-5 py-2.5 text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      {(message || error) && <Notice error={error}>{error || message}</Notice>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_390px]">
        <div className="space-y-5">
          <ProfileCompletionWidget completion={completion} />
          <QrConnectionPanel
            selectedCard={selectedCard}
            connectedQr={connectedQr}
            publicUrl={publicUrl}
            onCopyPublic={copyPublicLink}
            onCopyQr={copyQrLink}
            onConnect={connectQrCode}
            saving={saving}
          />
          <AnalyticsPreview analytics={analytics} />
          <CampaignOutputsPanel campaigns={smartCardCampaigns} saving={saving} onUpdate={updateCampaignOutput} />

          <section className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold">Business profile</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Business name">
                <input className="input-field" value={form.business_name} onChange={event => updateName(event.target.value)} />
              </Field>
              <Field label="Public slug">
                <input className="input-field" value={form.slug} onChange={event => updateField('slug', normalizeSlug(event.target.value))} />
              </Field>
              <Field label="Tagline" className="md:col-span-2">
                <input className="input-field" value={form.tagline} onChange={event => updateField('tagline', event.target.value)} />
              </Field>
              <ImageUploadControl
                label="Logo"
                helper="JPEG, PNG, or WebP up to 2 MB."
                imageUrl={form.logo_url}
                imageStyle={getImageDisplayStyle({ fit: form.logo_fit, position_x: form.logo_position_x, position_y: form.logo_position_y, zoom: form.logo_zoom })}
                uploadProgress={uploadProgress.logo}
                uploadError={uploadErrors.logo}
                disabled={saving}
                onUpload={file => void handleImageUpload('logo', file)}
                onRemove={() => removeUploadedImage('logo')}
              >
                <ImageDisplayControls
                  value={{ fit: form.logo_fit, position_x: form.logo_position_x, position_y: form.logo_position_y, zoom: form.logo_zoom }}
                  onChange={next => setForm(current => ({ ...current, logo_fit: next.fit, logo_position_x: next.position_x, logo_position_y: next.position_y, logo_zoom: next.zoom }))}
                />
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-neon">Advanced: paste logo URL</summary>
                  <input className="input-field mt-2" value={form.logo_url} onChange={event => setForm(current => ({ ...current, logo_url: event.target.value, logo_image_id: '', logo_fit: 'cover', logo_position_x: 50, logo_position_y: 50, logo_zoom: 1 }))} placeholder="https://..." />
                </details>
              </ImageUploadControl>
              <ImageUploadControl
                label="Cover image"
                helper="JPEG, PNG, or WebP up to 5 MB."
                imageUrl={form.cover_image_url}
                imageStyle={getImageDisplayStyle({ fit: form.cover_fit, position_x: form.cover_position_x, position_y: form.cover_position_y, zoom: form.cover_zoom })}
                uploadProgress={uploadProgress.cover}
                uploadError={uploadErrors.cover}
                disabled={saving}
                onUpload={file => void handleImageUpload('cover', file)}
                onRemove={() => removeUploadedImage('cover')}
              >
                <ImageDisplayControls
                  value={{ fit: form.cover_fit, position_x: form.cover_position_x, position_y: form.cover_position_y, zoom: form.cover_zoom }}
                  onChange={next => setForm(current => ({ ...current, cover_fit: next.fit, cover_position_x: next.position_x, cover_position_y: next.position_y, cover_zoom: next.zoom }))}
                />
                <Field label="Overlay opacity" className="mt-3">
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={form.cover_overlay_opacity}
                      onChange={event => updateField('cover_overlay_opacity', clampOverlayOpacity(event.target.value))}
                      className="w-full accent-[var(--brand-primary)]"
                    />
                    <div className="text-[11px] text-[var(--text-muted)]">{Math.round(form.cover_overlay_opacity)}%</div>
                  </div>
                </Field>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-neon">Advanced: paste cover URL</summary>
                  <input className="input-field mt-2" value={form.cover_image_url} onChange={event => setForm(current => ({ ...current, cover_image_url: event.target.value, cover_image_id: '', cover_fit: 'cover', cover_position_x: 50, cover_position_y: 50, cover_zoom: 1, cover_overlay_opacity: 90 }))} placeholder="https://..." />
                </details>
              </ImageUploadControl>
              <Field label="Bio" className="md:col-span-2">
                <textarea className="input-field min-h-28 resize-y" value={form.bio} onChange={event => updateField('bio', event.target.value)} />
              </Field>
            </div>
          </section>

          <section className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold">Contact actions</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Phone">
                <input className="input-field" value={form.phone} onChange={event => updateField('phone', event.target.value)} />
              </Field>
              <Field label="Email">
                <input className="input-field" value={form.email} onChange={event => updateField('email', event.target.value)} />
              </Field>
              <Field label="Website">
                <input className="input-field" value={form.website} onChange={event => updateField('website', event.target.value)} placeholder="https://..." />
              </Field>
              <Field label="Google Maps URL">
                <input className="input-field" value={form.google_maps_url} onChange={event => updateField('google_maps_url', event.target.value)} placeholder="https://maps.google.com/..." />
              </Field>
              <Field label="Address" className="md:col-span-2">
                <input className="input-field" value={form.address} onChange={event => updateField('address', event.target.value)} />
              </Field>
            </div>
          </section>

          <section className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold">Smart Card templates</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {SMART_CARD_TEMPLATES.map(template => (
                <button
                  key={template.value}
                  type="button"
                  onClick={() => setTemplate(template.value)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    form.template === template.value ? 'border-neon bg-neon/10' : 'border-[var(--border-default)] bg-[var(--bg-input)]'
                  }`}
                >
                  <span className="mb-3 flex gap-1">
                    <span className="h-5 w-5 rounded-full" style={{ background: template.colors[0] }} />
                    <span className="h-5 w-5 rounded-full" style={{ background: template.colors[1] }} />
                  </span>
                  <span className="block text-sm font-bold">{template.label}</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-[var(--text-muted)]">{template.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold">Theme</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              {SMART_CARD_THEMES.map(theme => (
                <button
                  key={theme.value}
                  type="button"
                  onClick={() => setTheme(theme.value)}
                  className={`rounded-2xl border p-3 text-left transition-colors ${
                    form.theme === theme.value ? 'border-neon bg-neon/10' : 'border-[var(--border-default)] bg-[var(--bg-input)]'
                  }`}
                >
                  <span className="mb-3 flex gap-1">
                    <span className="h-5 w-5 rounded-full" style={{ background: theme.colors[0] }} />
                    <span className="h-5 w-5 rounded-full" style={{ background: theme.colors[1] }} />
                  </span>
                  <span className="text-xs font-semibold">{theme.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <ColorField label="Primary color" value={form.primary_color} onChange={value => updateField('primary_color', value)} />
              <ColorField label="Accent color" value={form.accent_color} onChange={value => updateField('accent_color', value)} />
            </div>
          </section>

          <section className="card-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Custom links</h2>
              <button
                type="button"
                onClick={() => updateField('links', [...form.links, { id: `draft-${Date.now()}`, label: '', url: '', sort_order: form.links.length, is_active: true }])}
                className="btn-ghost text-xs"
              >
                <Plus className="h-4 w-4" /> Add link
              </button>
            </div>
            <div className="space-y-3">
              {form.links.map((link, index) => (
                <div key={link.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 md:grid-cols-[1fr_1.4fr_auto]">
                  <input className="input-field" value={link.label} onChange={event => updateLink(index, 'label', event.target.value)} placeholder="Menu" />
                  <input className="input-field" value={link.url} onChange={event => updateLink(index, 'url', event.target.value)} placeholder="https://..." />
                  <button
                    type="button"
                    onClick={() => updateField('links', form.links.filter((_, linkIndex) => linkIndex !== index))}
                    className="btn-secondary px-4"
                    aria-label="Remove link"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="card-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Current offers</h2>
              <button
                type="button"
                onClick={() => updateField('offers', [...form.offers, { id: `draft-${Date.now()}`, title: '', description: '', claim_url: '', starts_at: '', ends_at: '', is_active: true }])}
                className="btn-ghost text-xs"
              >
                <Plus className="h-4 w-4" /> Add offer
              </button>
            </div>
            <div className="space-y-3">
              {form.offers.map((offer, index) => (
                <div key={offer.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                    <input className="input-field" value={offer.title} onChange={event => updateOffer(index, 'title', event.target.value)} placeholder="Free appetizer today" />
                    <button
                      type="button"
                      onClick={() => updateField('offers', form.offers.filter((_, offerIndex) => offerIndex !== index))}
                      className="btn-secondary px-4"
                      aria-label="Remove offer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea className="input-field mt-3 min-h-20 resize-y" value={offer.description} onChange={event => updateOffer(index, 'description', event.target.value)} placeholder="Offer details" />
                  <input className="input-field mt-3" value={offer.claim_url} onChange={event => updateOffer(index, 'claim_url', event.target.value)} placeholder="Optional claim URL" />
                </div>
              ))}
            </div>
          </section>

          <section className="card-surface p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Business Marketing Hub</h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Add booking, lead capture, videos, documents, tours, proof, and service visuals for a richer Smart Card.</p>
              </div>
              <span className="badge badge-active">Adpadz Smart Card v3</span>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
                <div className="mb-3">
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">Booking mode</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => updateField('booking_mode', 'external')}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${form.booking_mode === 'external' ? 'border-neon bg-neon/10 text-[var(--text-primary)]' : 'border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)]'}`}
                    >
                      <p className="text-sm font-semibold">External booking link</p>
                      <p className="mt-1 text-xs opacity-75">Keep Calendly, Square, Toast, or any booking URL.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('booking_mode', 'request')}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${form.booking_mode === 'request' ? 'border-neon bg-neon/10 text-[var(--text-primary)]' : 'border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)]'}`}
                    >
                      <p className="text-sm font-semibold">Adpadz booking request</p>
                      <p className="mt-1 text-xs opacity-75">Collect service requests as leads for manual follow-up.</p>
                    </button>
                  </div>
                </div>

                {form.booking_mode === 'external' ? (
                  <>
                    <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                      <input type="checkbox" checked={form.booking_enabled} onChange={event => updateField('booking_enabled', event.target.checked)} />
                      Enable external booking button
                    </label>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Field label="Booking label">
                        <input className="input-field" value={form.booking_label} onChange={event => updateField('booking_label', event.target.value)} placeholder="Book Now" />
                      </Field>
                      <Field label="Provider">
                        <input className="input-field" value={form.booking_provider} onChange={event => updateField('booking_provider', event.target.value)} placeholder="Calendly, Square, Toast" />
                      </Field>
                    </div>
                    <Field label="Booking URL" className="mt-3">
                      <input className="input-field" value={form.booking_url} onChange={event => updateField('booking_url', event.target.value)} placeholder="https://..." />
                    </Field>
                  </>
                ) : (
                  <>
                    <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                      <input type="checkbox" checked={form.booking_request_enabled} onChange={event => updateField('booking_request_enabled', event.target.checked)} />
                      Enable booking requests
                    </label>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Field label="Request title">
                        <input className="input-field" value={form.booking_request_title} onChange={event => updateField('booking_request_title', event.target.value)} placeholder="Request an Appointment" />
                      </Field>
                      <Field label="Button label">
                        <input className="input-field" value={form.booking_request_button_label} onChange={event => updateField('booking_request_button_label', event.target.value)} placeholder="Request Booking" />
                      </Field>
                    </div>
                    <Field label="Description" className="mt-3">
                      <textarea className="input-field min-h-20 resize-y" value={form.booking_request_description} onChange={event => updateField('booking_request_description', event.target.value)} placeholder="Let customers know you will confirm availability and follow up manually." />
                    </Field>

                    <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">Services manager</p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">Add requestable services for the booking form dropdown.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBookingServices(current => [
                            ...current,
                            {
                              id: `draft-${Date.now()}`,
                              name: '',
                              description: '',
                              duration_minutes: '',
                              sort_order: current.length,
                              is_active: true,
                            },
                          ])}
                          className="btn-ghost text-xs"
                        >
                          <Plus className="h-4 w-4" /> Add service
                        </button>
                      </div>

                      {bookingServices.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--border-default)] px-4 py-5 text-sm text-[var(--text-muted)]">
                          No services yet. Customers can still submit a general booking request, or you can add service options here.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {bookingServices.map((service, index) => (
                            <div key={service.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_auto]">
                                <input className="input-field" value={service.name} onChange={event => updateBookingService(index, 'name', event.target.value)} placeholder="Consultation, haircut, detailing package" />
                                <input className="input-field" inputMode="numeric" value={service.duration_minutes} onChange={event => updateBookingService(index, 'duration_minutes', event.target.value.replace(/[^\d]/g, ''))} placeholder="60 min" />
                                <button
                                  type="button"
                                  onClick={() => setBookingServices(current => current.filter((_, serviceIndex) => serviceIndex !== index))}
                                  className="btn-secondary px-4"
                                  aria-label="Remove service"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <textarea className="input-field mt-3 min-h-20 resize-y" value={service.description} onChange={event => updateBookingService(index, 'description', event.target.value)} placeholder="Optional service description" />
                              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                                  <input type="checkbox" checked={service.is_active} onChange={event => updateBookingService(index, 'is_active', event.target.checked)} />
                                  Active on public Smart Card
                                </label>
                                <span className="text-xs text-[var(--text-muted)]">Display order: {index + 1}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4"> 
                <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                  <input type="checkbox" checked={form.lead_form_enabled} onChange={event => updateField('lead_form_enabled', event.target.checked)} />
                  Enable lead form
                </label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Form title">
                    <input className="input-field" value={form.lead_form_title} onChange={event => updateField('lead_form_title', event.target.value)} placeholder="Request Information" />
                  </Field>
                  <Field label="Button label">
                    <input className="input-field" value={form.lead_form_button_label} onChange={event => updateField('lead_form_button_label', event.target.value)} placeholder="Send Request" />
                  </Field>
                </div>
                <Field label="Description" className="mt-3">
                  <textarea className="input-field min-h-20 resize-y" value={form.lead_form_description} onChange={event => updateField('lead_form_description', event.target.value)} placeholder="Tell customers when you will follow up." />
                </Field>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
              <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                <input type="checkbox" checked={form.featured_video_enabled} onChange={event => updateField('featured_video_enabled', event.target.checked)} />
                Feature a local spotlight video
              </label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.5fr]">
                <Field label="Video title">
                  <input className="input-field" value={form.featured_video_title} onChange={event => updateField('featured_video_title', event.target.value)} placeholder="Local Spotlight" />
                </Field>
                <Field label="Video URL">
                  <input className="input-field" value={form.featured_video_url} onChange={event => updateField('featured_video_url', event.target.value)} placeholder="https://youtube.com/..." />
                </Field>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex flex-wrap gap-2">
                {(['images', 'videos', 'documents', 'tours', 'before_after', 'testimonials'] as MediaTab[]).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveMediaTab(tab)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${activeMediaTab === tab ? 'bg-neon text-black' : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'}`}
                  >
                    {tab === 'before_after' ? 'Before/After' : tab.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {activeMediaTab === 'images' && (
                <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4 text-sm text-[var(--text-muted)]">
                  Use the Gallery module below for storefront, work, menu, team, and product photos. Current saved images count toward the Smart Card image limit.
                </div>
              )}

              {(activeMediaTab === 'videos' || activeMediaTab === 'documents' || activeMediaTab === 'tours') && (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setMarketingAssets(current => [...current, {
                        id: `draft-${Date.now()}`,
                        asset_type: activeMediaTab === 'tours' ? 'virtual_tour' : activeMediaTab === 'videos' ? 'video' : 'document',
                        title: '',
                        description: '',
                        file_url: '',
                        external_url: '',
                        thumbnail_url: '',
                        provider: '',
                        sort_order: current.length,
                        is_active: true,
                      }])}
                      className="btn-ghost text-xs"
                    >
                      <Plus className="h-4 w-4" /> Add media
                    </button>
                  </div>
                  {marketingAssets.filter(asset => activeMediaTab === 'videos' ? asset.asset_type === 'video' : activeMediaTab === 'tours' ? asset.asset_type === 'virtual_tour' : ['brochure', 'menu', 'document'].includes(asset.asset_type)).map(asset => {
                    const index = marketingAssets.findIndex(item => item.id === asset.id);
                    return (
                      <div key={asset.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[.8fr_1fr_auto]">
                          <select className="input-field" value={asset.asset_type} onChange={event => updateMarketingAsset(index, 'asset_type', event.target.value)}>
                            <option value="video">Video</option>
                            <option value="document">Document</option>
                            <option value="brochure">Brochure</option>
                            <option value="menu">Menu</option>
                            <option value="virtual_tour">Virtual tour</option>
                          </select>
                          <input className="input-field" value={asset.title} onChange={event => updateMarketingAsset(index, 'title', event.target.value)} placeholder="Title" />
                          <button type="button" onClick={() => setMarketingAssets(current => current.filter(item => item.id !== asset.id))} className="btn-secondary px-4" aria-label="Remove media"><Trash2 className="h-4 w-4" /></button>
                        </div>
                        <textarea className="input-field mt-3 min-h-20 resize-y" value={asset.description} onChange={event => updateMarketingAsset(index, 'description', event.target.value)} placeholder="Optional description" />
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                          <input className="input-field" value={asset.external_url} onChange={event => updateMarketingAsset(index, 'external_url', event.target.value)} placeholder="External URL" />
                          <input className="input-field" value={asset.file_url} onChange={event => updateMarketingAsset(index, 'file_url', event.target.value)} placeholder="File URL" />
                          <input className="input-field" value={asset.thumbnail_url} onChange={event => updateMarketingAsset(index, 'thumbnail_url', event.target.value)} placeholder="Thumbnail URL" />
                        </div>
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                          <input className="input-field" value={asset.provider} onChange={event => updateMarketingAsset(index, 'provider', event.target.value)} placeholder="Provider, optional" />
                          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                            <input type="checkbox" checked={asset.is_active} onChange={event => updateMarketingAsset(index, 'is_active', event.target.checked)} />
                            Public
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeMediaTab === 'before_after' && (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setBeforeAfterItems(current => [...current, { id: `draft-${Date.now()}`, title: '', description: '', before_image_url: '', after_image_url: '', before_image_id: '', after_image_id: '', is_active: true, sort_order: current.length }])} className="btn-ghost text-xs">
                      <Plus className="h-4 w-4" /> Add transformation
                    </button>
                  </div>
                  {beforeAfterItems.map((item, index) => (
                    <div key={item.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                        <input className="input-field" value={item.title} onChange={event => updateBeforeAfter(index, 'title', event.target.value)} placeholder="Kitchen remodel, driveway detail, smile upgrade" />
                        <button type="button" onClick={() => setBeforeAfterItems(current => current.filter((_, itemIndex) => itemIndex !== index))} className="btn-secondary px-4" aria-label="Remove transformation"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <textarea className="input-field mt-3 min-h-20 resize-y" value={item.description} onChange={event => updateBeforeAfter(index, 'description', event.target.value)} placeholder="Optional details" />
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <input className="input-field" value={item.before_image_url} onChange={event => updateBeforeAfter(index, 'before_image_url', event.target.value)} placeholder="Before image URL" />
                        <input className="input-field" value={item.after_image_url} onChange={event => updateBeforeAfter(index, 'after_image_url', event.target.value)} placeholder="After image URL" />
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                        <input type="checkbox" checked={item.is_active} onChange={event => updateBeforeAfter(index, 'is_active', event.target.checked)} />
                        Public
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {activeMediaTab === 'testimonials' && (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setTestimonials(current => [...current, { id: `draft-${Date.now()}`, customer_name: '', rating: '5', quote: '', image_url: '', video_url: '', source: '', is_active: true, sort_order: current.length }])} className="btn-ghost text-xs">
                      <Plus className="h-4 w-4" /> Add testimonial
                    </button>
                  </div>
                  {testimonials.map((item, index) => (
                    <div key={item.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_.5fr_auto]">
                        <input className="input-field" value={item.customer_name} onChange={event => updateTestimonial(index, 'customer_name', event.target.value)} placeholder="Customer name" />
                        <input className="input-field" type="number" min="1" max="5" value={item.rating} onChange={event => updateTestimonial(index, 'rating', event.target.value)} placeholder="5" />
                        <button type="button" onClick={() => setTestimonials(current => current.filter((_, itemIndex) => itemIndex !== index))} className="btn-secondary px-4" aria-label="Remove testimonial"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <textarea className="input-field mt-3 min-h-24 resize-y" value={item.quote} onChange={event => updateTestimonial(index, 'quote', event.target.value)} placeholder="What did they love?" />
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <input className="input-field" value={item.source} onChange={event => updateTestimonial(index, 'source', event.target.value)} placeholder="Google, Yelp, customer" />
                        <input className="input-field" value={item.image_url} onChange={event => updateTestimonial(index, 'image_url', event.target.value)} placeholder="Image URL" />
                        <input className="input-field" value={item.video_url} onChange={event => updateTestimonial(index, 'video_url', event.target.value)} placeholder="Video URL" />
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                        <input type="checkbox" checked={item.is_active} onChange={event => updateTestimonial(index, 'is_active', event.target.checked)} />
                        Public
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Recent leads</h3>
                <span className="text-xs text-[var(--text-muted)]">{recentLeads.length} shown</span>
              </div>
              {recentLeads.length > 0 ? (
                <div className="space-y-2">
                  {recentLeads.map(lead => (
                    <div key={lead.id} className="rounded-xl bg-black/20 px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{lead.name}</span>
                        <span className="text-[var(--text-muted)]">{formatDateTime(lead.created_at)}</span>
                      </div>
                      <p className="mt-1 text-[var(--text-muted)]">{lead.email || lead.phone || 'Contact captured'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Leads submitted from the public Smart Card will appear here.</p>
              )}
            </div>
          </section>
          <section className="card-surface p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Gallery</h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Add product, work, menu, team, or storefront images. Current placeholder Pro limit: {DEFAULT_SMART_CARD_IMAGE_LIMIT} images.</p>
              </div>
              <button
                type="button"
                onClick={() => updateField('gallery', [...form.gallery, { id: `draft-${Date.now()}`, image_url: '', cloudflare_image_id: null, fit: 'cover', position_x: 50, position_y: 50, zoom: 1, caption: '', sort_order: form.gallery.length, is_active: true }])}
                className="btn-ghost text-xs"
              >
                <Plus className="h-4 w-4" /> Add image
              </button>
            </div>
            <div className="space-y-3">
              {form.gallery.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr_auto]">
                    <ImageUploadControl
                      label={`Gallery image ${index + 1}`}
                      helper="JPEG, PNG, or WebP up to 5 MB."
                      imageUrl={item.image_url}
                      imageStyle={getImageDisplayStyle({ fit: item.fit, position_x: item.position_x, position_y: item.position_y, zoom: item.zoom })}
                      uploadProgress={uploadProgress[`gallery-${index}`]}
                      uploadError={uploadErrors[`gallery-${index}`]}
                      disabled={saving}
                      onUpload={file => void handleImageUpload('gallery', file, index)}
                      onRemove={() => removeUploadedImage('gallery', index)}
                      compact
                    >
                      <ImageDisplayControls
                        value={{ fit: item.fit, position_x: item.position_x, position_y: item.position_y, zoom: item.zoom }}
                        onChange={next => setForm(current => ({ ...current, gallery: current.gallery.map((galleryItem, itemIndex) => itemIndex === index ? { ...galleryItem, fit: next.fit, position_x: next.position_x, position_y: next.position_y, zoom: next.zoom } : galleryItem) }))}
                        compact
                      />
                    </ImageUploadControl>
                    <input className="input-field" value={item.caption} onChange={event => updateGallery(index, 'caption', event.target.value)} placeholder="Optional caption" />
                    <button
                      type="button"
                      onClick={() => updateField('gallery', form.gallery.filter((_, itemIndex) => itemIndex !== index))}
                      className="btn-secondary px-4"
                      aria-label="Remove gallery image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-neon">Advanced: paste gallery image URL</summary>
                    <input className="input-field mt-2" value={item.image_url} onChange={event => setForm(current => ({ ...current, gallery: current.gallery.map((galleryItem, itemIndex) => itemIndex === index ? { ...galleryItem, image_url: event.target.value, cloudflare_image_id: null, fit: 'cover', position_x: 50, position_y: 50, zoom: 1 } : galleryItem) }))} placeholder="https://image-url..." />
                  </details>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <div className="card-surface sticky top-5 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Live preview</h2>
              <span className={`badge ${form.is_published ? 'badge-active' : 'badge-draft'}`}>
                {form.is_published ? 'Published' : 'Unpublished'}
              </span>
            </div>
            <SmartCardPreview form={form} />
            <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
              <p className="truncate text-xs text-neon">{publicUrl}</p>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                {form.is_published ? 'This public link is live.' : 'This link will open after you publish the Smart Card.'}
              </p>
              {form.is_published && (
                <a href={publicUrl} target="_blank" rel="noreferrer" className="btn-ghost mt-2 px-0 text-xs">
                  <ExternalLink className="h-4 w-4" /> Open public card
                </a>
              )}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={togglePublished}
                disabled={saving}
                className="btn-secondary w-full justify-center px-4 py-3 text-sm"
              >
                {form.is_published ? 'Unpublish' : 'Publish'}
              </button>
              <button type="button" onClick={saveCard} disabled={saving} className="btn-secondary w-full justify-center px-5 py-3 text-sm focus-visible:bg-[var(--color-neon)] focus-visible:text-[var(--bg-base)] focus-visible:shadow-[var(--glow-button)]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProfileCompletionWidget({ completion }: { completion: ReturnType<typeof calculateProfileCompletion> }) {
  return (
    <section className="card-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Profile strength</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Richer profiles perform better on QR codes, mailers, and local offer pages.</p>
        </div>
        <span className="text-3xl font-black text-neon">{completion.percentage}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-input)]">
        <div className="h-full rounded-full bg-neon" style={{ width: `${completion.percentage}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Completed</p>
          <div className="flex flex-wrap gap-2">
            {completion.completed.map(item => <span key={item} className="badge badge-active"><CheckCircle2 className="h-3 w-3" /> {item}</span>)}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Recommended next</p>
          <div className="flex flex-wrap gap-2">
            {completion.missing.slice(0, 6).map(item => <span key={item} className="badge badge-draft">{item}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function QrConnectionPanel({ selectedCard, connectedQr, publicUrl, onCopyPublic, onCopyQr, onConnect, saving }: { selectedCard: BusinessCardRecord | null; connectedQr: ConnectedQr | null; publicUrl: string; onCopyPublic: () => void; onCopyQr: () => void; onConnect: () => void; saving: boolean }) {
  return (
    <section className="card-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">QR Studio connection</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Print this QR on business cards, flyers, table tents, signs, and Adpadz Community Mailers. Scans route to the smart card and keep analytics attached.</p>
        </div>
        <QrCode className="h-5 w-5 text-neon" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
          <p className="text-xs text-[var(--text-muted)]">Public smart card</p>
          <p className="mt-1 truncate text-xs text-neon">{publicUrl}</p>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            {selectedCard?.is_published ? 'Use this on printed materials and local promos.' : 'Publish this Smart Card before sharing the public link.'}
          </p>
          <button type="button" onClick={onCopyPublic} className="btn-ghost mt-2 px-0 text-xs" disabled={!selectedCard?.is_published}><Copy className="h-4 w-4" /> Copy public link</button>
        </div>
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
          <p className="text-xs text-[var(--text-muted)]">Connected QR</p>
          {connectedQr ? (
            <>
              <p className="mt-1 truncate text-xs text-neon">{buildShortUrl(connectedQr.slug)}</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">{connectedQr.scan_count.toLocaleString()} scans</p>
              <button type="button" onClick={onCopyQr} className="btn-ghost mt-2 px-0 text-xs"><Copy className="h-4 w-4" /> Copy QR link</button>
            </>
          ) : (
            <p className="mt-1 text-xs text-[var(--text-muted)]">No QR connected yet.</p>
          )}
        </div>
      </div>
      <button type="button" onClick={onConnect} disabled={saving || !selectedCard} className="btn-secondary mt-4 px-4 py-2.5 text-sm">
        <QrCode className="h-4 w-4" /> {connectedQr ? 'Update connected QR' : 'Connect to QR Studio'}
      </button>
    </section>
  );
}

function CampaignOutputsPanel({ campaigns, saving, onUpdate }: { campaigns: SmartCardCampaign[]; saving: boolean; onUpdate: (output: SmartCardCampaign, updates: { enabled?: boolean; section?: string; sort_order?: number }) => void }) {
  return (
    <section className="card-surface p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Campaigns</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Choose which Campaign Engine promotions appear on this Smart Card and where they render.</p>
        </div>
        <span className="badge badge-draft">Smart Card outputs</span>
      </div>
      {campaigns.length === 0 ? (
        <p className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-xs text-[var(--text-muted)]">No campaigns are connected yet. Use Campaign Studio to create a campaign and enable the Smart Card output.</p>
      ) : (
        <div className="space-y-3">
          {campaigns.map(output => (
            <div key={output.campaign_id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{getCampaignTitle(output)}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
                    <span>{getCampaignFormatLabel(output)}</span>
                    <span>{output.campaign.status === 'active' ? 'Active' : output.campaign.status}</span>
                    <span>{output.enabled ? 'Enabled on Smart Card' : 'Disabled on Smart Card'}</span>
                    <span>Order {output.sort_order}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={getCampaignSection(output)}
                    onChange={event => onUpdate(output, { section: event.target.value })}
                    disabled={saving}
                    className="input-field min-w-44 text-xs"
                  >
                    {SMART_CARD_CAMPAIGN_SECTIONS.map(section => <option key={section.value} value={section.value}>{section.label}</option>)}
                  </select>
                  <input
                    type="number"
                    value={output.sort_order}
                    onChange={event => onUpdate(output, { sort_order: Number(event.target.value) || 0 })}
                    disabled={saving}
                    className="input-field w-24 text-xs"
                    aria-label="Smart Card order"
                  />
                  <button
                    type="button"
                    onClick={() => onUpdate(output, { enabled: !output.enabled })}
                    disabled={saving}
                    className="btn-secondary px-4 py-2 text-xs"
                  >
                    {output.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <Link to={`/ad/${output.campaign.id}`} className="btn-ghost px-0 text-xs">
                    <ExternalLink className="h-4 w-4" /> Open
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
function AnalyticsPreview({ analytics }: { analytics: AnalyticsSummary }) {
  const stats = [
    ['Views', analytics.views, Eye],
    ['QR scans', analytics.qrScans, QrCode],
    ['Calls', analytics.callClicks, Phone],
    ['Website', analytics.websiteClicks, Globe],
    ['Claims', analytics.offerClaims, BadgePercent],
    ['Saves', analytics.saveContacts, Activity],
  ] as const;

  return (
    <section className="card-surface p-5">
      <h2 className="mb-4 text-sm font-semibold">Analytics preview</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {stats.map(([label, value, Icon]) => (
          <div key={label} className="rounded-2xl bg-[var(--bg-input)] p-3">
            <Icon className="mb-2 h-4 w-4 text-neon" />
            <p className="text-xl font-black">{value.toLocaleString()}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
function SmartCardPreview({ form }: { form: BusinessCardFormState }) {
  const offer = getCurrentOffer(form.offers);
  const template = getTemplateOption(form.template);
  const actions = [
    { icon: Phone, label: 'Call' },
    { icon: MessageCircle, label: 'Text' },
    { icon: Mail, label: 'Email' },
    { icon: Globe, label: 'Web' },
    { icon: MapPin, label: 'Map' },
  ];

  return (
    <SmartCardShell
      businessName={form.business_name}
      tagline={form.tagline}
      primaryColor={form.primary_color}
      accentColor={form.accent_color}
      lightMode={template.treatment === 'light'}
      address={form.address}
      coverImageUrl={form.cover_image_url}
      coverFit={form.cover_fit}
      coverPositionX={form.cover_position_x}
      coverPositionY={form.cover_position_y}
      coverZoom={form.cover_zoom}
      coverOverlayOpacity={form.cover_overlay_opacity}
      logoUrl={form.logo_url}
      logoFit={form.logo_fit}
      logoPositionX={form.logo_position_x}
      logoPositionY={form.logo_position_y}
      logoZoom={form.logo_zoom}
      actions={actions}
      offer={offer ? { title: offer.title, description: offer.description } : null}
      links={form.links.filter(link => link.label && link.url).map(link => ({ id: link.id, label: link.label, url: link.url }))}
    />
  );
}

function ImageUploadControl({
  label,
  helper,
  imageUrl,
  imageStyle,
  uploadProgress,
  uploadError,
  disabled,
  compact = false,
  onUpload,
  onRemove,
  children,
}: {
  label: string;
  helper: string;
  imageUrl: string;
  imageStyle?: CSSProperties;
  uploadProgress?: UploadProgress | null;
  uploadError?: string | null;
  disabled?: boolean;
  compact?: boolean;
  onUpload: (file: File | null) => void;
  onRemove: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 ${compact ? '' : 'md:col-span-1'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">{disabled ? 'On new Smart Cards, upload will save a draft first.' : helper}</p>
        </div>
        {imageUrl && (
          <button type="button" onClick={onRemove} className="btn-ghost p-2" aria-label={`Remove ${label}`}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {imageUrl && (
        <div className={`mt-3 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-black/20 ${compact ? 'h-24' : 'h-32'}`}>
          <img src={imageUrl} alt="" className="h-full w-full" style={imageStyle} />
        </div>
      )}

      {uploadProgress && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>{uploadProgress.label}</span>
            <span>{uploadProgress.percentage}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/30">
            <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${uploadProgress.percentage}%` }} />
          </div>
        </div>
      )}

      {uploadError && (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs leading-relaxed text-red-300">
          {uploadError}
        </div>
      )}

      <label className={`btn-secondary mt-3 w-full cursor-pointer px-4 py-2.5 text-sm ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <Upload className="h-4 w-4" /> {imageUrl ? 'Replace image' : `Upload ${label}`}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled}
          onChange={event => {
            onUpload(event.target.files?.[0] ?? null);
            event.currentTarget.value = '';
          }}
        />
      </label>

      {children}
    </div>
  );
}
function ImageDisplayControls({
  value,
  onChange,
  compact = false,
}: {
  value: ImageDisplayPreferences;
  onChange: (next: ImageDisplayPreferences) => void;
  compact?: boolean;
}) {
  const normalized = {
    fit: normalizeImageFit(value.fit),
    position_x: clampImagePosition(value.position_x),
    position_y: clampImagePosition(value.position_y),
    zoom: clampImageZoom(value.zoom),
  };
  const positions: Array<{ label: string; x: number; y: number }> = [
    { label: 'Top left', x: 0, y: 0 },
    { label: 'Top center', x: 50, y: 0 },
    { label: 'Top right', x: 100, y: 0 },
    { label: 'Center left', x: 0, y: 50 },
    { label: 'Center', x: 50, y: 50 },
    { label: 'Center right', x: 100, y: 50 },
    { label: 'Bottom left', x: 0, y: 100 },
    { label: 'Bottom center', x: 50, y: 100 },
    { label: 'Bottom right', x: 100, y: 100 },
  ];

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-[var(--border-default)] bg-black/10 p-3">
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
        <Field label="Fit mode">
          <div className="grid grid-cols-3 gap-2">
            {IMAGE_FIT_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ ...normalized, fit: option.value })}
                className={`rounded-xl border px-2 py-2 text-[11px] font-semibold ${normalized.fit === option.value ? 'border-neon bg-neon/10 text-neon' : 'border-[var(--border-default)] text-[var(--text-secondary)]'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Zoom / Resize">
          <div className="space-y-2">
            <input type="range" min="0.5" max="3" step="0.05" value={normalized.zoom} onChange={event => onChange({ ...normalized, zoom: clampImageZoom(event.target.value) })} className="w-full accent-[var(--brand-primary)]" />
            <div className="text-[11px] text-[var(--text-muted)]">{normalized.zoom.toFixed(2)}x</div>
          </div>
        </Field>
        <Field label="Reset">
          <button type="button" onClick={() => onChange(resetImageDisplayPreferences())} className="btn-secondary w-full px-3 py-2 text-xs">Reset image framing</button>
        </Field>
      </div>
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[1fr_1fr_180px]'}`}>
        <Field label="Position X">
          <div className="space-y-2">
            <input type="range" min="0" max="100" step="1" value={normalized.position_x} onChange={event => onChange({ ...normalized, position_x: clampImagePosition(event.target.value) })} className="w-full accent-[var(--brand-primary)]" />
            <div className="text-[11px] text-[var(--text-muted)]">{Math.round(normalized.position_x)}%</div>
          </div>
        </Field>
        <Field label="Position Y">
          <div className="space-y-2">
            <input type="range" min="0" max="100" step="1" value={normalized.position_y} onChange={event => onChange({ ...normalized, position_y: clampImagePosition(event.target.value) })} className="w-full accent-[var(--brand-primary)]" />
            <div className="text-[11px] text-[var(--text-muted)]">{Math.round(normalized.position_y)}%</div>
          </div>
        </Field>
        <Field label="9-point position">
          <div className="grid grid-cols-3 gap-2">
            {positions.map(position => {
              const active = normalized.position_x === position.x && normalized.position_y === position.y;
              return (
                <button
                  key={position.label}
                  type="button"
                  onClick={() => onChange({ ...normalized, position_x: position.x, position_y: position.y })}
                  className={`flex h-10 items-center justify-center rounded-xl border ${active ? 'border-neon bg-neon/10 text-neon' : 'border-[var(--border-default)] text-[var(--text-secondary)]'}`}
                  aria-label={position.label}
                  title={position.label}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-current" />
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </div>
  );
}
function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={event => onChange(event.target.value)} className="h-12 w-14 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-1" />
        <input className="input-field" value={value} onChange={event => onChange(event.target.value)} />
      </div>
    </Field>
  );
}

function Notice({ error, children }: { error: string | null; children: ReactNode }) {
  return (
    <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-400/30 bg-red-400/10 text-red-300' : 'border-neon/30 bg-neon/10 text-neon'}`}>
      {children}
    </div>
  );
}































































