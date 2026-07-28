import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, CheckCircle2, ExternalLink, Loader2, Share2, Sparkles, Zap } from 'lucide-react';
import QRStudioPreview from '../../components/qr/QRStudioPreview';
import {
  getCampaignDestination,
  getCampaignFormat,
  getCampaignImage,
  getPublicCampaignExperience,
  listPublicInteractiveCampaigns,
  readSavedCampaignIds,
  trackCampaignEvent,
  writeSavedCampaignIds,
  type CampaignEventType,
  type PublicCampaignExperience,
} from '../../lib/campaigns';
import { copyTextToClipboard } from '../../lib/clipboard';
import { getImageDisplayStyle, normalizeImageFit } from '../../lib/smartCards';
import { buildShortUrl } from '../../lib/qr/qrUtils';
import { buildDestinationCreativeView, CampaignTemplateRenderer } from '../../features/campaign-templates';

export default function AdView() {
  const { adId = '' } = useParams();
  const [experience, setExperience] = useState<PublicCampaignExperience | null>(null);
  const [related, setRelated] = useState<PublicCampaignExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [comparison, setComparison] = useState(50);
  const [saved, setSaved] = useState(() => readSavedCampaignIds().has(adId));
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaign() {
      setLoading(true);
      setError(null);
      setRevealed(false);
      setScratchProgress(0);
      try {
        const campaign = await getPublicCampaignExperience(adId);
        if (!campaign) throw new Error('This campaign is not published or is no longer available.');
        if (cancelled) return;
        setExperience(campaign);

        const storageKey = `adpadz-campaign-view:${campaign.campaign.id}`;
        if (!window.sessionStorage.getItem(storageKey)) {
          window.sessionStorage.setItem(storageKey, '1');
          void recordEvent(campaign, 'view');
        }

        if (campaign.business) {
          const allCampaigns = await listPublicInteractiveCampaigns(20);
          if (!cancelled) {
            setRelated(allCampaigns.filter(item => item.campaign.id !== campaign.campaign.id && item.business?.id === campaign.business?.id).slice(0, 3));
          }
        } else {
          setRelated([]);
        }
      } catch (loadError) {
        if (import.meta.env.DEV) console.error('[AdView] campaign load failed', loadError);
        if (!cancelled) {
          const message = loadError instanceof Error && loadError.message.startsWith('This campaign')
            ? loadError.message
            : 'This campaign could not be loaded right now. Please try again.';
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCampaign();
    return () => { cancelled = true; };
  }, [adId]);

  const format = experience ? getCampaignFormat(experience) : 'tap_reveal';
  const image = experience ? getCampaignImage(experience) : null;
  const destination = experience ? getCampaignDestination(experience) : null;
  const imageMetadata = experience?.output.metadata;
  const qrArtwork = experience?.creativeQrArtwork.qr ?? null;
  const view = experience ? buildDestinationCreativeView({
    metadata: experience.output.metadata,
    destination: 'qr',
    campaign: experience.campaign,
    businessName: experience.business?.business_name,
    businessPhone: experience.business?.phone,
    businessWebsite: experience.business?.website,
    businessLogoUrl: experience.business?.logo_url,
    primaryColor: experience.business?.primary_color,
    accentColor: experience.business?.accent_color,
    assets: experience.creativeAssets,
    qr: qrArtwork,
    qrPublicUrl: qrArtwork ? buildShortUrl(qrArtwork.slug) : null,
    fallbackImageUrl: image,
    fallbackDestinationUrl: absolutePublicUrl(destination),
  }) : null;
  const creative = view?.resolved ?? null;
  const imageStyle = getImageDisplayStyle({
    fit: normalizeImageFit(creative?.settings.imageFit ?? (typeof imageMetadata?.image_fit === 'string' ? imageMetadata.image_fit : undefined)),
    position_x: creative?.settings.imagePositionX ?? asImageNumber(imageMetadata?.image_position_x),
    position_y: creative?.settings.imagePositionY ?? asImageNumber(imageMetadata?.image_position_y),
    zoom: creative?.settings.imageZoom ?? asImageNumber(imageMetadata?.image_zoom),
  });
  const secondaryImage = useMemo(() => {
    const value = experience?.output.metadata?.secondary_image_url;
    return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null;
  }, [experience]);

  function reveal() {
    if (!experience || revealed) return;
    setRevealed(true);
    void recordEvent(experience, 'reveal', { format });
  }

  function advanceScratch(amount: number) {
    setScratchProgress(current => {
      const next = Math.min(100, current + amount);
      if (next >= 70 && !revealed) {
        setRevealed(true);
        if (experience) void recordEvent(experience, 'reveal', { format: 'scratch', scratch_completion: next });
      }
      return next;
    });
  }

  function toggleSave() {
    if (!experience) return;
    const ids = readSavedCampaignIds();
    const nextSaved = !ids.has(experience.campaign.id);
    if (nextSaved) ids.add(experience.campaign.id);
    else ids.delete(experience.campaign.id);
    writeSavedCampaignIds(ids);
    setSaved(nextSaved);
    setNotice(nextSaved ? 'Campaign saved on this device.' : 'Campaign removed from saved items.');
    if (nextSaved) void recordEvent(experience, 'save');
  }

  async function shareCampaign() {
    if (!experience) return;
    const url = window.location.href;
    const title = experience.campaign.headline || experience.campaign.title;
    try {
      if (navigator.share) await navigator.share({ title, text: experience.campaign.description ?? undefined, url });
      else {
        await copyTextToClipboard(url);
        setNotice('Campaign link copied.');
      }
      await recordEvent(experience, 'share');
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setNotice('The campaign link could not be shared.');
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-5 w-5 animate-spin text-neon" /> Loading campaign...</div>;
  }

  if (error || !experience || !view || !creative) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] p-6">
        <div className="card-surface w-full max-w-lg p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-neon" />
          <h1 className="mt-4 text-2xl font-black">Campaign unavailable</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{error ?? 'This campaign could not be found.'}</p>
          <Link to="/feed" className="btn-primary mt-6 px-6 py-3 text-sm"><ArrowLeft className="h-4 w-4" /> Explore local campaigns</Link>
        </div>
      </main>
    );
  }

  const headline = experience.campaign.headline || experience.campaign.title;
  const offer = experience.campaign.offer_title || experience.campaign.offer_description || 'A local offer is waiting for you.';

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-50 border-b safe-top" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <Link to="/feed" className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-white"><ArrowLeft className="h-4 w-4" /> Explore</Link>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => void shareCampaign()} className="rounded-full p-2.5 hover:bg-[var(--bg-hover)]" aria-label="Share campaign"><Share2 className="h-4 w-4 text-[var(--text-secondary)]" /></button>
            <button type="button" onClick={toggleSave} className={`rounded-full p-2.5 hover:bg-[var(--bg-hover)] ${saved ? 'text-neon' : 'text-[var(--text-secondary)]'}`} aria-label={saved ? 'Remove campaign from saved' : 'Save campaign'}><Bookmark className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl pb-12">
        <section className="flex items-center gap-3 px-4 py-4">
          {experience.business?.logo_url ? <img src={experience.business.logo_url} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neon/15 font-black text-neon">{(experience.business?.business_name || headline).charAt(0)}</span>}
          <div>
            {experience.business ? <Link to={`/business/${experience.business.slug}`} className="text-sm font-black hover:text-neon">{experience.business.business_name}</Link> : <p className="text-sm font-black">Featured local campaign</p>}
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Powered by one Adpadz campaign</p>
          </div>
        </section>

        {creative.issues.length > 0 && (
          <div className="mx-4 mb-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100" role="status">
            {creative.issues.join(' ')}
          </div>
        )}

        <section className="relative mx-4 aspect-[3/4] overflow-hidden rounded-[2rem] border border-neon/30 bg-black shadow-[var(--glow-sm)]" aria-live="polite">
          <CampaignTemplateRenderer
            destination={creative.rendererDestination}
            content={view.content}
            settings={creative.renderSettings}
            qrArtwork={qrArtwork ? <QRStudioPreview qr={qrArtwork} /> : undefined}
          />

          {format === 'before_after' && secondaryImage ? (
            <BeforeAfterExperience beforeImage={creative.imageUrl} afterImage={secondaryImage} value={comparison} onChange={value => { setComparison(value); if (value > 70) reveal(); }} headline={headline} imageStyle={imageStyle} />
          ) : !revealed ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-7 text-center">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-neon">{interactionLabel(format)}</p>
              <h1 className="text-3xl font-black leading-tight">{headline}</h1>
              {experience.campaign.description && <p className="mt-3 max-w-sm text-sm leading-relaxed text-neutral-300">{experience.campaign.description}</p>}

              {format === 'scratch' ? (
                <button
                  type="button"
                  onClick={() => advanceScratch(35)}
                  onPointerMove={event => { if (event.buttons > 0) advanceScratch(9); }}
                  className="relative mt-7 h-28 w-28 touch-none overflow-hidden rounded-full border-2 border-neon bg-neon/15 text-neon shadow-[var(--glow-md)]"
                  aria-label={`Scratch to reveal offer. ${scratchProgress}% complete`}
                >
                  <span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(182,255,0,0.35)_0_8px,rgba(255,255,255,0.08)_8px_16px)] transition-[clip-path]" style={{ clipPath: `inset(0 ${scratchProgress}% 0 0)` }} />
                  <span className="relative z-10 text-xs font-black">{scratchProgress > 0 ? `${scratchProgress}%` : 'SCRATCH'}</span>
                </button>
              ) : (
                <button type="button" onClick={reveal} className="mt-7 flex h-28 w-28 items-center justify-center rounded-full border-2 border-neon bg-neon/15 text-neon shadow-[var(--glow-md)] transition hover:scale-105" aria-label="Reveal offer">
                  <Zap className="h-11 w-11" />
                </button>
              )}
              <p className="mt-4 text-xs text-neutral-400">{format === 'scratch' ? 'Drag or tap to scratch' : 'Tap to unlock the offer'}</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/58 p-7 text-center backdrop-blur-[2px]">
              <CheckCircle2 className="h-16 w-16 text-neon" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-neon">You unlocked</p>
              <h2 className="mt-2 text-3xl font-black leading-tight">{offer}</h2>
              {experience.campaign.offer_description && experience.campaign.offer_description !== offer && <p className="mt-3 max-w-sm text-sm text-neutral-300">{experience.campaign.offer_description}</p>}
              {destination ? (
                <a href={destination} target={destination.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onClick={() => void recordEvent(experience, 'cta_click', { destination })} className="btn-primary mt-7 px-7 py-3 text-sm">
                  {experience.campaign.cta_label || 'Visit business'} <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <p className="mt-6 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-xs text-neutral-300">Contact details are being added by this business.</p>
              )}
            </div>
          )}
        </section>

        {notice && <p role="status" className="mx-4 mt-4 rounded-2xl border border-neon/20 bg-neon/[0.07] px-4 py-3 text-center text-xs font-bold text-neon">{notice}</p>}

        <section className="px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-neon">{formatWindow(experience.campaign.start_date, experience.campaign.end_date)}</p>
              <h2 className="mt-2 text-xl font-black">{experience.campaign.offer_title || headline}</h2>
            </div>
            {!revealed && <button type="button" onClick={reveal} className="btn-secondary shrink-0 px-4 py-2 text-xs">Reveal now</button>}
          </div>
          {experience.campaign.description && <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{experience.campaign.description}</p>}
        </section>

        {related.length > 0 && (
          <section className="border-t px-4 py-5" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="mb-3 text-sm font-black">More from {experience.business?.business_name}</h2>
            <div className="grid grid-cols-3 gap-3">
              {related.map(item => (
                <Link key={item.campaign.id} to={`/ad/${item.campaign.id}`} className="min-w-0">
                  <div className="aspect-square overflow-hidden rounded-xl bg-[var(--bg-input)]">{getCampaignImage(item) ? <img src={getCampaignImage(item) ?? ''} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-neon/10" />}</div>
                  <p className="mt-2 truncate text-xs font-bold">{item.campaign.headline || item.campaign.title}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function asImageNumber(value: unknown): number | string | undefined {
  return typeof value === 'number' || typeof value === 'string' ? value : undefined;
}
function BeforeAfterExperience({ beforeImage, afterImage, value, onChange, headline, imageStyle }: { beforeImage: string | null; afterImage: string; value: number; onChange: (value: number) => void; headline: string; imageStyle: ReturnType<typeof getImageDisplayStyle> }) {
  return (
    <div className="absolute inset-0">
      {beforeImage ? <img src={beforeImage} alt="Before" className="absolute inset-0 h-full w-full" style={imageStyle} /> : <div className="absolute inset-0 bg-neutral-900" />}
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${value}%)` }}><img src={afterImage} alt="After" className="h-full w-full object-cover" /></div>
      <div className="absolute inset-y-0 w-0.5 bg-neon shadow-[0_0_16px_rgba(182,255,0,0.9)]" style={{ left: `${value}%` }} />
      <div className="absolute inset-x-5 bottom-5 rounded-2xl bg-black/70 p-4 backdrop-blur">
        <p className="text-sm font-black">{headline}</p>
        <label htmlFor="before-after-slider" className="mt-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neon">Slide to compare</label>
        <input id="before-after-slider" type="range" min="5" max="95" value={value} onChange={event => onChange(Number(event.target.value))} className="mt-2 w-full accent-lime-400" />
      </div>
    </div>
  );
}

function interactionLabel(format: string): string {
  if (format === 'scratch') return 'Scratch to reveal';
  if (format === 'before_after') return 'Tap to see the result';
  return 'Tap to reveal';
}

function formatWindow(start?: string | null, end?: string | null): string {
  if (end) {
    const date = new Date(end);
    if (!Number.isNaN(date.getTime())) return `Available through ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }
  if (start) {
    const date = new Date(start);
    if (!Number.isNaN(date.getTime())) return `Available from ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }
  return 'Available now';
}

async function recordEvent(experience: PublicCampaignExperience, eventType: CampaignEventType, metadata: Record<string, unknown> = {}): Promise<void> {
  try {
    await trackCampaignEvent(experience, eventType, metadata);
  } catch (error) {
    if (import.meta.env.DEV) console.error('[AdView] event tracking failed', error);
  }
}
function absolutePublicUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return null;
  }
}
