import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  BadgePercent,
  CalendarDays,
  Clock3,
  ExternalLink,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PlayCircle,
  Share2,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { safeActionHref, safeHttpUrl } from '../lib/urls';
import {
  getCoverOverlayStyle,
  getCurrentOffer,
  getImageDisplayStyle,
  getTemplateOption,
  normalizeHexColor,
  type BusinessCardEventType,
  type BusinessCardGalleryRecord,
  type BusinessMarketingAssetRecord,
  type BusinessCardBeforeAfterRecord,
  type BusinessCardTestimonialRecord,
  type BusinessCardBookingServiceRecord,
  type BusinessCardLinkRecord,
  type BusinessCardOfferRecord,
  type BusinessCardRecord,
} from '../lib/smartCards';
import { getCampaignFormatLabel, getCampaignOffer, getCampaignSection, getCampaignTitle, isCampaignPublicNow, normalizeCampaignOutput, type CampaignOutputRecord, type SmartCardCampaign } from '../lib/ads';
import { AdpadzButton, AdpadzCouponCard, AdpadzPill } from '../components/adpadz-ui';
type PublicCardState = 'loading' | 'ready' | 'not-found' | 'error';

type ActionLink = {
  href?: string;
  label: string;
  eventType: BusinessCardEventType;
  icon: typeof Phone;
};

type LeadFormState = { name: string; phone: string; email: string; message: string };
type BookingRequestFormState = { service_id: string; preferred_date: string; preferred_time: string; name: string; phone: string; email: string; message: string };

export default function SmartCardPublic() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PublicCardState>('loading');
  const [card, setCard] = useState<BusinessCardRecord | null>(null);
  const [links, setLinks] = useState<BusinessCardLinkRecord[]>([]);
  const [offers, setOffers] = useState<BusinessCardOfferRecord[]>([]);
  const [bookingServices, setBookingServices] = useState<BusinessCardBookingServiceRecord[]>([]);
  const [gallery, setGallery] = useState<BusinessCardGalleryRecord[]>([]);
  const [marketingAssets, setMarketingAssets] = useState<BusinessMarketingAssetRecord[]>([]);
  const [beforeAfterItems, setBeforeAfterItems] = useState<BusinessCardBeforeAfterRecord[]>([]);
  const [testimonials, setTestimonials] = useState<BusinessCardTestimonialRecord[]>([]);
  const [smartCardCampaigns, setSmartCardCampaigns] = useState<SmartCardCampaign[]>([]);
  const [draftPreview, setDraftPreview] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [leadStatus, setLeadStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [bookingRequestForm, setBookingRequestForm] = useState<BookingRequestFormState>({ service_id: '', preferred_date: '', preferred_time: '', name: '', phone: '', email: '', message: '' });
  const [bookingRequestStatus, setBookingRequestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const qrLinkId = searchParams.get('qr') || null;

  const currentOffer = useMemo(() => getCurrentOffer(offers), [offers]);
  const activeBookingServices = useMemo(
    () => bookingServices
      .filter(service => service.is_active && service.service_is_active)
      .sort((a, b) => a.sort_order - b.sort_order),
    [bookingServices],
  );
  const activeLinks = useMemo(() => links.filter(link => link.is_active).sort((a, b) => a.sort_order - b.sort_order), [links]);
  const activeGallery = useMemo(() => gallery.filter(item => item.is_active).sort((a, b) => a.sort_order - b.sort_order), [gallery]);
  const activeAssets = useMemo(() => marketingAssets.filter(item => item.is_active).sort((a, b) => a.sort_order - b.sort_order), [marketingAssets]);
  const activeBeforeAfter = useMemo(() => beforeAfterItems.filter(item => item.is_active).sort((a, b) => a.sort_order - b.sort_order), [beforeAfterItems]);
  const activeTestimonials = useMemo(() => testimonials.filter(item => item.is_active).sort((a, b) => a.sort_order - b.sort_order), [testimonials]);
  const promotionCampaigns = useMemo(() => smartCardCampaigns.filter(output => getCampaignSection(output) === 'promotions'), [smartCardCampaigns]);
  const mediaCampaigns = useMemo(() => smartCardCampaigns.filter(output => getCampaignSection(output) === 'media'), [smartCardCampaigns]);
  const proofCampaigns = useMemo(() => smartCardCampaigns.filter(output => getCampaignSection(output) === 'proof'), [smartCardCampaigns]);

  useEffect(() => {
    let cancelled = false;

    async function loadCard() {
      if (!slug) {
        setStatus('not-found');
        return;
      }

      setStatus('loading');
      setDraftPreview(false);

      try {
        const { data, error } = await supabase
          .from('business_cards')
          .select('*')
          .eq('slug', slug)
          .limit(1);

        if (cancelled) return;

        if (error) {
          if (import.meta.env.DEV) {
            console.error('[SmartCardPublic] failed to load card', { slug, error });
          }
          setStatus('error');
          return;
        }

        const loadedCard = ((data ?? [])[0] ?? null) as BusinessCardRecord | null;

        if (!loadedCard) {
          setStatus('not-found');
          return;
        }

        if (!loadedCard.business_id || !loadedCard.owner_user_id) {
          setStatus('not-found');
          return;
        }

        const { data: activeBusiness, error: businessError } = await supabase
          .from('businesses')
          .select('id')
          .eq('id', loadedCard.business_id)
          .eq('owner_user_id', loadedCard.owner_user_id)
          .eq('active', true)
          .maybeSingle();
        if (cancelled) return;
        if (businessError) {
          if (import.meta.env.DEV) console.error('[SmartCardPublic] failed to verify Business Hub', businessError);
          setStatus('error');
          return;
        }
        if (!activeBusiness) {
          setStatus('not-found');
          return;
        }

        setCard(loadedCard);
        setDraftPreview(!loadedCard.is_published);

        if (import.meta.env.DEV) {
          console.log('[SmartCardPublic] booking config', {
            slug,
            booking_enabled: loadedCard.booking_enabled,
            booking_mode: loadedCard.booking_mode,
            booking_request_enabled: loadedCard.booking_request_enabled,
            booking_request_title: loadedCard.booking_request_title,
          });
        }

        const results = await Promise.allSettled([
          supabase
            .from('business_card_links')
            .select('*')
            .eq('business_card_id', loadedCard.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('business_card_offers')
            .select('*')
            .eq('business_card_id', loadedCard.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false }),
          supabase
            .from('business_card_booking_services')
            .select('id, card_id, owner_id, service_id, name, description, duration_minutes, price, currency, booking_url, service_is_active, is_active, sort_order')
            .eq('card_id', loadedCard.id)
            .eq('is_active', true)
            .eq('service_is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('business_card_gallery_items')
            .select('*')
            .eq('card_id', loadedCard.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('business_marketing_assets')
            .select('*')
            .eq('smart_card_id', loadedCard.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('business_card_before_after_items')
            .select('*')
            .eq('card_id', loadedCard.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('business_card_testimonials')
            .select('*')
            .eq('card_id', loadedCard.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('campaign_outputs')
            .select('campaign_id,output_type,enabled,sort_order,metadata,created_at,updated_at,campaigns(*)')
            .eq('output_type', 'smart_card')
            .eq('enabled', true)
            .contains('metadata', { smart_card_id: loadedCard.id })
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false }),
        ]);

        if (cancelled) return;

        const extractRows = <T,>(result: PromiseSettledResult<{ data: T[] | null; error: unknown }>, label: string): T[] => {
          if (result.status !== 'fulfilled') {
            if (import.meta.env.DEV) {
              console.error(`[SmartCardPublic] ${label} request failed`, result.reason);
            }
            return [];
          }

          if (result.value.error) {
            if (import.meta.env.DEV) {
              console.error(`[SmartCardPublic] ${label} query error`, result.value.error);
            }
            return [];
          }

          return (result.value.data ?? []) as T[];
        };

        const linkData = extractRows<BusinessCardLinkRecord>(results[0], 'links');
        const offerData = extractRows<BusinessCardOfferRecord>(results[1], 'offers');
        const bookingServiceData = extractRows<BusinessCardBookingServiceRecord>(results[2], 'booking services');
        const galleryData = extractRows<BusinessCardGalleryRecord>(results[3], 'gallery');
        const assetData = extractRows<BusinessMarketingAssetRecord>(results[4], 'marketing assets');
        const beforeAfterData = extractRows<BusinessCardBeforeAfterRecord>(results[5], 'before-after');
        const testimonialData = extractRows<BusinessCardTestimonialRecord>(results[6], 'testimonials');
        const campaignOutputData = extractRows<CampaignOutputRecord>(results[7], 'smart card campaigns')
          .map(output => normalizeCampaignOutput(output))
          .filter((output): output is SmartCardCampaign => Boolean(output))
          .filter(output => isCampaignPublicNow(output.campaign));

        setLinks(linkData);
        setOffers(offerData);
        setBookingServices(bookingServiceData);
        setGallery(galleryData);
        setMarketingAssets(assetData);
        setBeforeAfterItems(beforeAfterData);
        setTestimonials(testimonialData);
        setSmartCardCampaigns(campaignOutputData);

        if (import.meta.env.DEV) {
          console.log('[SmartCardPublic] booking services', {
            slug,
            servicesCount: bookingServiceData.length,
            services: bookingServiceData,
          });
        }

        setStatus('ready');
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[SmartCardPublic] unexpected load failure', { slug, error });
        }

        if (!cancelled) {
          setStatus('error');
        }
      }
    }

    void loadCard();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (status !== 'ready' || !card || !card.is_published) return;

    void trackEvent(card.id, 'card_view', qrLinkId);
  }, [card, qrLinkId, status]);

  useEffect(() => {
    if (status !== 'ready' || !card || !card.is_published || !currentOffer) return;

    void trackEvent(card.id, 'offer_view', qrLinkId, currentOffer.id);
  }, [card, currentOffer, qrLinkId, status]);

  function handleAction(eventType: BusinessCardEventType, offerId?: string) {
    if (!card || !card.is_published) return;
    void trackEvent(card.id, eventType, qrLinkId, offerId);
  }

  function handleCampaignClick(output: SmartCardCampaign) {
    if (!card || !card.is_published) return;
    void trackEvent(card.id, 'interactive_ad_click', qrLinkId, undefined, {
      campaign_id: output.campaign.id,
      smart_card_id: card.id,
      section: getCampaignSection(output),
    });
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!card || !card.is_published || leadStatus === 'sending') return;

    if (!leadForm.name.trim() || (!leadForm.phone.trim() && !leadForm.email.trim())) {
      setLeadStatus('error');
      return;
    }

    setLeadStatus('sending');
    const { error } = await supabase.from('business_card_leads').insert({
      card_id: card.id,
      owner_id: card.owner_user_id,
      name: leadForm.name.trim(),
      phone: leadForm.phone.trim() || null,
      email: leadForm.email.trim() || null,
      message: leadForm.message.trim() || null,
      lead_type: 'smart_card_inquiry',
      source: qrLinkId ? 'smart_card_qr' : 'smart_card_public',
      metadata: { qr_link_id: qrLinkId, path: window.location.pathname },
    });

    if (error) {
      setLeadStatus('error');
      return;
    }

    setLeadStatus('sent');
    setLeadForm({ name: '', phone: '', email: '', message: '' });
    void trackEvent(card.id, 'lead_submit', qrLinkId);
  }

  async function submitBookingRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!card || !card.is_published || bookingRequestStatus === 'sending') return;

    if (!bookingRequestForm.name.trim() || !bookingRequestForm.preferred_date.trim() || !bookingRequestForm.preferred_time.trim() || (!bookingRequestForm.phone.trim() && !bookingRequestForm.email.trim())) {
      setBookingRequestStatus('error');
      return;
    }

    const selectedService = activeBookingServices.find(service => service.id === bookingRequestForm.service_id) ?? null;
    setBookingRequestStatus('sending');

    const metadata = {
      qr_link_id: qrLinkId,
      path: window.location.pathname,
      service_id: selectedService?.id ?? null,
      business_service_id: selectedService?.service_id ?? null,
      service_name: selectedService?.name ?? null,
      service_duration_minutes: selectedService?.duration_minutes ?? null,
      service_price: selectedService?.price ?? null,
      service_currency: selectedService?.currency ?? null,
      preferred_date: bookingRequestForm.preferred_date,
      preferred_time: bookingRequestForm.preferred_time,
      booking_request: true,
    };

    const { error } = await supabase.from('business_card_leads').insert({
      card_id: card.id,
      owner_id: card.owner_user_id,
      name: bookingRequestForm.name.trim(),
      phone: bookingRequestForm.phone.trim() || null,
      email: bookingRequestForm.email.trim() || null,
      message: bookingRequestForm.message.trim() || null,
      lead_type: 'booking_request',
      source: 'smart_card_booking',
      status: 'new',
      metadata,
    });

    if (error) {
      setBookingRequestStatus('error');
      return;
    }

    setBookingRequestStatus('sent');
    setBookingRequestForm({ service_id: '', preferred_date: '', preferred_time: '', name: '', phone: '', email: '', message: '' });
    void trackEvent(card.id, 'booking_request_submit', qrLinkId);
  }

  function saveContact() {
    if (!card) return;

    handleAction('save_contact');
    const website = safeHttpUrl(card.website);
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${escapeVCardValue(card.business_name)}`,
      card.phone ? `TEL:${escapeVCardValue(card.phone)}` : '',
      card.email ? `EMAIL:${escapeVCardValue(card.email)}` : '',
      website ? `URL:${escapeVCardValue(website)}` : '',
      card.address ? `ADR:;;${escapeVCardValue(card.address)}` : '',
      card.bio ? `NOTE:${escapeVCardValue(card.bio)}` : '',
      'END:VCARD',
    ].filter(Boolean);
    const blob = new Blob([lines.join('\n')], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${card.slug}.vcf`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  if (status !== 'ready' || !card) {
    return <PublicState status={status} />;
  }

  const telHref = safeActionHref(card.phone ? `tel:${card.phone.replace(/[^\d+]/g, '')}` : null) ?? undefined;
  const smsHref = safeActionHref(card.phone ? `sms:${card.phone.replace(/[^\d+]/g, '')}` : null) ?? undefined;
  const mailHref = safeActionHref(card.email ? `mailto:${card.email}` : null) ?? undefined;
  const directionsHref = safeHttpUrl(card.google_maps_url)
    ?? safeHttpUrl(card.address ? `https://maps.google.com/?q=${encodeURIComponent(card.address)}` : null)
    ?? undefined;
  const actions: ActionLink[] = [
    { href: telHref, label: 'Call', eventType: 'call_click', icon: Phone },
    { href: smsHref, label: 'Text', eventType: 'text_click', icon: MessageCircle },
    { href: mailHref, label: 'Email', eventType: 'email_click', icon: Mail },
    { href: safeHttpUrl(card.website) ?? undefined, label: 'Website', eventType: 'website_click', icon: Globe },
    { href: directionsHref, label: 'Directions', eventType: 'directions_click', icon: MapPin },
  ];
  const template = getTemplateOption(card.template);
  const lightMode = template.treatment === 'light';
  const primaryColor = normalizeHexColor(card.primary_color, template.colors[0]);
  const accentColor = normalizeHexColor(card.accent_color, template.colors[1]);
  const displayCard = { ...card, primary_color: primaryColor, accent_color: accentColor };
  const bookingRequestEnabled = Boolean(card.booking_mode === 'request' && card.booking_request_enabled);
  const bookingExternalEnabled = Boolean(card.booking_mode !== 'request' && card.booking_enabled && safeHttpUrl(card.booking_url));
  const supplementalAssets = activeAssets.filter(asset => asset.asset_type !== 'video');

  const landingSections = [
    { key: 'offer', element: currentOffer ? <OfferSection card={displayCard} offer={currentOffer} lightMode={lightMode} /> : null },
    { key: 'promotionCampaigns', element: <CampaignOutputSection title="Interactive Promotions" campaigns={promotionCampaigns} card={displayCard} lightMode={lightMode} onOpen={handleCampaignClick} /> },
    { key: 'booking', element: <BookingSection card={displayCard} lightMode={lightMode} onAction={handleAction} bookingServices={activeBookingServices} bookingRequestForm={bookingRequestForm} bookingRequestStatus={bookingRequestStatus} setBookingRequestForm={setBookingRequestForm} onSubmitBookingRequest={submitBookingRequest} /> },
    { key: 'services', element: <ServicesSection services={activeBookingServices} card={displayCard} lightMode={lightMode} bookingRequestEnabled={bookingRequestEnabled} onBookingClick={() => handleAction('booking_click')} onRequestService={serviceId => { setBookingRequestForm({ ...bookingRequestForm, service_id: serviceId }); document.getElementById('booking-request-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} /> },
    { key: 'about', element: <AboutSection card={displayCard} lightMode={lightMode} /> },
    { key: 'video', element: <FeaturedVideoSection card={displayCard} assets={activeAssets} lightMode={lightMode} onAction={handleAction} /> },
    { key: 'mediaCampaigns', element: <CampaignOutputSection title="Interactive Media" campaigns={mediaCampaigns} card={displayCard} lightMode={lightMode} onOpen={handleCampaignClick} /> },
    { key: 'beforeAfter', element: <BeforeAfterSection items={activeBeforeAfter} lightMode={lightMode} onAction={handleAction} /> },
    { key: 'proofCampaigns', element: <CampaignOutputSection title="Proof & Results" campaigns={proofCampaigns} card={displayCard} lightMode={lightMode} onOpen={handleCampaignClick} /> },
    { key: 'gallery', element: <GallerySection gallery={activeGallery} lightMode={lightMode} /> },
    { key: 'testimonials', element: <TestimonialsSection items={activeTestimonials} card={displayCard} lightMode={lightMode} onAction={handleAction} /> },
    { key: 'leadForm', element: <LeadFormSection card={displayCard} leadForm={leadForm} leadStatus={leadStatus} setLeadForm={setLeadForm} onSubmit={submitLead} lightMode={lightMode} /> },
    { key: 'links', element: <LinksSection links={activeLinks} card={displayCard} lightMode={lightMode} /> },
    { key: 'resources', element: <ResourcesSection assets={supplementalAssets} card={displayCard} lightMode={lightMode} onAction={handleAction} /> },
  ];

  return (
    <main
      className={`min-h-screen pb-24 ${lightMode ? 'text-neutral-950' : 'text-white'}`}
      style={{
        background: lightMode
          ? `radial-gradient(circle at 12% 0%, ${primaryColor}18, transparent 28%), radial-gradient(circle at 88% 4%, ${accentColor}16, transparent 24%), linear-gradient(180deg, #f8fbff 0%, #eef3f7 56%, #e7edf4 100%)`
          : `radial-gradient(circle at 10% 2%, ${primaryColor}30, transparent 26%), radial-gradient(circle at 88% 4%, ${accentColor}20, transparent 23%), linear-gradient(180deg, #040404 0%, #0a0a0a 54%, #070707 100%)`,
      }}
    >
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 lg:px-6">
        {draftPreview && (
          <div className="mx-auto mb-5 max-w-5xl rounded-[1.5rem] border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
            Draft preview: only you can see this Smart Card until it is publicly published.
          </div>
        )}

        <HeroSection card={displayCard} currentOffer={currentOffer} lightMode={lightMode} />

        <div className="mx-auto mt-5 max-w-5xl">
          <ActionHubSection actions={actions} card={displayCard} onAction={handleAction} onSaveContact={saveContact} lightMode={lightMode} bookingRequestEnabled={bookingRequestEnabled} bookingExternalEnabled={bookingExternalEnabled} onOpenBooking={() => document.getElementById('booking-request-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        </div>

        <div className="mx-auto mt-6 max-w-5xl space-y-6">
          {landingSections.map(section => <Fragment key={section.key}>{section.element}</Fragment>)}
        </div>

        <div className="mx-auto mt-8 max-w-5xl">
          <FooterSection lightMode={lightMode} />
        </div>
      </div>
    </main>
  );
}
function HeroSection({ card, currentOffer, lightMode }: { card: BusinessCardRecord; currentOffer: BusinessCardOfferRecord | null; lightMode: boolean }) {
  const coverImageStyle = getImageDisplayStyle({ fit: card.cover_fit, position_x: card.cover_position_x, position_y: card.cover_position_y, zoom: card.cover_zoom });
  const coverOverlayStyle = lightMode ? null : getCoverOverlayStyle(card.cover_overlay_opacity, false);
  const logoImageStyle = getImageDisplayStyle({ fit: card.logo_fit, position_x: card.logo_position_x, position_y: card.logo_position_y, zoom: card.logo_zoom });
  const coverImageUrl = safeHttpUrl(card.cover_image_url);
  const logoImageUrl = safeHttpUrl(card.logo_url);

  return (
    <section className={`mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border shadow-[0_40px_120px_rgba(0,0,0,0.28)] ${lightMode ? 'border-black/10 bg-white' : 'border-white/10 bg-neutral-950'}`}>
      <div className="relative h-[340px] sm:h-[430px]">
        {coverImageUrl ? (
          <img src={coverImageUrl} alt="" className="absolute inset-0 block h-full w-full" style={coverImageStyle} />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }} />
        )}
        {!lightMode && coverOverlayStyle ? <div className="absolute inset-0" style={coverOverlayStyle} /> : null}
        {!lightMode ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" /> : null}
        <div className="absolute -bottom-12 left-5 z-10 sm:left-8 lg:left-10">
          <div className={`h-24 w-24 overflow-hidden rounded-[1.7rem] border-4 shadow-[0_14px_38px_rgba(0,0,0,0.26),0_0_22px_rgba(255,255,255,0.16)] sm:h-28 sm:w-28 ${lightMode ? 'border-white bg-white' : 'border-neutral-950 bg-neutral-900'}`}>
            {logoImageUrl ? (
              <img src={logoImageUrl} alt={`${card.business_name} logo`} className="h-full w-full" style={logoImageStyle} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-black text-black" style={{ background: card.primary_color }}>
                {card.business_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={`relative px-5 pb-6 pt-16 sm:px-8 sm:pb-8 sm:pt-20 lg:px-10 ${lightMode ? 'bg-white text-neutral-950' : 'bg-neutral-950 text-white'}`}>
        <div className="max-w-3xl">
          <h1 className={`text-4xl font-black leading-tight sm:text-5xl ${lightMode ? 'text-neutral-950' : 'text-white'}`}>{card.business_name}</h1>
          {card.tagline && <p className={`mt-2 max-w-2xl text-sm leading-relaxed sm:text-base ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{card.tagline}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {card.address && (
              <span className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${lightMode ? 'border-black/10 bg-black/[0.04] text-neutral-700' : 'border-white/10 bg-white/[0.05] text-neutral-200'}`}>
                <MapPin className="h-4 w-4 flex-none" style={{ color: card.primary_color }} />
                <span className="truncate">{card.address}</span>
              </span>
            )}
            {currentOffer && (
              <span className="inline-flex max-w-full items-center gap-2 rounded-full px-3 py-2 text-xs font-black text-black shadow-sm" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
                <BadgePercent className="h-4 w-4 flex-none" />
                <span className="truncate">{currentOffer.title}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ActionHubSection({ actions, card, onAction, onSaveContact, lightMode, bookingRequestEnabled, bookingExternalEnabled, onOpenBooking }: {
  actions: ActionLink[];
  card: BusinessCardRecord;
  onAction: (eventType: BusinessCardEventType) => void;
  onSaveContact: () => void;
  lightMode: boolean;
  bookingRequestEnabled: boolean;
  bookingExternalEnabled: boolean;
  onOpenBooking: () => void;
}) {
  const bookingLabel = bookingRequestEnabled ? card.booking_request_button_label || 'Request Service' : card.booking_label || 'Book Appointment';
  const bookingUrl = safeHttpUrl(card.booking_url);

  return (
    <section className={`sticky top-3 z-30 rounded-[1.75rem] border px-4 py-3 shadow-[0_18px_55px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:px-5 ${lightMode ? 'border-black/10 bg-white/[0.92] text-neutral-950' : 'border-white/10 bg-neutral-950/90 text-white'}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-black sm:text-lg">Connect</h2>
          <span className={`hidden rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] sm:inline-flex ${lightMode ? 'bg-black/[0.04] text-neutral-500' : 'bg-white/[0.06] text-neutral-300'}`}>Local profile</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:justify-start">
          {actions.map(action => <ActionButton key={action.label} action={action} color={card.primary_color} lightMode={lightMode} onClick={() => onAction(action.eventType)} />)}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onSaveContact} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-black shadow-lg transition-transform active:scale-[0.98]" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
            <Mail className="h-4 w-4" /> Save contact
          </button>
          {bookingRequestEnabled ? (
            <button type="button" onClick={onOpenBooking} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-black shadow-lg transition-transform active:scale-[0.98]" style={{ background: `linear-gradient(135deg, ${card.accent_color}, ${card.primary_color})` }}>
              <CalendarDays className="h-4 w-4" /> {bookingLabel || 'Request Service'}
            </button>
          ) : bookingExternalEnabled && bookingUrl ? (
            <a href={bookingUrl} target="_blank" rel="noreferrer" onClick={() => onAction('booking_click')} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-black shadow-lg transition-transform active:scale-[0.98]" style={{ background: `linear-gradient(135deg, ${card.accent_color}, ${card.primary_color})` }}>
              <CalendarDays className="h-4 w-4" /> {bookingLabel || 'Book Appointment'}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ActionButton({ action, color, lightMode, onClick }: { action: ActionLink; color: string; lightMode: boolean; onClick: () => void }) {
  const Icon = action.icon;
  const href = action.href;
  const disabled = !href;
  const iconShell = `flex h-10 w-10 items-center justify-center rounded-full border transition-transform ${disabled ? (lightMode ? 'border-black/5 bg-black/[0.02]' : 'border-white/5 bg-white/[0.02]') : (lightMode ? 'border-black/10 bg-black/[0.035]' : 'border-white/10 bg-white/[0.07]')}`;
  const className = `group flex min-w-[54px] flex-col items-center justify-center gap-1.5 text-[10px] font-black transition-opacity active:scale-[0.98] ${disabled ? (lightMode ? 'text-neutral-400' : 'text-neutral-600') : (lightMode ? 'text-neutral-800' : 'text-neutral-100')}`;

  if (disabled) {
    return <span className={className}><span className={iconShell}><Icon className="h-4 w-4" /></span>{action.label}</span>;
  }

  return (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onClick={onClick} className={className}>
      <span className={`${iconShell} group-hover:scale-105`}><Icon className="h-4 w-4" style={{ color }} /></span>
      {action.label}
    </a>
  );
}
function ServicesSection({ services, card, lightMode, bookingRequestEnabled, onBookingClick, onRequestService }: {
  services: BusinessCardBookingServiceRecord[];
  card: BusinessCardRecord;
  lightMode: boolean;
  bookingRequestEnabled: boolean;
  onBookingClick: () => void;
  onRequestService: (serviceId: string) => void;
}) {
  if (services.length === 0) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] opacity-55">Services</p>
          <h2 className="text-2xl font-black">What this business can help with</h2>
        </div>
        <p className={`max-w-2xl text-sm ${lightMode ? 'text-neutral-600' : 'text-neutral-300'}`}>Browse the available services and jump straight into a request.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {services.map(service => {
          const serviceBookingUrl = card.booking_enabled && card.booking_mode !== 'request'
            ? safeHttpUrl(service.booking_url)
            : null;
          const price = formatServicePrice(service.price, service.currency);
          return (
            <article key={service.id} className={`rounded-[1.75rem] border p-4 ${lightMode ? 'border-black/10 bg-black/[0.025]' : 'border-white/10 bg-white/[0.04]'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">{service.name}</h3>
                  <div className={`mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold ${lightMode ? 'text-neutral-600' : 'text-neutral-300'}`}>
                    {service.duration_minutes ? <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" style={{ color: card.primary_color }} />{formatDuration(service.duration_minutes)}</span> : null}
                    {price ? <span>{price}</span> : null}
                  </div>
                </div>
                {bookingRequestEnabled ? (
                  <button type="button" onClick={() => onRequestService(service.id)} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>Request this service</button>
                ) : serviceBookingUrl ? (
                  <a href={serviceBookingUrl} target="_blank" rel="noreferrer" onClick={onBookingClick} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
                    Book this service <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
              {service.description ? <p className={`mt-3 text-sm leading-relaxed ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{service.description}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
function FeaturedVideoSection({ card, assets, lightMode, onAction }: { card: BusinessCardRecord; assets: BusinessMarketingAssetRecord[]; lightMode: boolean; onAction: (eventType: BusinessCardEventType) => void }) {
  const videoAsset = assets.find(asset => asset.asset_type === 'video');
  const videoUrl = safeHttpUrl(card.featured_video_enabled ? card.featured_video_url : videoAsset?.external_url || videoAsset?.file_url);
  const thumbnailUrl = safeHttpUrl(videoAsset?.thumbnail_url);
  const title = card.featured_video_enabled ? card.featured_video_title || 'Local Spotlight' : videoAsset?.title || 'Local Spotlight';
  const description = videoAsset?.description || 'Watch the local spotlight';
  const youtubeEmbedUrl = getYouTubeEmbedUrl(videoUrl);
  const directVideoUrl = isDirectVideoUrl(videoUrl) ? videoUrl : null;

  if (!videoUrl) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] opacity-70">
        <Sparkles className="h-4 w-4" style={{ color: card.primary_color }} /> {title}
      </h2>
      {youtubeEmbedUrl ? (
        <div className={`overflow-hidden rounded-3xl border ${lightMode ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.04]'}`}>
          <div className="aspect-video overflow-hidden bg-black">
            <iframe
              src={youtubeEmbedUrl}
              title={title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-bold">
            <span>{description}</span>
            <a href={videoUrl} target="_blank" rel="noreferrer" onClick={() => onAction('media_click')} className="inline-flex items-center gap-2 opacity-70 transition-opacity hover:opacity-100">
              Open <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      ) : directVideoUrl ? (
        <div className={`overflow-hidden rounded-3xl border ${lightMode ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.04]'}`}>
          <video controls playsInline poster={thumbnailUrl ?? undefined} className="aspect-video w-full bg-black" onPlay={() => onAction('media_click')}>
            <source src={directVideoUrl} />
          </video>
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-bold">
            <span>{description}</span>
            <a href={directVideoUrl} target="_blank" rel="noreferrer" onClick={() => onAction('media_click')} className="inline-flex items-center gap-2 opacity-70 transition-opacity hover:opacity-100">
              Open <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      ) : (
        <a href={videoUrl} target="_blank" rel="noreferrer" onClick={() => onAction('media_click')} className={`group block overflow-hidden rounded-3xl border ${lightMode ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.04]'}`}>
          <div className="flex aspect-video items-center justify-center" style={{ background: `linear-gradient(135deg, ${card.primary_color}44, ${card.accent_color}33)` }}>
            {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <Sparkles className={`h-12 w-12 drop-shadow ${lightMode ? 'text-neutral-900' : 'text-white'}`} />}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm font-bold">
            <span>{description}</span>
            <ExternalLink className="h-4 w-4 opacity-60" />
          </div>
        </a>
      )}
    </section>
  );
}

function BookingSection({
  card,
  lightMode,
  onAction,
  bookingServices,
  bookingRequestForm,
  bookingRequestStatus,
  setBookingRequestForm,
  onSubmitBookingRequest,
}: {
  card: BusinessCardRecord;
  lightMode: boolean;
  onAction: (eventType: BusinessCardEventType) => void;
  bookingServices: BusinessCardBookingServiceRecord[];
  bookingRequestForm: BookingRequestFormState;
  bookingRequestStatus: 'idle' | 'sending' | 'sent' | 'error';
  setBookingRequestForm: (value: BookingRequestFormState) => void;
  onSubmitBookingRequest: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isExternal = card.booking_mode !== 'request';
  const bookingUrl = safeHttpUrl(card.booking_url);
  const showExternal = isExternal && card.booking_enabled && !!bookingUrl;
  const showRequest = card.booking_mode === 'request' && card.booking_request_enabled;

  if (!showExternal && !showRequest) return null;

  if (showExternal) {
    return (
      <section className={sectionClass(lightMode)}>
        <h2 className="mb-2 text-sm font-black uppercase tracking-[0.16em] opacity-70">Book or schedule</h2>
        {card.booking_provider && <p className={`mb-3 text-sm ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>Powered by {card.booking_provider}</p>}
        <a href={bookingUrl ?? undefined} target="_blank" rel="noreferrer" onClick={() => onAction('booking_click')} className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
          {card.booking_label || 'Book Now'} <ExternalLink className="h-4 w-4" />
        </a>
      </section>
    );
  }

  return (
    <section id="booking-request-section" className={sectionClass(lightMode)}>
      <h2 className="mb-2 text-sm font-black uppercase tracking-[0.16em] opacity-70">{card.booking_request_title || 'Booking Request'}</h2>
      <p className={`mb-4 text-sm ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>
        {card.booking_request_description || 'Request a preferred appointment time and this business will follow up manually.'}
      </p>
      <form onSubmit={onSubmitBookingRequest} className="space-y-3" aria-busy={bookingRequestStatus === 'sending'} aria-describedby={bookingRequestStatus === 'sent' || bookingRequestStatus === 'error' ? 'booking-request-feedback' : undefined}>
        {bookingServices.length > 0 && (
          <div>
            <label htmlFor="booking-service" className="sr-only">Service</label>
            <select id="booking-service" name="service" className={publicInputClass(lightMode)} value={bookingRequestForm.service_id} onChange={event => setBookingRequestForm({ ...bookingRequestForm, service_id: event.target.value })}>
              <option value="">Select a service</option>
              {bookingServices.map(service => <option key={service.id} value={service.id}>{formatServiceOption(service)}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="booking-date" className="mb-1 block text-xs font-bold opacity-70">Preferred date</label>
            <input id="booking-date" name="preferred-date" className={publicInputClass(lightMode)} type="date" value={bookingRequestForm.preferred_date} onChange={event => setBookingRequestForm({ ...bookingRequestForm, preferred_date: event.target.value })} required aria-invalid={bookingRequestStatus === 'error' && !bookingRequestForm.preferred_date} />
          </div>
          <div>
            <label htmlFor="booking-time" className="mb-1 block text-xs font-bold opacity-70">Preferred time</label>
            <input id="booking-time" name="preferred-time" className={publicInputClass(lightMode)} type="time" value={bookingRequestForm.preferred_time} onChange={event => setBookingRequestForm({ ...bookingRequestForm, preferred_time: event.target.value })} required aria-invalid={bookingRequestStatus === 'error' && !bookingRequestForm.preferred_time} />
          </div>
        </div>
        <label htmlFor="booking-name" className="sr-only">Name</label>
        <input id="booking-name" name="name" autoComplete="name" className={publicInputClass(lightMode)} value={bookingRequestForm.name} onChange={event => setBookingRequestForm({ ...bookingRequestForm, name: event.target.value })} placeholder="Name" required aria-invalid={bookingRequestStatus === 'error' && !bookingRequestForm.name.trim()} />
        <p id="booking-contact-hint" className="text-xs opacity-65">Provide at least a phone number or email address.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label htmlFor="booking-phone" className="sr-only">Phone</label><input id="booking-phone" name="phone" autoComplete="tel" type="tel" aria-describedby="booking-contact-hint" className={publicInputClass(lightMode)} value={bookingRequestForm.phone} onChange={event => setBookingRequestForm({ ...bookingRequestForm, phone: event.target.value })} placeholder="Phone" /></div>
          <div><label htmlFor="booking-email" className="sr-only">Email</label><input id="booking-email" name="email" autoComplete="email" aria-describedby="booking-contact-hint" className={publicInputClass(lightMode)} type="email" value={bookingRequestForm.email} onChange={event => setBookingRequestForm({ ...bookingRequestForm, email: event.target.value })} placeholder="Email" /></div>
        </div>
        <label htmlFor="booking-message" className="sr-only">Additional details</label>
        <textarea id="booking-message" name="message" className={`${publicInputClass(lightMode)} min-h-24 resize-y`} value={bookingRequestForm.message} onChange={event => setBookingRequestForm({ ...bookingRequestForm, message: event.target.value })} placeholder="Optional details for the business" />
        <button type="submit" disabled={bookingRequestStatus === 'sending'} className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
          {bookingRequestStatus === 'sending' ? 'Sending...' : card.booking_request_button_label || 'Request Booking'}
        </button>
        {bookingRequestStatus === 'sent' && <p id="booking-request-feedback" role="status" className="text-center text-xs font-semibold" style={{ color: card.primary_color }}>Booking request sent.</p>}
        {bookingRequestStatus === 'error' && <p id="booking-request-feedback" role="alert" className="text-center text-xs font-semibold text-red-400">Add your name, preferred date/time, and a phone or email.</p>}
      </form>
    </section>
  );
}
function LeadFormSection({ card, leadForm, leadStatus, setLeadForm, onSubmit, lightMode }: { card: BusinessCardRecord; leadForm: LeadFormState; leadStatus: 'idle' | 'sending' | 'sent' | 'error'; setLeadForm: (value: LeadFormState) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; lightMode: boolean }) {
  if (!card.lead_form_enabled) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-2 text-sm font-black uppercase tracking-[0.16em] opacity-70">{card.lead_form_title || 'Request Information'}</h2>
      {card.lead_form_description && <p className={`mb-4 text-sm ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{card.lead_form_description}</p>}
      <form onSubmit={onSubmit} className="space-y-3" aria-busy={leadStatus === 'sending'} aria-describedby={leadStatus === 'sent' || leadStatus === 'error' ? 'lead-form-feedback' : undefined}>
        <label htmlFor="lead-name" className="sr-only">Name</label>
        <input id="lead-name" name="name" autoComplete="name" className={publicInputClass(lightMode)} value={leadForm.name} onChange={event => setLeadForm({ ...leadForm, name: event.target.value })} placeholder="Name" required aria-invalid={leadStatus === 'error' && !leadForm.name.trim()} />
        <p id="lead-contact-hint" className="text-xs opacity-65">Provide at least a phone number or email address.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label htmlFor="lead-phone" className="sr-only">Phone</label><input id="lead-phone" name="phone" autoComplete="tel" type="tel" aria-describedby="lead-contact-hint" className={publicInputClass(lightMode)} value={leadForm.phone} onChange={event => setLeadForm({ ...leadForm, phone: event.target.value })} placeholder="Phone" /></div>
          <div><label htmlFor="lead-email" className="sr-only">Email</label><input id="lead-email" name="email" autoComplete="email" type="email" aria-describedby="lead-contact-hint" className={publicInputClass(lightMode)} value={leadForm.email} onChange={event => setLeadForm({ ...leadForm, email: event.target.value })} placeholder="Email" /></div>
        </div>
        <label htmlFor="lead-message" className="sr-only">How can this business help?</label>
        <textarea id="lead-message" name="message" className={`${publicInputClass(lightMode)} min-h-24 resize-y`} value={leadForm.message} onChange={event => setLeadForm({ ...leadForm, message: event.target.value })} placeholder="What can they help with?" />
        <button type="submit" disabled={leadStatus === 'sending'} className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
          {leadStatus === 'sending' ? 'Sending...' : card.lead_form_button_label || 'Send Request'}
        </button>
        {leadStatus === 'sent' && <p id="lead-form-feedback" role="status" className="text-center text-xs font-semibold" style={{ color: card.primary_color }}>Request sent.</p>}
        {leadStatus === 'error' && <p id="lead-form-feedback" role="alert" className="text-center text-xs font-semibold text-red-400">Add your name and a phone or email.</p>}
      </form>
    </section>
  );
}

function BeforeAfterSection({ items, lightMode, onAction }: { items: BusinessCardBeforeAfterRecord[]; lightMode: boolean; onAction: (eventType: BusinessCardEventType) => void }) {
  const safeItems = items.filter(item => safeHttpUrl(item.before_image_url) && safeHttpUrl(item.after_image_url));
  if (safeItems.length === 0) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.16em] opacity-70">Before and after</h2>
      <div className="space-y-4">
        {safeItems.slice(0, 4).map(item => (
          <div key={item.id}>
            <BeforeAfterComparison item={item} onView={() => onAction('before_after_view')} />
            <p className="mt-2 text-sm font-black">{item.title}</p>
            {item.description && <p className={`text-xs ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{item.description}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function BeforeAfterComparison({ item, onView }: { item: BusinessCardBeforeAfterRecord; onView: () => void }) {
  const [position, setPosition] = useState(50);
  const tracked = useRef(false);
  const beforeImageUrl = safeHttpUrl(item.before_image_url);
  const afterImageUrl = safeHttpUrl(item.after_image_url);

  function trackView() {
    if (tracked.current) return;
    tracked.current = true;
    onView();
  }

  if (!beforeImageUrl || !afterImageUrl) return null;

  return (
    <figure className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-black focus-within:ring-2 focus-within:ring-white focus-within:ring-offset-2 focus-within:ring-offset-black" onMouseEnter={trackView}>
      <img src={afterImageUrl} alt={`${item.title} after`} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img src={beforeImageUrl} alt={`${item.title} before`} className="h-full w-full object-cover" />
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">Before</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">After</span>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-lg" style={{ left: `${position}%` }} />
      <input
        type="range"
        min="0"
        max="100"
        value={position}
        onFocus={trackView}
        onPointerDown={trackView}
        onChange={event => { setPosition(Number(event.target.value)); trackView(); }}
        aria-label={`Compare before and after for ${item.title}`}
        aria-valuetext={`${position}% before, ${100 - position}% after`}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </figure>
  );
}

function TestimonialsSection({ items, card, lightMode, onAction }: { items: BusinessCardTestimonialRecord[]; card: BusinessCardRecord; lightMode: boolean; onAction: (eventType: BusinessCardEventType) => void }) {
  if (items.length === 0) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.16em] opacity-70">Local proof</h2>
      <div className="space-y-3">
        {items.slice(0, 4).map(item => {
          const videoUrl = safeHttpUrl(item.video_url);
          const imageUrl = safeHttpUrl(item.image_url);
          const content = (
            <div className="flex items-start gap-3">
              {imageUrl && <img src={imageUrl} alt="" className="h-12 w-12 rounded-2xl object-cover" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{item.customer_name}</p>
                  {item.rating && <span className="rounded-full px-2 py-1 text-[10px] font-black text-black" style={{ background: card.primary_color }}>{item.rating}/5</span>}
                </div>
                <p className={`mt-1 text-sm leading-relaxed ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{item.quote}</p>
                {item.source && <p className="mt-2 text-[11px] opacity-60">{item.source}</p>}
              </div>
            </div>
          );
          const className = `block rounded-3xl border p-4 ${lightMode ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.05]'}`;
          return videoUrl ? (
            <a key={item.id} href={videoUrl} target="_blank" rel="noreferrer" onClick={() => onAction('testimonial_view')} className={className}>{content}</a>
          ) : (
            <article key={item.id} className={className}>{content}</article>
          );
        })}
      </div>
    </section>
  );
}

function CampaignOutputSection({ title, campaigns, card, lightMode, onOpen }: { title: string; campaigns: SmartCardCampaign[]; card: BusinessCardRecord; lightMode: boolean; onOpen: (output: SmartCardCampaign) => void }) {
  if (campaigns.length === 0) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] opacity-55">Campaign Engine</p>
          <h2 className="text-2xl font-black">{title}</h2>
        </div>
        <p className={`max-w-2xl text-sm ${lightMode ? 'text-neutral-600' : 'text-neutral-300'}`}>Campaigns connected to this local business profile.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {campaigns.map(output => {
          const offer = getCampaignOffer(output);
          return (
            <article key={output.campaign_id} className={`rounded-[1.75rem] border p-4 ${lightMode ? 'border-black/10 bg-black/[0.025]' : 'border-white/10 bg-white/[0.04]'}`}>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
                <Sparkles className="h-3.5 w-3.5" /> {getCampaignFormatLabel(output)}
              </div>
              <h3 className="text-xl font-black leading-tight">{getCampaignTitle(output)}</h3>
              {output.campaign.description ? <p className={`mt-2 text-sm leading-relaxed ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{output.campaign.description}</p> : null}
              {offer ? <p className="mt-3 rounded-2xl border border-current/10 px-3 py-2 text-sm font-black" style={{ color: card.primary_color }}>{offer}</p> : null}
              <Link to={`/ad/${output.campaign.id}`} onClick={() => onOpen(output)} className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
                Open Interactive Ad <ExternalLink className="h-4 w-4" />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
function OfferSection({ card, offer, lightMode }: { card: BusinessCardRecord; offer: BusinessCardOfferRecord | null; lightMode: boolean }) {
  if (!offer) return null;

  const expiresLabel = offer.ends_at ? formatPublicDate(offer.ends_at) : null;
  const ctaGradient = `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})`;
  const glowGradient = `radial-gradient(circle at 12% 12%, ${card.primary_color}, transparent 34%), radial-gradient(circle at 88% 0%, ${card.accent_color}, transparent 32%)`;
  const details = (
    <>
      {expiresLabel ? <AdpadzPill lightMode={lightMode}>Expires {expiresLabel}</AdpadzPill> : null}
      <AdpadzPill lightMode={lightMode}>Show this Smart Card to redeem</AdpadzPill>
    </>
  );
  const action = (
    <AdpadzButton href={`/redeem/${offer.id}`} size="lg" gradient={ctaGradient} className="relative text-black md:min-w-48">
      Claim Offer
    </AdpadzButton>
  );

  return <AdpadzCouponCard title={offer.title} description={offer.description} lightMode={lightMode} gradient={glowGradient} details={details} action={action} />;
}function AboutSection({ card, lightMode }: { card: BusinessCardRecord; lightMode: boolean }) {
  if (!card.bio) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-2 text-sm font-black uppercase tracking-[0.16em] opacity-70">About</h2>
      <p className={`text-sm leading-relaxed ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{card.bio}</p>
    </section>
  );
}

function GallerySection({ gallery, lightMode }: { gallery: BusinessCardGalleryRecord[]; lightMode: boolean }) {
  const safeGallery = gallery
    .map(item => ({ item, imageUrl: safeHttpUrl(item.image_url) }))
    .filter((entry): entry is { item: BusinessCardGalleryRecord; imageUrl: string } => Boolean(entry.imageUrl));
  if (safeGallery.length === 0) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] opacity-70">
        <ImageIcon className="h-4 w-4" /> Gallery
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {safeGallery.slice(0, 6).map(({ item, imageUrl }) => (
          <a key={item.id} href={imageUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-white/10 bg-black/10">
            <div className="aspect-square overflow-hidden">
              <img src={imageUrl} alt={item.caption ?? ''} className="h-full w-full transition-transform duration-300 group-hover:scale-105" style={getImageDisplayStyle({ fit: item.fit, position_x: item.position_x, position_y: item.position_y, zoom: item.zoom })} />
            </div>
            {item.caption && <p className={`px-3 py-2 text-xs ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{item.caption}</p>}
          </a>
        ))}
      </div>
    </section>
  );
}

function LinksSection({ links, card, lightMode }: { links: BusinessCardLinkRecord[]; card: BusinessCardRecord; lightMode: boolean }) {
  const safeLinks = links
    .map(link => ({ link, href: safeHttpUrl(link.url) }))
    .filter((entry): entry is { link: BusinessCardLinkRecord; href: string } => Boolean(entry.href));
  if (safeLinks.length === 0) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] opacity-70">
        <Share2 className="h-4 w-4" style={{ color: card.primary_color }} /> Local links
      </h2>
      <div className="space-y-2">
        {safeLinks.map(({ link, href }) => (
          <a key={link.id} href={href} target="_blank" rel="noreferrer" className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold ${lightMode ? 'border-black/10 bg-black/[0.03] text-neutral-950' : 'border-white/10 bg-white/[0.05] text-white'}`}>
            {link.label}
            <ExternalLink className="h-4 w-4 opacity-50" />
          </a>
        ))}
      </div>
    </section>
  );
}

function ResourcesSection({ assets, card, lightMode, onAction }: { assets: BusinessMarketingAssetRecord[]; card: BusinessCardRecord; lightMode: boolean; onAction: (eventType: BusinessCardEventType) => void }) {
  const resources = assets
    .map(asset => ({ asset, href: safeHttpUrl(asset.external_url) ?? safeHttpUrl(asset.file_url) }))
    .filter((entry): entry is { asset: BusinessMarketingAssetRecord; href: string } => Boolean(entry.href));
  const documents = resources.filter(({ asset }) => ['brochure', 'menu', 'document'].includes(asset.asset_type));
  const tours = resources.filter(({ asset }) => asset.asset_type === 'virtual_tour');

  if (documents.length === 0 && tours.length === 0) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] opacity-55">More to explore</p>
          <h2 className="text-2xl font-black">Menus, guides, and immersive views</h2>
        </div>
        <p className={`max-w-2xl text-sm ${lightMode ? 'text-neutral-600' : 'text-neutral-300'}`}>Helpful resources for visitors who want more detail before reaching out.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {tours.map(({ asset, href }) => (
          <a key={asset.id} href={href} target="_blank" rel="noreferrer" onClick={() => onAction('virtual_tour_click')} className={`group overflow-hidden rounded-[1.75rem] border ${lightMode ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.04]'}`}>
            <div className="relative aspect-[16/10] overflow-hidden">
              {safeHttpUrl(asset.thumbnail_url) ? <img src={safeHttpUrl(asset.thumbnail_url) ?? undefined} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center text-sm font-black text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>Open Tour</div>}
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white"><PlayCircle className="h-4 w-4" /> Virtual Tour</div>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm font-bold"><span>{asset.title}</span><ExternalLink className="h-4 w-4 opacity-60" /></div>
          </a>
        ))}
        {documents.map(({ asset, href }) => (
          <a key={asset.id} href={href} target="_blank" rel="noreferrer" onClick={() => onAction('document_click')} className={`flex items-center justify-between gap-3 rounded-[1.75rem] border px-4 py-4 text-sm font-bold ${lightMode ? 'border-black/10 bg-black/[0.03] text-neutral-950' : 'border-white/10 bg-white/[0.05] text-white'}`}>
            <span className="inline-flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}><FileText className="h-5 w-5" /></span><span className="min-w-0"><span className="block truncate">{asset.title}</span>{asset.description ? <span className={`mt-0.5 block truncate text-xs font-medium ${lightMode ? 'text-neutral-600' : 'text-neutral-400'}`}>{asset.description}</span> : null}</span></span>
            <ExternalLink className="h-4 w-4 flex-none opacity-60" />
          </a>
        ))}
      </div>
    </section>
  );
}

function FooterSection({ lightMode }: { lightMode: boolean }) {
  return <footer className={`px-2 py-4 text-center text-xs leading-relaxed ${lightMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Powered by Adpadz - Local offers, smart QR codes, and community advertising.</footer>;
}
function publicInputClass(lightMode: boolean): string {
  return `w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors ${lightMode ? 'border-black/10 bg-white text-neutral-950 placeholder:text-neutral-400 focus:border-black/30' : 'border-white/10 bg-white/[0.06] text-white placeholder:text-neutral-500 focus:border-white/30'}`;
}

function sectionClass(lightMode: boolean): string {
  return `rounded-[2.05rem] border p-5 shadow-[0_25px_80px_rgba(0,0,0,0.12)] backdrop-blur-xl sm:p-6 ${lightMode ? 'border-black/10 bg-white/82 text-neutral-950 shadow-black/10' : 'border-white/10 bg-neutral-950/74 text-white shadow-black/40'}`;
}

function formatPublicDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatServicePrice(price: number | string | null, currency: string | null): string | null {
  if (price === null) return null;
  const amount = Number(price);
  if (!Number.isFinite(amount)) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  } catch {
    return `${currency ?? ''} ${amount.toFixed(2)}`.trim();
  }
}

function formatServiceOption(service: BusinessCardBookingServiceRecord): string {
  const details = [
    service.duration_minutes ? formatDuration(service.duration_minutes) : null,
    formatServicePrice(service.price, service.currency),
  ].filter((value): value is string => Boolean(value));
  return details.length > 0 ? `${service.name} (${details.join(' · ')})` : service.name;
}

function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const videoId = parsed.pathname.split('/').filter(Boolean)[0];
      return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const watchId = parsed.searchParams.get('v');
      if (watchId) return `https://www.youtube-nocookie.com/embed/${watchId}`;

      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments[0] === 'embed' && segments[1]) return `https://www.youtube-nocookie.com/embed/${segments[1]}`;
      if (segments[0] === 'shorts' && segments[1]) return `https://www.youtube-nocookie.com/embed/${segments[1]}`;
      if (segments[0] === 'live' && segments[1]) return `https://www.youtube-nocookie.com/embed/${segments[1]}`;
    }
  } catch {
    return null;
  }

  return null;
}

function isDirectVideoUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url));
}

function PublicState({ status }: { status: PublicCardState }) {
  const copy = {
    loading: ['Opening smart card...', 'Loading this Adpadz local profile.'],
    ready: ['', ''],
    'not-found': ['Smart card not found', 'This card is unpublished or the link is incorrect.'],
    error: ['Could not load smart card', 'Something went wrong while loading this profile.'],
  }[status];

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-white">
      <div className="card-surface w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neon/10">
          {status === 'loading' ? <Loader2 className="h-7 w-7 animate-spin text-neon" /> : <BadgePercent className="h-7 w-7 text-neon" />}
        </div>
        <h1 className="text-xl font-bold">{copy[0]}</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{copy[1]}</p>
        {status !== 'loading' && <Link to="/" className="btn-primary mt-5 px-5 py-2.5 text-sm">Go to Adpadz</Link>}
      </div>
    </main>
  );
}

async function trackEvent(cardId: string, eventType: BusinessCardEventType, qrLinkId?: string | null, offerId?: string, extraMetadata: Record<string, unknown> = {}) {
  try {
    const { error } = await supabase.from('business_card_events').insert({
      business_card_id: cardId,
      qr_link_id: qrLinkId || null,
      offer_id: offerId || null,
      event_type: eventType,
      user_agent: navigator.userAgent,
      referrer: document.referrer || null,
      metadata: {
        source: 'public_smart_card',
        path: window.location.pathname,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...extraMetadata,
      },
    });

    if (error && import.meta.env.DEV) {
      console.error('[SmartCardPublic] event tracking failed', { eventType, error });
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[SmartCardPublic] event tracking failed', { eventType, error });
    }
  }
}
