import { useEffect, useMemo, useState } from 'react';
import { Archive, CalendarDays, Eye, Layers3, Loader2, Pause, Pencil, Play, Plus, RadioTower, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzMetricCard, AdpadzSection } from '../../components/adpadz-ui';
import type { CampaignOutputRecord, CampaignRecord } from '../../lib/ads';

type CampaignState = {
  campaigns: CampaignRecord[];
  outputs: CampaignOutputRecord[];
  loading: boolean;
  error: string | null;
};

const initialState: CampaignState = { campaigns: [], outputs: [], loading: true, error: null };
const statuses = ['all', 'active', 'draft', 'scheduled', 'expired'] as const;

export default function BizCampaigns() {
  const [state, setState] = useState<CampaignState>(initialState);
  const [filter, setFilter] = useState<(typeof statuses)[number]>('all');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadCampaigns(() => cancelled);
    return () => { cancelled = true; };
  }, []);

  async function loadCampaigns(isCancelled: () => boolean = () => false) {
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      const userId = authData.user?.id;
      if (!userId) throw new Error('Sign in to load campaigns.');

      const { data: campaigns, error: campaignError } = await supabase.from('campaigns').select('*').eq('owner_id', userId).order('updated_at', { ascending: false });
      if (campaignError) throw new Error(campaignError.message);
      const campaignRows = (campaigns ?? []) as CampaignRecord[];
      const ids = campaignRows.map(campaign => campaign.id);
      const outputResult = ids.length > 0
        ? await supabase.from('campaign_outputs').select('*').in('campaign_id', ids).order('sort_order', { ascending: true })
        : { data: [], error: null };
      if (outputResult.error) throw new Error(outputResult.error.message);
      if (!isCancelled()) setState({ campaigns: campaignRows, outputs: (outputResult.data ?? []) as CampaignOutputRecord[], loading: false, error: null });
    } catch (loadError) {
      if (!isCancelled()) setState(current => ({ ...current, loading: false, error: loadError instanceof Error ? loadError.message : 'Could not load campaigns.' }));
    }
  }

  async function updateStatus(campaign: CampaignRecord, nextStatus: 'active' | 'draft' | 'expired') {
    setUpdatingId(campaign.id);
    setMessage(null);
    setState(current => ({ ...current, error: null }));
    try {
      const { data, error } = await supabase.from('campaigns').update({ status: nextStatus }).eq('id', campaign.id).select('*').single();
      if (error || !data) throw new Error(error?.message ?? 'Could not update campaign status.');
      const { data: reloaded, error: reloadError } = await supabase.from('campaigns').select('*').eq('id', campaign.id).single();
      if (reloadError || !reloaded) throw new Error(reloadError?.message ?? 'Could not verify campaign status.');
      setState(current => ({ ...current, campaigns: current.campaigns.map(item => item.id === campaign.id ? reloaded as CampaignRecord : item) }));
      setMessage(`${campaign.title} is now ${nextStatus === 'draft' ? 'paused' : nextStatus}.`);
    } catch (statusError) {
      setState(current => ({ ...current, error: statusError instanceof Error ? statusError.message : 'Could not update campaign status.' }));
    } finally {
      setUpdatingId(null);
    }
  }

  const counts = useMemo(() => ({
    active: state.campaigns.filter(campaign => campaign.status === 'active').length,
    draft: state.campaigns.filter(campaign => campaign.status === 'draft').length,
    scheduled: state.campaigns.filter(campaign => campaign.status === 'scheduled').length,
    expired: state.campaigns.filter(campaign => campaign.status === 'expired').length,
  }), [state.campaigns]);

  const visibleCampaigns = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return state.campaigns.filter(campaign => {
      const matchesStatus = filter === 'all' || campaign.status === filter;
      const matchesSearch = !query || [campaign.title, campaign.headline, campaign.description, campaign.offer_title].some(value => value?.toLocaleLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [filter, search, state.campaigns]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Campaign Engine</p>
          <h1 className="text-2xl font-black">Campaigns</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Create, schedule, pause, edit, preview, and distribute each promotion from one source of truth.</p>
        </div>
        <AdpadzButton href="/app/business/create-ad" size="lg"><Plus className="h-4 w-4" /> New Campaign</AdpadzButton>
      </div>

      {state.error && <AdpadzCard variant="flat" className="border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{state.error}</AdpadzCard>}
      {message && <AdpadzCard variant="flat" className="border-neon/30 bg-neon/10 p-4 text-sm font-bold text-neon" role="status">{message}</AdpadzCard>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdpadzMetricCard icon={RadioTower} label="Active" value={String(counts.active)} detail="Publicly available now" />
        <AdpadzMetricCard icon={Layers3} label="Draft" value={String(counts.draft)} detail="Paused or being prepared" />
        <AdpadzMetricCard icon={CalendarDays} label="Scheduled" value={String(counts.scheduled)} detail="Prepared for future dates" />
        <AdpadzMetricCard icon={Archive} label="Archived" value={String(counts.expired)} detail="Retained for history" />
        <AdpadzMetricCard icon={Layers3} label="Outputs" value={String(state.outputs.filter(output => output.enabled).length)} detail="Enabled distribution outputs" />
      </div>

      <AdpadzSection eyebrow="Single source of truth" title="Campaign Library" description="Promotional content belongs here. Outputs decide where each campaign appears.">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" aria-label="Campaign status filter">
            {statuses.map(status => <button key={status} type="button" onClick={() => setFilter(status)} aria-pressed={filter === status} className={`rounded-full border px-3 py-2 text-xs font-black capitalize ${filter === status ? 'border-neon bg-neon text-black' : 'border-[var(--border-default)] text-[var(--text-muted)] hover:text-white'}`}>{status}</button>)}
          </div>
          <label className="relative block w-full lg:max-w-xs">
            <span className="sr-only">Search campaigns</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search campaigns" className="input-field pl-9" />
          </label>
        </div>

        <div className="space-y-3">
          {state.loading ? <p className="flex items-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin text-neon" /> Loading campaigns...</p> : visibleCampaigns.length > 0 ? visibleCampaigns.map(campaign => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              outputs={state.outputs.filter(output => output.campaign_id === campaign.id)}
              updating={updatingId === campaign.id}
              onStatus={nextStatus => void updateStatus(campaign, nextStatus)}
            />
          )) : <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-[var(--text-muted)]">No campaigns match this view.</p>}
        </div>
      </AdpadzSection>
    </div>
  );
}

function CampaignCard({ campaign, outputs, updating, onStatus }: { campaign: CampaignRecord; outputs: CampaignOutputRecord[]; updating: boolean; onStatus: (status: 'active' | 'draft' | 'expired') => void }) {
  const interactive = outputs.some(output => output.output_type === 'interactive_ad' && output.enabled);
  const isLive = campaign.status === 'active' || campaign.status === 'scheduled';
  return (
    <AdpadzCard as="article" variant="flat" className="p-4 transition hover:border-neon/40">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-black">{campaign.title}</h2>
            <AdpadzBadge variant="status" className="capitalize">{campaign.status}</AdpadzBadge>
          </div>
          {campaign.headline && <p className="mt-1 text-sm text-[var(--text-secondary)]">{campaign.headline}</p>}
          <p className="mt-2 text-xs text-[var(--text-muted)]">{formatDate(campaign.start_date)} – {formatDate(campaign.end_date)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {outputs.length > 0 ? outputs.map(output => <AdpadzBadge key={`${output.campaign_id}-${output.output_type}`} variant="campaign" className={output.enabled ? '' : 'opacity-45'}>{formatOutput(output.output_type)}</AdpadzBadge>) : <AdpadzBadge variant="status">No outputs</AdpadzBadge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <AdpadzButton href={`/app/business/campaigns/${campaign.id}/edit`} variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</AdpadzButton>
          <AdpadzButton href={`/app/business/campaigns/${campaign.id}/content`} variant="secondary" size="sm">Package</AdpadzButton>
          {interactive && isLive && <AdpadzButton href={`/ad/${campaign.id}`} target="_blank" rel="noreferrer" variant="ghost" size="sm"><Eye className="h-3.5 w-3.5" /> Preview</AdpadzButton>}
          {campaign.status === 'active'
            ? <AdpadzButton type="button" onClick={() => onStatus('draft')} disabled={updating} variant="ghost" size="sm">{updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />} Pause</AdpadzButton>
            : <AdpadzButton type="button" onClick={() => onStatus('active')} disabled={updating} variant="ghost" size="sm">{updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Activate</AdpadzButton>}
          {campaign.status !== 'expired' && <AdpadzButton type="button" onClick={() => onStatus('expired')} disabled={updating} variant="ghost" size="sm"><Archive className="h-3.5 w-3.5" /> Archive</AdpadzButton>}
        </div>
      </div>
    </AdpadzCard>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatOutput(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
