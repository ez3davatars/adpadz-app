import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgePercent, CalendarDays, Image, Loader2, Plus, QrCode, Sparkles, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzMetricCard, AdpadzSection } from '../../components/adpadz-ui';
import type { CampaignRecord } from '../../lib/ads';

type SmartCardSummary = { id: string; business_name: string; slug: string; is_published: boolean; updated_at: string | null };
type LeadSummary = { id: string; lead_type: string | null; status: string; created_at: string; metadata?: Record<string, unknown> | null };
type QrSummary = { id: string; title: string; scan_count: number; status: string };
type DashboardTotals = { leads: number; newLeads: number; bookings: number; offerClaims: number };

type DashboardState = {
  businessName: string;
  smartCards: SmartCardSummary[];
  campaigns: CampaignRecord[];
  leads: LeadSummary[];
  qrLinks: QrSummary[];
  assetsCount: number;
  totals: DashboardTotals;
  loading: boolean;
  error: string | null;
};

const initialState: DashboardState = {
  businessName: 'Business Hub',
  smartCards: [],
  campaigns: [],
  leads: [],
  qrLinks: [],
  assetsCount: 0,
  totals: { leads: 0, newLeads: 0, bookings: 0, offerClaims: 0 },
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

        const [businessResult, cardsResult, campaignsResult, leadsResult, qrResult, assetsResult, leadCountResult, newLeadCountResult, bookingCountResult] = await Promise.all([
          supabase.from('businesses').select('name').eq('owner_user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('business_cards').select('id,business_name,slug,is_published,updated_at').eq('owner_user_id', userId).order('updated_at', { ascending: false }),
          supabase.from('campaigns').select('*').eq('owner_id', userId).order('updated_at', { ascending: false }),
          supabase.from('business_card_leads').select('id,lead_type,status,created_at,metadata').eq('owner_id', userId).order('created_at', { ascending: false }).limit(20),
          supabase.from('qr_links').select('id,title,scan_count,status').eq('owner_user_id', userId).order('updated_at', { ascending: false }),
          supabase.from('business_marketing_assets').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('is_active', true),
          supabase.from('business_card_leads').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
          supabase.from('business_card_leads').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('status', 'new'),
          supabase.from('business_card_leads').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('lead_type', 'booking_request'),
        ]);

        const firstError = [businessResult.error, cardsResult.error, campaignsResult.error, leadsResult.error, qrResult.error, assetsResult.error, leadCountResult.error, newLeadCountResult.error, bookingCountResult.error].find(Boolean);
        if (firstError) throw new Error(firstError.message);

        const smartCards = (cardsResult.data ?? []) as SmartCardSummary[];
        const cardIds = smartCards.map(card => card.id);
        const offerClaimResult = cardIds.length > 0
          ? await supabase.from('business_card_events').select('id', { count: 'exact', head: true }).in('business_card_id', cardIds).eq('event_type', 'offer_claim')
          : { count: 0, error: null };
        if (offerClaimResult.error) throw new Error(offerClaimResult.error.message);

        if (!cancelled) {
          setState({
            businessName: businessResult.data?.name || smartCards[0]?.business_name || 'Business Hub',
            smartCards,
            campaigns: (campaignsResult.data ?? []) as CampaignRecord[],
            leads: (leadsResult.data ?? []) as LeadSummary[],
            qrLinks: (qrResult.data ?? []) as QrSummary[],
            assetsCount: assetsResult.count ?? 0,
            totals: {
              leads: leadCountResult.count ?? 0,
              newLeads: newLeadCountResult.count ?? 0,
              bookings: bookingCountResult.count ?? 0,
              offerClaims: offerClaimResult.count ?? 0,
            },
            loading: false,
            error: null,
          });
        }
      } catch (loadError) {
        if (!cancelled) setState(current => ({ ...current, loading: false, error: loadError instanceof Error ? loadError.message : 'Could not load Business Hub.' }));
      }
    }

    void loadDashboard();
    return () => { cancelled = true; };
  }, []);

  const activeCampaigns = state.campaigns.filter(campaign => campaign.status === 'active');
  const upcomingCampaigns = state.campaigns.filter(campaign => campaign.status === 'scheduled' || (campaign.start_date && new Date(campaign.start_date) > new Date()));
  const qrScans = state.qrLinks.reduce((sum, link) => sum + (link.scan_count ?? 0), 0);
  const recentCampaigns = state.campaigns.slice(0, 5);
  const recentLeads = state.leads.slice(0, 5);

  const quickActions = useMemo(() => [
    { label: 'Create Campaign', to: '/app/business/create-ad', icon: Plus },
    { label: 'Manage Assets', to: '/app/business/assets', icon: Image },
    { label: 'Open QR Studio', to: '/app/business/qr-studio', icon: QrCode },
    { label: 'Review Leads', to: '/app/business/leads', icon: Users },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Business Hub</p>
          <h1 className="text-2xl font-black">{state.businessName}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">What is active, what needs attention, and what to do next.</p>
        </div>
        <AdpadzButton href="/app/business/create-ad" size="lg"><Plus className="h-4 w-4" /> Create Campaign</AdpadzButton>
      </div>

      {state.error && <AdpadzCard variant="flat" className="border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{state.error}</AdpadzCard>}
      {state.loading && <p className="flex items-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin text-neon" /> Loading Business Hub...</p>}

      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">What's active</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdpadzMetricCard icon={Sparkles} label="Business Profiles" value={String(state.smartCards.length)} detail={`${state.smartCards.filter(card => card.is_published).length} published`} />
        <AdpadzMetricCard icon={CalendarDays} label="Campaigns" value={String(state.campaigns.length)} detail={`${activeCampaigns.length} active · ${upcomingCampaigns.length} upcoming`} />
        <AdpadzMetricCard icon={QrCode} label="QR Scans" value={String(qrScans)} detail={`${state.qrLinks.filter(link => link.status === 'active').length} active QR links`} />
        <AdpadzMetricCard icon={Image} label="Assets" value={String(state.assetsCount)} detail="Active reusable Business Hub assets" />
      </div>

      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Needs attention</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdpadzMetricCard icon={Users} label="New Leads" value={String(state.totals.newLeads)} detail={`${state.totals.leads} total captured leads`} />
        <AdpadzMetricCard icon={CalendarDays} label="Bookings" value={String(state.totals.bookings)} detail="Booking requests captured as leads" />
        <AdpadzMetricCard icon={BadgePercent} label="Offer Claims" value={String(state.totals.offerClaims)} detail="Persisted public offer claims" />
        <AdpadzMetricCard icon={Sparkles} label="Draft Campaigns" value={String(state.campaigns.filter(campaign => campaign.status === 'draft').length)} detail="Ready for review or activation" />
      </div>

      <AdpadzSection eyebrow="Business Hub" title="Quick actions">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map(action => <Link key={action.to} to={action.to} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-neon/50 hover:bg-neon/5"><action.icon className="mb-3 h-5 w-5 text-neon" /><p className="text-sm font-black">{action.label}</p></Link>)}
        </div>
      </AdpadzSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdpadzSection eyebrow="Campaign Engine" title="Recent campaigns" description="Campaigns are the single source of truth for promotions.">
          <div className="space-y-3">{recentCampaigns.length > 0 ? recentCampaigns.map(campaign => <CampaignRow key={campaign.id} campaign={campaign} />) : <EmptyLine text="No campaigns yet. Create one campaign and publish it everywhere." />}</div>
        </AdpadzSection>
        <AdpadzSection eyebrow="Customers" title="Recent leads" description="The latest forms and booking requests that need follow-up.">
          <div className="space-y-3">{recentLeads.length > 0 ? recentLeads.map(lead => <LeadRow key={lead.id} lead={lead} />) : <EmptyLine text="No leads yet. Published forms and booking requests will appear here." />}</div>
        </AdpadzSection>
      </div>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: CampaignRecord }) {
  return <Link to={`/app/business/campaigns/${campaign.id}/edit`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 hover:border-neon/40"><div className="min-w-0"><p className="truncate text-sm font-black">{campaign.title}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{formatCampaignWindow(campaign)}</p></div><AdpadzBadge variant="status" className="capitalize">{campaign.status}</AdpadzBadge></Link>;
}

function LeadRow({ lead }: { lead: LeadSummary }) {
  return <Link to="/app/business/leads" className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 hover:border-neon/40"><div><p className="text-sm font-black capitalize">{lead.lead_type?.replace(/_/g, ' ') || 'Lead'}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{new Date(lead.created_at).toLocaleString()}</p></div><AdpadzBadge variant={lead.status === 'new' ? 'verified' : 'status'} className="capitalize">{lead.status}</AdpadzBadge></Link>;
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-[var(--text-muted)]">{text}</p>;
}

function formatCampaignWindow(campaign: CampaignRecord): string {
  const start = campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : 'No start date';
  const end = campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : 'No end date';
  return `${start} – ${end}`;
}
