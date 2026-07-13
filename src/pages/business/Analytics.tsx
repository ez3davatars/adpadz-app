import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Eye, Loader2, MousePointerClick, QrCode, RadioTower, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AdpadzBadge, AdpadzCard, AdpadzEmptyState, AdpadzMetricCard, AdpadzSection } from '../../components/adpadz-ui';

type RangeDays = 7 | 30 | 90;
type CampaignSummary = { id: string; title: string; headline: string | null; status: string };
type CampaignEvent = { id: string; campaign_id: string; event_type: string; occurred_at: string };
type CardEvent = { id: string; business_card_id: string | null; event_type: string; occurred_at: string };
type LeadEvent = { id: string; status: string; lead_type: string | null; created_at: string };
type QrLinkSummary = { id: string; title: string; scan_count: number; status: string };
type QrScanEvent = { id: string; qr_link_id: string; scanned_at: string };

type AnalyticsState = {
  campaigns: CampaignSummary[];
  campaignEvents: CampaignEvent[];
  cardEvents: CardEvent[];
  leads: LeadEvent[];
  qrLinks: QrLinkSummary[];
  qrScans: QrScanEvent[];
  loading: boolean;
  error: string | null;
};

const initialState: AnalyticsState = { campaigns: [], campaignEvents: [], cardEvents: [], leads: [], qrLinks: [], qrScans: [], loading: true, error: null };

export default function BizAnalytics() {
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [state, setState] = useState<AnalyticsState>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setState(current => ({ ...current, loading: true, error: null }));
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw new Error(authError.message);
        const userId = authData.user?.id;
        if (!userId) throw new Error('Sign in to load analytics.');

        const since = new Date();
        since.setDate(since.getDate() - rangeDays + 1);
        since.setHours(0, 0, 0, 0);

        const [campaignResult, cardResult, qrResult, leadsResult] = await Promise.all([
          supabase.from('campaigns').select('id,title,headline,status').eq('owner_id', userId),
          supabase.from('business_cards').select('id').eq('owner_user_id', userId),
          supabase.from('qr_links').select('id,title,scan_count,status').eq('owner_user_id', userId),
          supabase.from('business_card_leads').select('id,status,lead_type,created_at').eq('owner_id', userId).gte('created_at', since.toISOString()),
        ]);

        if (campaignResult.error) throw new Error(campaignResult.error.message);
        if (cardResult.error) throw new Error(cardResult.error.message);
        if (qrResult.error) throw new Error(qrResult.error.message);
        if (leadsResult.error) throw new Error(leadsResult.error.message);

        const campaigns = (campaignResult.data ?? []) as CampaignSummary[];
        const campaignIds = campaigns.map(campaign => campaign.id);
        const cardIds = (cardResult.data ?? []).map(card => card.id);

        const qrLinks = (qrResult.data ?? []) as QrLinkSummary[];
        const qrLinkIds = qrLinks.map(link => link.id);
        const [campaignEventsResult, cardEventsResult, qrScansResult] = await Promise.all([
          campaignIds.length > 0
            ? supabase.from('campaign_events').select('id,campaign_id,event_type,occurred_at').in('campaign_id', campaignIds).gte('occurred_at', since.toISOString()).order('occurred_at', { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          cardIds.length > 0
            ? supabase.from('business_card_events').select('id,business_card_id,event_type,occurred_at').in('business_card_id', cardIds).gte('occurred_at', since.toISOString()).order('occurred_at', { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          qrLinkIds.length > 0
            ? supabase.from('qr_scan_events').select('id,qr_link_id,scanned_at').in('qr_link_id', qrLinkIds).gte('scanned_at', since.toISOString()).order('scanned_at', { ascending: true })
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (campaignEventsResult.error) throw new Error(campaignEventsResult.error.message);
        if (cardEventsResult.error) throw new Error(cardEventsResult.error.message);
        if (qrScansResult.error) throw new Error(qrScansResult.error.message);

        if (!cancelled) {
          setState({
            campaigns,
            campaignEvents: (campaignEventsResult.data ?? []) as CampaignEvent[],
            cardEvents: (cardEventsResult.data ?? []) as CardEvent[],
            leads: (leadsResult.data ?? []) as LeadEvent[],
            qrLinks,
            qrScans: (qrScansResult.data ?? []) as QrScanEvent[],
            loading: false,
            error: null,
          });
        }
      } catch (loadError) {
        if (!cancelled) setState(current => ({ ...current, loading: false, error: loadError instanceof Error ? loadError.message : 'Could not load analytics.' }));
      }
    }

    void loadAnalytics();
    return () => { cancelled = true; };
  }, [rangeDays]);

  const metrics = useMemo(() => {
    const campaignViews = state.campaignEvents.filter(event => event.event_type === 'view').length;
    const cardViews = state.cardEvents.filter(event => event.event_type === 'card_view').length;
    const campaignInteractions = state.campaignEvents.filter(event => ['reveal', 'share', 'save'].includes(event.event_type)).length;
    const cardInteractions = state.cardEvents.filter(event => !['card_view', 'qr_scan'].includes(event.event_type)).length;
    const ctaClicks = state.campaignEvents.filter(event => event.event_type === 'cta_click').length
      + state.cardEvents.filter(event => ['call_click', 'text_click', 'email_click', 'website_click', 'directions_click', 'booking_click', 'offer_claim'].includes(event.event_type)).length;
    const qrScans = state.qrScans.length;
    return {
      views: campaignViews + cardViews,
      interactions: campaignInteractions + cardInteractions,
      ctaClicks,
      leads: state.leads.length,
      qrScans,
    };
  }, [state.campaignEvents, state.cardEvents, state.leads, state.qrScans]);

  const daily = useMemo(() => {
    const days = Array.from({ length: rangeDays }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (rangeDays - index - 1));
      return { key: dateKey(date), date, views: 0, interactions: 0, leads: 0 };
    });
    const byKey = new Map(days.map(day => [day.key, day]));
    for (const event of state.campaignEvents) {
      const day = byKey.get(dateKey(new Date(event.occurred_at)));
      if (!day) continue;
      if (event.event_type === 'view') day.views += 1;
      else day.interactions += 1;
    }
    for (const event of state.cardEvents) {
      const day = byKey.get(dateKey(new Date(event.occurred_at)));
      if (!day) continue;
      if (event.event_type === 'card_view') day.views += 1;
      else day.interactions += 1;
    }
    for (const lead of state.leads) {
      const day = byKey.get(dateKey(new Date(lead.created_at)));
      if (day) day.leads += 1;
    }
    for (const scan of state.qrScans) {
      const day = byKey.get(dateKey(new Date(scan.scanned_at)));
      if (day) day.interactions += 1;
    }
    return days;
  }, [rangeDays, state.campaignEvents, state.cardEvents, state.leads, state.qrScans]);

  const campaignPerformance = useMemo(() => state.campaigns.map(campaign => {
    const events = state.campaignEvents.filter(event => event.campaign_id === campaign.id);
    const views = events.filter(event => event.event_type === 'view').length;
    const interactions = events.filter(event => event.event_type !== 'view').length;
    const conversions = events.filter(event => ['cta_click', 'offer_claim'].includes(event.event_type)).length;
    return { campaign, views, interactions, conversions, engagement: views > 0 ? Math.round((interactions / views) * 100) : 0 };
  }).sort((a, b) => b.interactions - a.interactions || b.views - a.views), [state.campaignEvents, state.campaigns]);

  const maxDaily = Math.max(1, ...daily.map(day => Math.max(day.views, day.interactions)));
  const chartDays = rangeDays === 90 ? daily.filter((_, index) => index % 3 === 0 || index === daily.length - 1) : daily;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Measured customer journey</p>
          <h1 className="text-2xl font-black">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Real campaign, Business Profile, lead, and QR activity.</p>
        </div>
        <div className="flex rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] p-1" aria-label="Analytics date range">
          {([7, 30, 90] as RangeDays[]).map(days => <button key={days} type="button" onClick={() => setRangeDays(days)} aria-pressed={rangeDays === days} className={`rounded-full px-4 py-2 text-xs font-black ${rangeDays === days ? 'bg-neon text-black' : 'text-[var(--text-muted)] hover:text-white'}`}>{days}d</button>)}
        </div>
      </div>

      {state.error && <AdpadzCard variant="flat" className="border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{state.error}</AdpadzCard>}
      {state.loading && <p className="flex items-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin text-neon" /> Refreshing analytics...</p>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <AdpadzMetricCard icon={Eye} label="Views" value={String(metrics.views)} detail="Campaign and Business Profile views" />
        <AdpadzMetricCard icon={MousePointerClick} label="Interactions" value={String(metrics.interactions)} detail="Reveals, saves, shares, and profile actions" />
        <AdpadzMetricCard icon={RadioTower} label="CTA actions" value={String(metrics.ctaClicks)} detail="Calls, clicks, bookings, directions, and claims" />
        <AdpadzMetricCard icon={Users} label="Leads" value={String(metrics.leads)} detail="Forms and booking requests" />
        <AdpadzMetricCard icon={QrCode} label="QR scans" value={String(metrics.qrScans)} detail="Attributed Business Profile scans" />
      </div>

      <AdpadzSection eyebrow="Trend" title="Daily customer activity" description={`Last ${rangeDays} days. Empty days remain visible so the chart never invents performance.`}>
        <div className="h-56 overflow-x-auto">
          <div className="flex h-full min-w-[580px] items-end gap-1.5">
            {chartDays.map(day => (
              <div key={day.key} className="flex h-full min-w-2 flex-1 flex-col justify-end gap-1">
                <div className="relative flex flex-1 items-end gap-px" title={`${day.date.toLocaleDateString()}: ${day.views} views, ${day.interactions} interactions, ${day.leads} leads`}>
                  <div className="w-1/2 rounded-t bg-neon/30" style={{ height: `${Math.max(day.views > 0 ? 4 : 0, (day.views / maxDaily) * 100)}%` }} />
                  <div className="w-1/2 rounded-t bg-neon" style={{ height: `${Math.max(day.interactions > 0 ? 4 : 0, (day.interactions / maxDaily) * 100)}%` }} />
                </div>
                <span className="truncate text-center text-[8px] text-[var(--text-muted)]">{day.date.getDate()}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-neon/30" /> Views</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-neon" /> Interactions</span>
        </div>
      </AdpadzSection>

      <AdpadzSection eyebrow="Campaign Engine" title="Campaign performance" description="Every row is calculated from real campaign events.">
        {campaignPerformance.length === 0 ? (
          <AdpadzEmptyState icon={<BarChart3 className="h-7 w-7" />} title="No campaign performance yet" description="Publish an interactive campaign, then its views and interactions will appear here." />
        ) : (
          <div className="space-y-3">
            {campaignPerformance.map(item => (
              <AdpadzCard key={item.campaign.id} as="article" variant="flat" className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-black">{item.campaign.headline || item.campaign.title}</h2>
                      <AdpadzBadge variant="status" className="capitalize">{item.campaign.status}</AdpadzBadge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{item.views} views · {item.interactions} interactions · {item.conversions} conversions</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xl font-black text-neon">{item.engagement}%</p>
                    <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-muted)]">engagement</p>
                  </div>
                </div>
              </AdpadzCard>
            ))}
          </div>
        )}
      </AdpadzSection>
    </div>
  );
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
