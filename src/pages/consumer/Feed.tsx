import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Heart, Loader2, MapPin, Search, Share2, Sparkles } from 'lucide-react';
import AdpadzBrand from '../../components/AdpadzBrand';
import {
  getCampaignFormat,
  getCampaignImage,
  listPublicInteractiveCampaigns,
  readSavedCampaignIds,
  trackCampaignEvent,
  writeSavedCampaignIds,
  type PublicCampaignExperience,
} from '../../lib/campaigns';
import { copyTextToClipboard } from '../../lib/clipboard';

const filters = [
  { value: 'all', label: 'All' },
  { value: 'tap_reveal', label: 'Tap to reveal' },
  { value: 'scratch', label: 'Scratch & win' },
  { value: 'before_after', label: 'Before & after' },
] as const;

export default function Feed() {
  const [campaigns, setCampaigns] = useState<PublicCampaignExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('all');
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState<Set<string>>(() => readSavedCampaignIds());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaigns() {
      setLoading(true);
      setError(null);
      try {
        const rows = await listPublicInteractiveCampaigns();
        if (!cancelled) setCampaigns(rows);
      } catch (loadError) {
        if (import.meta.env.DEV) console.error('[Feed] campaign load failed', loadError);
        if (!cancelled) setError('Local campaigns could not be loaded right now. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCampaigns();
    return () => { cancelled = true; };
  }, []);

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return campaigns.filter(experience => {
      const matchesFormat = filter === 'all' || getCampaignFormat(experience) === filter;
      const matchesQuery = !query || [
        experience.campaign.title,
        experience.campaign.headline,
        experience.campaign.description,
        experience.campaign.offer_title,
        experience.business?.business_name,
      ].some(value => value?.toLocaleLowerCase().includes(query));
      return matchesFormat && matchesQuery;
    });
  }, [campaigns, filter, search]);

  function toggleSave(experience: PublicCampaignExperience) {
    setSaved(current => {
      const next = new Set(current);
      const willSave = !next.has(experience.campaign.id);
      if (willSave) next.add(experience.campaign.id);
      else next.delete(experience.campaign.id);
      writeSavedCampaignIds(next);
      setNotice(willSave ? 'Campaign saved on this device.' : 'Campaign removed from saved items.');
      if (willSave) void trackCampaignEvent(experience, 'save').catch(() => undefined);
      return next;
    });
  }

  async function shareCampaign(experience: PublicCampaignExperience) {
    const url = `${window.location.origin}/ad/${experience.campaign.id}`;
    const title = experience.campaign.headline || experience.campaign.title;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: experience.campaign.description ?? undefined, url });
      } else {
        await copyTextToClipboard(url);
        setNotice('Campaign link copied.');
      }
      await trackCampaignEvent(experience, 'share');
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setNotice('The campaign link could not be shared.');
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
      <header className="sticky top-0 z-50 border-b safe-top" style={{ background: 'color-mix(in srgb, var(--bg-surface) 94%, transparent)', borderColor: 'var(--border-subtle)', backdropFilter: 'blur(18px)' }}>
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <AdpadzBrand compact />
          <div className="relative min-w-0 flex-1">
            <label htmlFor="campaign-search" className="sr-only">Search local campaigns</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input id="campaign-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search local campaigns" className="input-field h-10 pl-9" />
          </div>
          <Link to="/auth" className="btn-secondary hidden px-3 py-2 text-xs sm:inline-flex">For business</Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <section className="mb-6 overflow-hidden rounded-[2rem] border border-neon/20 bg-neon/[0.055] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neon">Discover local</p>
          <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">Offers worth leaving the house for.</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">Explore live campaigns from participating local businesses, unlock offers, and go straight to the business when you are ready.</p>
        </section>

        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Campaign filters">
          {filters.map(item => (
            <button key={item.value} type="button" onClick={() => setFilter(item.value)} aria-pressed={filter === item.value} className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition ${filter === item.value ? 'border-neon bg-neon text-black' : 'border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-neon/50 hover:text-white'}`}>
              {item.label}
            </button>
          ))}
        </div>

        {notice && (
          <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-neon/20 bg-neon/[0.07] px-4 py-3 text-xs font-bold text-neon">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-white/70" aria-label="Dismiss notification">Close</button>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <p className="font-bold">Local campaigns are unavailable.</p>
            <p className="mt-1 text-xs opacity-80">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-[var(--text-muted)]"><Loader2 className="mr-2 h-5 w-5 animate-spin text-neon" /> Loading local campaigns...</div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="card-surface px-6 py-14 text-center">
            <Sparkles className="mx-auto h-9 w-9 text-neon" />
            <h2 className="mt-4 text-lg font-black">No matching campaigns yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--text-muted)]">Try another search or filter. Published campaigns with an interactive output will appear here automatically.</p>
            <Link to="/demo/workspace?view=customer" className="btn-primary mt-6 px-5 py-2.5 text-xs">Explore the working demo</Link>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredCampaigns.map(experience => {
              const image = getCampaignImage(experience);
              const format = getCampaignFormat(experience);
              const isSaved = saved.has(experience.campaign.id);
              return (
                <article key={experience.campaign.id} className="card-surface overflow-hidden">
                  <div className="flex items-center gap-3 p-4 pb-3">
                    {experience.business?.logo_url ? <img src={experience.business.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neon/15 font-black text-neon">{(experience.business?.business_name || experience.campaign.title).charAt(0)}</span>}
                    <div className="min-w-0 flex-1">
                      {experience.business ? <Link to={`/business/${experience.business.slug}`} className="text-sm font-black hover:text-neon">{experience.business.business_name}</Link> : <p className="text-sm font-black">Local campaign</p>}
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-muted)]"><MapPin className="h-3 w-3" /> Local offer</p>
                    </div>
                    <span className="badge badge-active text-[10px] capitalize">{format.replace(/_/g, ' ')}</span>
                  </div>

                  <Link to={`/ad/${experience.campaign.id}`} aria-label={`Open ${experience.campaign.headline || experience.campaign.title}`}>
                    <div className="group relative aspect-[4/3] overflow-hidden bg-[var(--bg-input)]">
                      {image ? <img src={image} alt="" className="h-full w-full object-cover opacity-80 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-100" /> : <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(182,255,0,0.22),transparent_40%),linear-gradient(145deg,#171a18,#070807)]" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5">
                        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-neon">{formatLabel(format)}</p>
                        <h2 className="text-xl font-black">{experience.campaign.headline || experience.campaign.title}</h2>
                        {experience.campaign.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-300">{experience.campaign.description}</p>}
                      </div>
                      <span className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-neon/40 bg-black/50 text-neon shadow-[var(--glow-sm)]"><Sparkles className="h-5 w-5" /></span>
                    </div>
                  </Link>

                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-neon">{experience.campaign.offer_title || 'Tap to discover the offer'}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{formatWindow(experience.campaign.start_date, experience.campaign.end_date)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => void shareCampaign(experience)} className="rounded-full p-2.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-neon" aria-label={`Share ${experience.campaign.title}`}><Share2 className="h-4 w-4" /></button>
                      <button type="button" onClick={() => toggleSave(experience)} className={`rounded-full p-2.5 hover:bg-[var(--bg-hover)] ${isSaved ? 'text-neon' : 'text-[var(--text-secondary)] hover:text-neon'}`} aria-label={isSaved ? `Remove ${experience.campaign.title} from saved` : `Save ${experience.campaign.title}`}><Bookmark className="h-4 w-4" fill={isSaved ? 'currentColor' : 'none'} /></button>
                      <Link to={`/ad/${experience.campaign.id}`} className="ml-1 inline-flex items-center gap-1 rounded-full bg-neon px-4 py-2 text-xs font-black text-black"><Heart className="h-3.5 w-3.5" /> Open</Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function formatLabel(format: string): string {
  switch (format) {
    case 'scratch': return 'Scratch & reveal';
    case 'before_after': return 'Slide to compare';
    default: return 'Tap to reveal';
  }
}

function formatWindow(start?: string | null, end?: string | null): string {
  const now = new Date();
  if (end) {
    const endDate = new Date(end);
    if (!Number.isNaN(endDate.getTime())) return `Ends ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }
  if (start) {
    const startDate = new Date(start);
    if (!Number.isNaN(startDate.getTime()) && startDate > now) return `Starts ${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }
  return 'Available now';
}
