import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  BadgePercent,
  CalendarDays,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  getCoverOverlayStyle,
  getCurrentOffer,
  getImageDisplayStyle,
  getTemplateOption,
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
  const [draftPreview, setDraftPreview] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [leadStatus, setLeadStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [bookingRequestForm, setBookingRequestForm] = useState<BookingRequestFormState>({ service_id: '', preferred_date: '', preferred_time: '', name: '', phone: '', email: '', message: '' });
  const [bookingRequestStatus, setBookingRequestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const qrLinkId = searchParams.get('qr') || null;

  const currentOffer = useMemo(() => getCurrentOffer(offers), [offers]);
  const activeBookingServices = useMemo(() => bookingServices.filter(service => service.is_active).sort((a, b) => a.sort_order - b.sort_order), [bookingServices]);
  const activeLinks = useMemo(() => links.filter(link => link.is_active).sort((a, b) => a.sort_order - b.sort_order), [links]);
  const activeGallery = useMemo(() => gallery.filter(item => item.is_active).sort((a, b) => a.sort_order - b.sort_order), [gallery]);
  const activeAssets = useMemo(() => marketingAssets.filter(item => item.is_active).sort((a, b) => a.sort_order - b.sort_order), [marketingAssets]);
  const activeBeforeAfter = useMemo(() => beforeAfterItems.filter(item => item.is_active).sort((a, b) => a.sort_order - b.sort_order), [beforeAfterItems]);
  const activeTestimonials = useMemo(() => testimonials.filter(item => item.is_active).sort((a, b) => a.sort_order - b.sort_order), [testimonials]);

  useEffect(() => {
    let cancelled = false;

    async function loadCard() {
      if (!slug) {
        setStatus('not-found');
        return;
      }

      setStatus('loading');
      setDraftPreview(false);

      const { data, error } = await supabase
        .from('business_cards')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        if (import.meta.env.DEV) {
          console.error('[SmartCardPublic] failed to load card', { slug, error });
        }
        setStatus('error');
        return;
      }

      if (!data) {
        setStatus('not-found');
        return;
      }

      const loadedCard = data as BusinessCardRecord;
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

      const [{ data: linkData }, { data: offerData }, { data: bookingServiceData }, { data: galleryData }, { data: assetData }, { data: beforeAfterData }, { data: testimonialData }] = await Promise.all([
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
          .select('id, card_id, name, description, duration_minutes, is_active, sort_order')
          .eq('card_id', loadedCard.id)
          .eq('is_active', true)
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
      ]);

      if (cancelled) return;

      setLinks((linkData ?? []) as BusinessCardLinkRecord[]);
      setOffers((offerData ?? []) as BusinessCardOfferRecord[]);
      setBookingServices((bookingServiceData ?? []) as BusinessCardBookingServiceRecord[]);
      setGallery((galleryData ?? []) as BusinessCardGalleryRecord[]);

      if (import.meta.env.DEV) {
        console.log('[SmartCardPublic] booking services', {
          slug,
          servicesCount: (bookingServiceData ?? []).length,
          services: bookingServiceData ?? [],
        });
      }
      setMarketingAssets((assetData ?? []) as BusinessMarketingAssetRecord[]);
      setBeforeAfterItems((beforeAfterData ?? []) as BusinessCardBeforeAfterRecord[]);
      setTestimonials((testimonialData ?? []) as BusinessCardTestimonialRecord[]);
      setStatus('ready');
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
      service_name: selectedService?.name ?? null,
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
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${card.business_name}`,
      card.phone ? `TEL:${card.phone}` : '',
      card.email ? `EMAIL:${card.email}` : '',
      card.website ? `URL:${card.website}` : '',
      card.address ? `ADR:;;${card.address}` : '',
      card.bio ? `NOTE:${card.bio}` : '',
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

  const telHref = card.phone ? `tel:${card.phone.replace(/[^\d+]/g, '')}` : undefined;
  const smsHref = card.phone ? `sms:${card.phone.replace(/[^\d+]/g, '')}` : undefined;
  const mailHref = card.email ? `mailto:${card.email}` : undefined;
  const directionsHref = card.google_maps_url || (card.address ? `https://maps.google.com/?q=${encodeURIComponent(card.address)}` : undefined);
  const actions: ActionLink[] = [
    { href: telHref, label: 'Call', eventType: 'call_click', icon: Phone },
    { href: smsHref, label: 'Text', eventType: 'text_click', icon: MessageCircle },
    { href: mailHref, label: 'Email', eventType: 'email_click', icon: Mail },
    { href: card.website ?? undefined, label: 'Web', eventType: 'website_click', icon: Globe },
    { href: directionsHref, label: 'Map', eventType: 'directions_click', icon: MapPin },
  ];
  const template = getTemplateOption(card.template);
  const lightMode = template.treatment === 'light';

  return (
    <main
      className={`min-h-screen pb-28 ${lightMode ? 'text-neutral-950' : 'text-white'}`}
      style={{
        background: lightMode
          ? `radial-gradient(circle at 10% 3%, ${card.primary_color}1f, transparent 30%), radial-gradient(circle at 90% 10%, ${card.accent_color}1c, transparent 26%), linear-gradient(180deg, #f8fbff, #eef3f7 58%, #e7edf4)`
          : `radial-gradient(circle at 10% 3%, ${card.primary_color}33, transparent 28%), radial-gradient(circle at 90% 10%, ${card.accent_color}22, transparent 24%), linear-gradient(180deg, #040404, #0b0b0b 52%, #090909)`,
      }}
    >
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 lg:px-6">
        {draftPreview && (
          <div className="mx-auto mb-5 max-w-5xl rounded-[1.5rem] border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
            Draft preview: only you can see this Smart Card until it is publicly published.
          </div>
        )}

        <HeroSection card={card} currentOffer={currentOffer} lightMode={lightMode} />

        <div className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
          <div className="space-y-5">
            {currentOffer && <OfferSection card={card} offer={currentOffer} lightMode={lightMode} onClaim={offerId => handleAction('offer_claim', offerId)} />}
            <BookingSection card={card} lightMode={lightMode} onAction={handleAction} bookingServices={activeBookingServices} bookingRequestForm={bookingRequestForm} bookingRequestStatus={bookingRequestStatus} setBookingRequestForm={setBookingRequestForm} onSubmitBookingRequest={submitBookingRequest} />
            <LeadFormSection card={card} leadForm={leadForm} leadStatus={leadStatus} setLeadForm={setLeadForm} onSubmit={submitLead} lightMode={lightMode} />
            <AboutSection card={card} lightMode={lightMode} />
            <GallerySection gallery={activeGallery} lightMode={lightMode} />
            <FeaturedVideoSection card={card} assets={activeAssets} lightMode={lightMode} onAction={handleAction} />
            <BeforeAfterSection items={activeBeforeAfter} lightMode={lightMode} onAction={handleAction} />
            <TestimonialsSection items={activeTestimonials} card={card} lightMode={lightMode} onAction={handleAction} />
          </div>
          <div className="space-y-5">
            <ActionsSection actions={actions} card={card} onAction={handleAction} onSaveContact={saveContact} lightMode={lightMode} />
            <DocumentsSection assets={activeAssets} card={card} lightMode={lightMode} onAction={handleAction} />
            <VirtualTourSection assets={activeAssets} card={card} lightMode={lightMode} onAction={handleAction} />
            <LinksSection links={activeLinks} card={card} lightMode={lightMode} />
            <FooterSection lightMode={lightMode} />
          </div>
        </div>
      </div>
    </main>
  );
}
function HeroSection({ card, currentOffer, lightMode }: { card: BusinessCardRecord; currentOffer: BusinessCardOfferRecord | null; lightMode: boolean }) {
  const coverImageStyle = getImageDisplayStyle({ fit: card.cover_fit, position_x: card.cover_position_x, position_y: card.cover_position_y, zoom: card.cover_zoom });
  const coverOverlayStyle = lightMode ? null : getCoverOverlayStyle(card.cover_overlay_opacity, false);
  const logoImageStyle = getImageDisplayStyle({ fit: card.logo_fit, position_x: card.logo_position_x, position_y: card.logo_position_y, zoom: card.logo_zoom });

  return (
    <section className={`mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border shadow-[0_40px_120px_rgba(0,0,0,0.28)] ${lightMode ? 'border-black/10 bg-white' : 'border-white/10 bg-neutral-950'}`}>
      <div className="relative h-[340px] sm:h-[430px]">
        {card.cover_image_url ? (
          <img src={card.cover_image_url} alt="" className="absolute inset-0 block h-full w-full" style={coverImageStyle} />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }} />
        )}
        {!lightMode && coverOverlayStyle ? <div className="absolute inset-0" style={coverOverlayStyle} /> : null}
        {!lightMode ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" /> : null}
        <div className="absolute -bottom-12 left-5 z-10 sm:left-8 lg:left-10">
          <div className={`h-24 w-24 overflow-hidden rounded-[1.7rem] border-4 shadow-2xl sm:h-28 sm:w-28 ${lightMode ? 'border-white bg-white' : 'border-neutral-950 bg-neutral-900'}`}>
            {card.logo_url ? (
              <img src={card.logo_url} alt={`${card.business_name} logo`} className="h-full w-full" style={logoImageStyle} />
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

function ActionsSection({ actions, card, onAction, onSaveContact, lightMode }: { actions: ActionLink[]; card: BusinessCardRecord; onAction: (eventType: BusinessCardEventType) => void; onSaveContact: () => void; lightMode: boolean }) {
  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.16em] opacity-70">Quick actions</h2>
      <div className="grid grid-cols-5 gap-2">
        {actions.map(action => <ActionButton key={action.label} action={action} color={card.primary_color} lightMode={lightMode} onClick={() => onAction(action.eventType)} />)}
      </div>
      <button type="button" onClick={onSaveContact} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black text-black transition-transform active:scale-95" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
        <Mail className="h-4 w-4" /> Save contact
      </button>
    </section>
  );
}

function ActionButton({ action, color, lightMode, onClick }: { action: ActionLink; color: string; lightMode: boolean; onClick: () => void }) {
  const Icon = action.icon;
  const href = action.href;
  const disabled = !href;
  const className = `flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-2xl border text-[9px] font-black transition-transform active:scale-95 ${disabled ? (lightMode ? 'border-black/5 bg-black/[0.02] text-neutral-400' : 'border-white/5 bg-white/[0.02] text-neutral-600') : (lightMode ? 'border-black/10 bg-black/[0.03] text-neutral-950' : 'border-white/10 bg-white/[0.06] text-white')}`;

  if (disabled) {
    return (
      <span className={className}>
        <Icon className="h-5 w-5" />
        {action.label}
      </span>
    );
  }

  return (
    <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onClick={onClick} className={className}>
      <Icon className="h-5 w-5" style={{ color }} />
      {action.label}
    </a>
  );
}
function FeaturedVideoSection({ card, assets, lightMode, onAction }: { card: BusinessCardRecord; assets: BusinessMarketingAssetRecord[]; lightMode: boolean; onAction: (eventType: BusinessCardEventType) => void }) {
  const videoAsset = assets.find(asset => asset.asset_type === 'video');
  const videoUrl = card.featured_video_enabled ? card.featured_video_url : videoAsset?.external_url || videoAsset?.file_url;
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
          <video controls playsInline poster={videoAsset?.thumbnail_url ?? undefined} className="aspect-video w-full bg-black" onPlay={() => onAction('media_click')}>
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
            {videoAsset?.thumbnail_url ? <img src={videoAsset.thumbnail_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <Sparkles className={`h-12 w-12 drop-shadow ${lightMode ? 'text-neutral-900' : 'text-white'}`} />}
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
  const showExternal = isExternal && card.booking_enabled && !!card.booking_url;
  const showRequest = card.booking_mode === 'request' && card.booking_request_enabled;

  if (!showExternal && !showRequest) return null;

  if (showExternal) {
    return (
      <section className={sectionClass(lightMode)}>
        <h2 className="mb-2 text-sm font-black uppercase tracking-[0.16em] opacity-70">Book or schedule</h2>
        {card.booking_provider && <p className={`mb-3 text-sm ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>Powered by {card.booking_provider}</p>}
        <a href={card.booking_url ?? '#'} target="_blank" rel="noreferrer" onClick={() => onAction('booking_click')} className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
          {card.booking_label || 'Book Now'} <ExternalLink className="h-4 w-4" />
        </a>
      </section>
    );
  }

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-2 text-sm font-black uppercase tracking-[0.16em] opacity-70">{card.booking_request_title || 'Booking Request'}</h2>
      <p className={`mb-4 text-sm ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>
        {card.booking_request_description || 'Request a preferred appointment time and this business will follow up manually.'}
      </p>
      <form onSubmit={onSubmitBookingRequest} className="space-y-3">
        {bookingServices.length > 0 && (
          <select
            className={publicInputClass(lightMode)}
            value={bookingRequestForm.service_id}
            onChange={event => setBookingRequestForm({ ...bookingRequestForm, service_id: event.target.value })}
          >
            <option value="">Select a service</option>
            {bookingServices.map(service => (
              <option key={service.id} value={service.id}>
                {service.name}{service.duration_minutes ? ` (${service.duration_minutes} min)` : ''}
              </option>
            ))}
          </select>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            className={publicInputClass(lightMode)}
            type="date"
            value={bookingRequestForm.preferred_date}
            onChange={event => setBookingRequestForm({ ...bookingRequestForm, preferred_date: event.target.value })}
            required
          />
          <input
            className={publicInputClass(lightMode)}
            type="time"
            value={bookingRequestForm.preferred_time}
            onChange={event => setBookingRequestForm({ ...bookingRequestForm, preferred_time: event.target.value })}
            required
          />
        </div>
        <input
          className={publicInputClass(lightMode)}
          value={bookingRequestForm.name}
          onChange={event => setBookingRequestForm({ ...bookingRequestForm, name: event.target.value })}
          placeholder="Name"
          required
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={publicInputClass(lightMode)} value={bookingRequestForm.phone} onChange={event => setBookingRequestForm({ ...bookingRequestForm, phone: event.target.value })} placeholder="Phone" />
          <input className={publicInputClass(lightMode)} type="email" value={bookingRequestForm.email} onChange={event => setBookingRequestForm({ ...bookingRequestForm, email: event.target.value })} placeholder="Email" />
        </div>
        <textarea className={`${publicInputClass(lightMode)} min-h-24 resize-y`} value={bookingRequestForm.message} onChange={event => setBookingRequestForm({ ...bookingRequestForm, message: event.target.value })} placeholder="Optional details for the business" />
        <button type="submit" disabled={bookingRequestStatus === 'sending'} className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
          {bookingRequestStatus === 'sending' ? 'Sending...' : card.booking_request_button_label || 'Request Booking'}
        </button>
        {bookingRequestStatus === 'sent' && <p className="text-center text-xs font-semibold" style={{ color: card.primary_color }}>Booking request sent.</p>}
        {bookingRequestStatus === 'error' && <p className="text-center text-xs font-semibold text-red-400">Add your name, preferred date/time, and a phone or email.</p>}
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
      <form onSubmit={onSubmit} className="space-y-3">
        <input className={publicInputClass(lightMode)} value={leadForm.name} onChange={event => setLeadForm({ ...leadForm, name: event.target.value })} placeholder="Name" required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={publicInputClass(lightMode)} value={leadForm.phone} onChange={event => setLeadForm({ ...leadForm, phone: event.target.value })} placeholder="Phone" />
          <input className={publicInputClass(lightMode)} type="email" value={leadForm.email} onChange={event => setLeadForm({ ...leadForm, email: event.target.value })} placeholder="Email" />
        </div>
        <textarea className={`${publicInputClass(lightMode)} min-h-24 resize-y`} value={leadForm.message} onChange={event => setLeadForm({ ...leadForm, message: event.target.value })} placeholder="What can they help with?" />
        <button type="submit" disabled={leadStatus === 'sending'} className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
          {leadStatus === 'sending' ? 'Sending...' : card.lead_form_button_label || 'Send Request'}
        </button>
        {leadStatus === 'sent' && <p className="text-center text-xs font-semibold" style={{ color: card.primary_color }}>Request sent.</p>}
        {leadStatus === 'error' && <p className="text-center text-xs font-semibold text-red-400">Add your name and a phone or email.</p>}
      </form>
    </section>
  );
}

function BeforeAfterSection({ items, lightMode, onAction }: { items: BusinessCardBeforeAfterRecord[]; lightMode: boolean; onAction: (eventType: BusinessCardEventType) => void }) {
  if (items.length === 0) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.16em] opacity-70">Before and after</h2>
      <div className="space-y-4">
        {items.slice(0, 4).map(item => (
          <div key={item.id}>
            <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-3xl" onMouseEnter={() => onAction('before_after_view')}>
              <img src={item.before_image_url} alt={`${item.title} before`} className="aspect-square w-full object-cover" />
              <img src={item.after_image_url} alt={`${item.title} after`} className="aspect-square w-full object-cover" />
            </div>
            <p className="mt-2 text-sm font-black">{item.title}</p>
            {item.description && <p className={`text-xs ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{item.description}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function TestimonialsSection({ items, card, lightMode, onAction }: { items: BusinessCardTestimonialRecord[]; card: BusinessCardRecord; lightMode: boolean; onAction: (eventType: BusinessCardEventType) => void }) {
  if (items.length === 0) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.16em] opacity-70">Local proof</h2>
      <div className="space-y-3">
        {items.slice(0, 4).map(item => (
          <a key={item.id} href={item.video_url || undefined} target={item.video_url ? '_blank' : undefined} rel="noreferrer" onClick={() => onAction('testimonial_view')} className={`block rounded-3xl border p-4 ${lightMode ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.05]'}`}>
            <div className="flex items-start gap-3">
              {item.image_url && <img src={item.image_url} alt="" className="h-12 w-12 rounded-2xl object-cover" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{item.customer_name}</p>
                  {item.rating && <span className="rounded-full px-2 py-1 text-[10px] font-black text-black" style={{ background: card.primary_color }}>{item.rating}/5</span>}
                </div>
                <p className={`mt-1 text-sm leading-relaxed ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{item.quote}</p>
                {item.source && <p className="mt-2 text-[11px] opacity-60">{item.source}</p>}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function DocumentsSection({ assets, card, lightMode, onAction }: { assets: BusinessMarketingAssetRecord[]; card: BusinessCardRecord; lightMode: boolean; onAction: (eventType: BusinessCardEventType) => void }) {
  const documents = assets.filter(asset => ['brochure', 'menu', 'document'].includes(asset.asset_type));
  if (documents.length === 0) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.16em] opacity-70">Menus and guides</h2>
      <div className="space-y-2">
        {documents.map(asset => (
          <a key={asset.id} href={asset.external_url || asset.file_url || '#'} target="_blank" rel="noreferrer" onClick={() => onAction('document_click')} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold ${lightMode ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.05]'}`}>
            <span>{asset.title}</span>
            <ExternalLink className="h-4 w-4" style={{ color: card.primary_color }} />
          </a>
        ))}
      </div>
    </section>
  );
}

function VirtualTourSection({ assets, card, lightMode, onAction }: { assets: BusinessMarketingAssetRecord[]; card: BusinessCardRecord; lightMode: boolean; onAction: (eventType: BusinessCardEventType) => void }) {
  const tour = assets.find(asset => asset.asset_type === 'virtual_tour');
  if (!tour || (!tour.external_url && !tour.file_url)) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.16em] opacity-70">Virtual tour</h2>
      <a href={tour.external_url || tour.file_url || '#'} target="_blank" rel="noreferrer" onClick={() => onAction('virtual_tour_click')} className="block overflow-hidden rounded-3xl border border-white/10">
        {tour.thumbnail_url ? <img src={tour.thumbnail_url} alt="" className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center text-sm font-black text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>Open Tour</div>}
        <div className={`flex items-center justify-between px-4 py-3 text-sm font-bold ${lightMode ? 'bg-black/[0.03]' : 'bg-white/[0.05]'}`}>
          <span>{tour.title}</span>
          <ExternalLink className="h-4 w-4 opacity-60" />
        </div>
      </a>
    </section>
  );
}
function OfferSection({ card, offer, lightMode, onClaim }: { card: BusinessCardRecord; offer: BusinessCardOfferRecord | null; lightMode: boolean; onClaim: (offerId: string) => void }) {
  if (!offer) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
        <BadgePercent className="h-3.5 w-3.5" /> Local Special
      </div>
      <h2 className="text-3xl font-black leading-tight">{offer.title}</h2>
      {offer.description && <p className={`mt-2 text-sm leading-relaxed ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{offer.description}</p>}
      {offer.claim_url && (
        <a href={offer.claim_url} target="_blank" rel="noreferrer" onClick={() => onClaim(offer.id)} className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-black shadow-lg" style={{ background: `linear-gradient(135deg, ${card.primary_color}, ${card.accent_color})` }}>
          Claim offer <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </section>
  );
}
function AboutSection({ card, lightMode }: { card: BusinessCardRecord; lightMode: boolean }) {
  if (!card.bio) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-2 text-sm font-black uppercase tracking-[0.16em] opacity-70">About</h2>
      <p className={`text-sm leading-relaxed ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{card.bio}</p>
    </section>
  );
}

function GallerySection({ gallery, lightMode }: { gallery: BusinessCardGalleryRecord[]; lightMode: boolean }) {
  if (gallery.length === 0) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] opacity-70">
        <ImageIcon className="h-4 w-4" /> Gallery
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {gallery.slice(0, 6).map(item => (
          <a key={item.id} href={item.image_url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-white/10 bg-black/10">
            <div className="aspect-square overflow-hidden">
              <img src={item.image_url} alt={item.caption ?? ''} className="h-full w-full transition-transform duration-300 group-hover:scale-105" style={getImageDisplayStyle({ fit: item.fit, position_x: item.position_x, position_y: item.position_y, zoom: item.zoom })} />
            </div>
            {item.caption && <p className={`px-3 py-2 text-xs ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{item.caption}</p>}
          </a>
        ))}
      </div>
    </section>
  );
}

function LinksSection({ links, card, lightMode }: { links: BusinessCardLinkRecord[]; card: BusinessCardRecord; lightMode: boolean }) {
  if (links.length === 0) return null;

  return (
    <section className={sectionClass(lightMode)}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] opacity-70">
        <Share2 className="h-4 w-4" style={{ color: card.primary_color }} /> Local links
      </h2>
      <div className="space-y-2">
        {links.map(link => (
          <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold ${lightMode ? 'border-black/10 bg-black/[0.03] text-neutral-950' : 'border-white/10 bg-white/[0.05] text-white'}`}>
            {link.label}
            <ExternalLink className="h-4 w-4 opacity-50" />
          </a>
        ))}
      </div>
    </section>
  );
}

function FooterSection({ lightMode }: { lightMode: boolean }) {
  return (
    <footer className={`rounded-[1.5rem] border px-4 py-5 text-center text-xs leading-relaxed ${lightMode ? 'border-black/10 bg-white/60 text-neutral-600' : 'border-white/10 bg-white/[0.04] text-neutral-400'}`}>
      <Link to="/" className="inline-flex items-center justify-center gap-2 font-semibold">
        <CalendarDays className="h-4 w-4" /> Powered by Adpadz
      </Link>
      <p className="mt-2">Local offers, smart QR codes, and community advertising.</p>
    </footer>
  );
}

function publicInputClass(lightMode: boolean): string {
  return `w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors ${lightMode ? 'border-black/10 bg-white text-neutral-950 placeholder:text-neutral-400 focus:border-black/30' : 'border-white/10 bg-white/[0.06] text-white placeholder:text-neutral-500 focus:border-white/30'}`;
}

function sectionClass(lightMode: boolean): string {
  return `rounded-[2rem] border p-5 shadow-xl ${lightMode ? 'border-black/10 bg-white/80 text-neutral-950 shadow-black/10' : 'border-white/10 bg-neutral-950/74 text-white shadow-black/40'} backdrop-blur-xl`;
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

async function trackEvent(cardId: string, eventType: BusinessCardEventType, qrLinkId?: string | null, offerId?: string) {
  await supabase.from('business_card_events').insert({
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
    },
  });
}



















































