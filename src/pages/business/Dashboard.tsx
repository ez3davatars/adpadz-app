import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgePercent, CalendarDays, Image, Plus, QrCode, Sparkles, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzMetricCard, AdpadzSection } from '../../components/adpadz-ui';
import type { CampaignRecord } from '../../lib/ads';

type SmartCardSummary = { id: string; business_name: string; slug: string; is_published: boolean; updated_at: string | null };
type LeadSummary = { id: string; lead_type: string | null; status: string; created_at: string; metadata?: Record<string, unknown> | null };
type EventSummary = { id: string; event_type: string; occurred_at: string };
type QrSummary = { id: string; title: string; scan_count: number; status: string };

type DashboardState = {
  smartCards: SmartCardSummary[];
  campaigns: CampaignRecord[];
  leads: LeadSummary[];
  events: EventSummary[];
  qrLinks: QrSummary[];
  assetsCount: number;
  loading: boolean;
  error: string | null;
};

const initialState: DashboardState = {
  smartCards: [],
  campaigns: [],
  leads: [],
  events: [],
  qrLinks: [],
  assetsCount: 0,
  loading: true,
  error: null,
};

export default function BizDashboard() {
  const [state, setState] = useState<DashboardState>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setState(current => ({ ...current, loading: true, error: null }));
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw new Error(authError.message);
        const userId = authData.user?.id;
        if (!userId) throw new Error('Sign in to load the Business Hub.');

        const smartCardsResult = await supabase
          .from('business_cards')
          .select('id,business_name,slug,is_published,updated_at')
          .eq('owner_user_id', userId)
          .order('updated_at', { ascending: false });
        if (smartCardsResult.error) throw new Error(smartCardsResult.error.message);
        const smartCards = (smartCardsResult.data ?? []) as SmartCardSummary[];
        const cardIds = smartCards.map(card => card.id);

        const [campaignsResult, leadsResult, qrResult, assetsResult, eventsResult] = await Promise.allSettled([
          supabase.from('campaigns').select('*').eq('owner_id', userId).order('updated_at', { ascending: false }).limit(12),
          supabase.from('business_card_leads').select('id,lead_type,status,created_at,metadata').eq('owner_id', userId).order('created_at', { ascending: false }).limit(20),
          supabase.from('qr_links').select('id,title,scan_count,status').eq('owner_user_id', userId).order('updated_at', { ascending: false }),
          supabase.from('business_marketing_assets').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
          cardIds.length > 0
            ? supabase.from('business_card_events').select('id,event_type,occurred_at').in('business_card_id', cardIds).order('occurred_at', { ascending: false }).limit(100)
            : Promise.resolve({ data: [], error: null }),
        ]);

        const readRows = <T,>(result: PromiseSettledResult<{ data: T[] | null; error: unknown }>): T[] => {
          if (result.status !== 'fulfilled' || result.value.error) return [];
          return (result.value.data ?? []) as T[];
        };

        const campaigns = readRows<CampaignRecord>(campaignsResult);
        const leads = readRows<LeadSummary>(leadsResult);
        const qrLinks = readRows<QrSummary>(qrResult);
        const events = readRows<EventSummary>(eventsResult);
        const assetsCount = assetsResult.status === 'fulfilled' && !assetsResult.value.error ? assetsResult.value.count ?? 0 : 0;

        if (!cancelled) {
          setState({ smartCards, campaigns, leads, events, qrLinks, assetsCount, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Could not load Business Hub.' }));
        }
      }
    }

    void loadDashboard();
    return () => { cancelled = true; };
  }, []);

  const businessName = state.smartCards[0]?.business_name ?? 'Business Hub';
  const activeCampaigns = state.campaigns.filter(campaign => campaign.status === 'active');
  const upcomingCampaigns = state.campaigns.filter(campaign => campaign.status === 'scheduled' || (campaign.start_date && new Date(campaign.start_date) > new Date()));
  const bookingLeads = state.leads.filter(lead => lead.lead_type === 'booking_request' || lead.metadata?.booking_request === true);
  const offerClaims = state.events.filter(event => event.event_type === 'offer_claim').length;
  const qrScans = state.qrLinks.reduce((sum, link) => sum + (link.scan_count ?? 0), 0);
  const recentCampaigns = state.campaigns.slice(0, 5);

  const quickActions = useMemo(() => [
    { label: 'Create Campaign', to: '/app/business/create-ad', icon: Plus },
    { label: 'Manage Assets', to: '/app/business/assets', icon: Image },
    { label: 'Open QR Studio', to: '/app/business/qr-studio', icon: QrCode },
    { label: 'Review Leads', to: '/app/business/leads', icon: Users },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Business Hub</p>
          <h1 className="text-2xl font-black">{businessName}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Central view for business assets, campaigns, leads, bookings, QR activity, and offer performance.</p>
        </div>
        <AdpadzButton href="/app/business/create-ad" size="lg"><Plus className="h-4 w-4" /> Create Campaign</AdpadzButton>
      </div>

      {state.error && <AdpadzCard variant="flat" className="border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{state.error}</AdpadzCard>}

      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">What's active</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdpadzMetricCard icon={Sparkles} label="Business Profiles" value={String(state.smartCards.length)} detail={`${state.smartCards.filter(card => card.is_published).length} published Smart Cards`} />
        <AdpadzMetricCard icon={CalendarDays} label="Campaigns" value={String(state.campaigns.length)} detail={`${activeCampaigns.length} active, ${upcomingCampaigns.length} upcoming`} />
        <AdpadzMetricCard icon={Users} label="Leads" value={String(state.leads.length)} detail={`${bookingLeads.length} booking requests in recent leads`} />
        <AdpadzMetricCard icon={QrCode} label="QR Scans" value={String(qrScans)} detail="Total scans from Business Hub QR links" />
      </div>

      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Needs attention</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdpadzMetricCard icon={BadgePercent} label="Offer Claims" value={String(offerClaims)} detail="Tracked from Smart Card offer interactions" />
        <AdpadzMetricCard icon={Image} label="Assets" value={String(state.assetsCount)} detail="Images, videos, documents, menus, and future hub assets" />
        <AdpadzMetricCard icon={CalendarDays} label="Bookings" value={String(bookingLeads.length)} detail="Booking requests captured as leads" />
        <AdpadzMetricCard icon={Users} label="New Leads" value={String(state.leads.filter(lead => lead.status === 'new').length)} detail="Unworked leads in the Lead Manager" />
      </div>

      <AdpadzSection eyebrow="Business Hub" title="Quick actions">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map(action => (
            <Link key={action.to} to={action.to} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-neon/50 hover:bg-neon/5">
              <action.icon className="mb-3 h-5 w-5 text-neon" />
              <p className="text-sm font-black">{action.label}</p>
            </Link>
          ))}
        </div>
      </AdpadzSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdpadzSection eyebrow="Campaign Engine" title="Recent campaigns" description="Campaigns are the single source of truth for promotions.">
          <div className="space-y-3">
            {recentCampaigns.length > 0 ? recentCampaigns.map(campaign => <CampaignRow key={campaign.id} campaign={campaign} />) : <EmptyLine text={state.loading ? 'Loading campaigns...' : 'No campaigns yet. Create one campaign and publish it everywhere.'} />}
          </div>
        </AdpadzSection>

        <AdpadzSection eyebrow="Schedule" title="Upcoming Campaigns" description="Scheduled campaigns stay in Campaign Engine and can power many outputs.">
          <div className="space-y-3">
            {upcomingCampaigns.length > 0 ? upcomingCampaigns.slice(0, 5).map(campaign => <CampaignRow key={campaign.id} campaign={campaign} />) : <EmptyLine text={state.loading ? 'Loading schedule...' : 'No upcoming campaigns scheduled.'} />}
          </div>
        </AdpadzSection>
      </div>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: CampaignRecord }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black">{campaign.title}</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{formatCampaignWindow(campaign)}</p>
      </div>
      <AdpadzBadge variant="status" className="capitalize">{campaign.status}</AdpadzBadge>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-[var(--text-muted)]">{text}</p>;
}

function formatCampaignWindow(campaign: CampaignRecord): string {
  const start = campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : 'No start date';
  const end = campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : 'No end date';
  return `${start} - ${end}`;
}

