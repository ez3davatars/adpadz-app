import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Copy, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { copyTextToClipboard } from '../../lib/clipboard';
import { isUuid } from '../../lib/ids';
import { safeHttpUrl } from '../../lib/urls';

type OfferRecord = {
  id: string;
  business_card_id: string;
  title: string;
  description: string | null;
  claim_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  claim_count: number;
  business_cards: BusinessCardSummary | BusinessCardSummary[] | null;
};

type BusinessCardSummary = {
  id: string;
  business_id: string | null;
  business_name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
};

export default function RedeemOffer() {
  const { offerId = '' } = useParams();
  const [offer, setOffer] = useState<OfferRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [claimed, setClaimed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOffer() {
      setLoading(true);
      setError(null);
      try {
        if (!isUuid(offerId)) throw new Error('This offer link is invalid or no longer available.');

        const { data, error: offerError } = await supabase
          .from('business_card_offers')
          .select('id,business_card_id,title,description,claim_url,starts_at,ends_at,claim_count,business_cards!inner(id,business_id,business_name,slug,logo_url,cover_image_url)')
          .eq('id', offerId)
          .eq('is_active', true)
          .maybeSingle();
        if (offerError) {
          if (import.meta.env.DEV) console.error('[RedeemOffer] offer load failed', offerError);
          throw new Error('This offer could not be loaded right now. Please try again.');
        }
        if (!data) throw new Error('This offer is not published or has expired.');
        if (cancelled) return;

        const loaded = data as unknown as OfferRecord;
        setOffer(loaded);
        const storedCode = window.localStorage.getItem(`adpadz-offer-code:${offerId}`);
        if (storedCode) {
          setCode(storedCode);
          setClaimed(true);
        }

        const viewKey = `adpadz-offer-view:${offerId}`;
        if (!window.sessionStorage.getItem(viewKey)) {
          window.sessionStorage.setItem(viewKey, '1');
          void supabase.from('business_card_events').insert({ business_card_id: loaded.business_card_id, offer_id: loaded.id, event_type: 'offer_view', user_agent: navigator.userAgent, referrer: document.referrer || null, metadata: { source: 'offer_page' } });
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load this offer.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOffer();
    return () => { cancelled = true; };
  }, [offerId]);

  async function claimOffer() {
    if (!offer || claimed) return;
    setClaiming(true);
    setError(null);
    try {
      const redemptionCode = createRedemptionCode(offer.id);
      const { error: claimError } = await supabase.from('business_card_events').insert({
        business_card_id: offer.business_card_id,
        offer_id: offer.id,
        event_type: 'offer_claim',
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
        metadata: { source: 'offer_page', redemption_code: redemptionCode },
      });
      if (claimError) throw new Error(claimError.message);
      window.localStorage.setItem(`adpadz-offer-code:${offer.id}`, redemptionCode);
      setCode(redemptionCode);
      setClaimed(true);
    } catch (claimError) {
      if (import.meta.env.DEV) console.error('[RedeemOffer] claim failed', claimError);
      setError('This offer could not be claimed right now. Please try again.');
    } finally {
      setClaiming(false);
    }
  }

  async function copyCode() {
    try {
      await copyTextToClipboard(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy the redemption code.');
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-5 w-5 animate-spin text-neon" /> Loading offer...</div>;
  if (error && !offer) return <main className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] p-6"><div className="card-surface max-w-md p-8 text-center"><Sparkles className="mx-auto h-9 w-9 text-neon" /><h1 className="mt-4 text-2xl font-black">Offer unavailable</h1><p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p><Link to="/feed" className="btn-primary mt-6 px-6 py-3 text-sm">Explore local campaigns</Link></div></main>;
  if (!offer) return null;

  const card = Array.isArray(offer.business_cards) ? offer.business_cards[0] : offer.business_cards;
  const daysLeft = offer.ends_at ? Math.ceil((new Date(offer.ends_at).getTime() - Date.now()) / 86_400_000) : null;
  const claimUrl = safeHttpUrl(offer.claim_url);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-50 border-b safe-top" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link to={card ? `/business/${card.slug}` : '/feed'} className="rounded-full p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
          <span className="text-sm font-black">Claim local offer</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-7">
        <div className="card-glass overflow-hidden p-0 text-center">
          {card?.cover_image_url && <img src={card.cover_image_url} alt="" className="h-40 w-full object-cover opacity-80" />}
          <div className="p-6">
            {card?.logo_url ? <img src={card.logo_url} alt="" className="mx-auto -mt-14 h-16 w-16 rounded-2xl border-4 border-[var(--bg-card)] object-cover" /> : <span className="mx-auto -mt-14 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-[var(--bg-card)] bg-neon text-xl font-black text-black">{card?.business_name.charAt(0) || 'A'}</span>}
            <p className="mt-3 text-xs font-bold text-[var(--text-muted)]">{card?.business_name || 'Local business'}</p>
            <h1 className="mt-2 text-2xl font-black">{offer.title}</h1>
            {offer.description && <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">{offer.description}</p>}
            <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-[var(--text-muted)]">
              {daysLeft !== null && <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2"><Clock className="h-3.5 w-3.5 text-neon" /> {daysLeft > 0 ? `${daysLeft} days left` : 'Ends today'}</span>}
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">{offer.claim_count} claimed</span>
            </div>
          </div>
        </div>

        {error && <p role="alert" className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</p>}

        {!claimed ? (
          <div className="mt-6 text-center">
            <button type="button" onClick={() => void claimOffer()} disabled={claiming} className="btn-primary w-full px-8 py-4 text-base">{claiming ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Claim this offer</button>
            <p className="mt-3 text-xs text-[var(--text-muted)]">A stable redemption code will be saved on this device and recorded for the business.</p>
          </div>
        ) : (
          <div className="card-surface mt-6 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-neon" />
            <p className="mt-3 text-sm font-black text-neon">Offer claimed</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Show this code to the business:</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="rounded-xl border border-neon/40 bg-[var(--bg-input)] px-5 py-3 font-mono text-lg font-black tracking-wider text-neon">{code}</div>
              <button type="button" onClick={() => void copyCode()} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 hover:border-neon/50" aria-label="Copy redemption code"><Copy className="h-4 w-4 text-[var(--text-secondary)]" /></button>
            </div>
            {copied && <p role="status" className="mt-2 text-xs font-bold text-neon">Copied</p>}
            {claimUrl && <a href={claimUrl} target="_blank" rel="noreferrer" className="btn-secondary mt-5 w-full py-3 text-sm">Use offer online <ExternalLink className="h-4 w-4" /></a>}
          </div>
        )}

        {card && <Link to={`/business/${card.slug}`} className="btn-secondary mt-4 w-full py-3 text-sm">Visit {card.business_name} <ExternalLink className="h-4 w-4" /></Link>}
      </main>
    </div>
  );
}

function createRedemptionCode(offerId: string): string {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `ADP-${offerId.replace(/-/g, '').slice(0, 4).toUpperCase()}-${random}`;
}
