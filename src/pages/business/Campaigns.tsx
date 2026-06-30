import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Layers3, Plus, RadioTower } from 'lucide-react';
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

export default function BizCampaigns() {
  const [state, setState] = useState<CampaignState>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaigns() {
      setState(current => ({ ...current, loading: true, error: null }));
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw new Error(authError.message);
        const userId = authData.user?.id;
        if (!userId) throw new Error('Sign in to load campaigns.');

        const { data: campaigns, error: campaignError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('owner_id', userId)
          .order('updated_at', { ascending: false });
        if (campaignError) throw new Error(campaignError.message);

        const campaignRows = (campaigns ?? []) as CampaignRecord[];
        const campaignIds = campaignRows.map(campaign => campaign.id);
        let outputRows: CampaignOutputRecord[] = [];

        if (campaignIds.length > 0) {
          const { data: outputs, error: outputError } = await supabase
            .from('campaign_outputs')
            .select('*')
            .in('campaign_id', campaignIds)
            .order('sort_order', { ascending: true });
          if (outputError) throw new Error(outputError.message);
          outputRows = (outputs ?? []) as CampaignOutputRecord[];
        }

        if (!cancelled) setState({ campaigns: campaignRows, outputs: outputRows, loading: false, error: null });
      } catch (error) {
        if (!cancelled) setState(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Could not load campaigns.' }));
      }
    }

    void loadCampaigns();
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => ({
    active: state.campaigns.filter(campaign => campaign.status === 'active').length,
    draft: state.campaigns.filter(campaign => campaign.status === 'draft').length,
    scheduled: state.campaigns.filter(campaign => campaign.status === 'scheduled').length,
    expired: state.campaigns.filter(campaign => campaign.status === 'expired').length,
  }), [state.campaigns]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Campaign Engine</p>
          <h1 className="text-2xl font-black">Campaigns</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Create one campaign, then publish it through Smart Cards, interactive ads, mailers, QR landing pages, and future outputs.</p>
        </div>
        <AdpadzButton href="/app/business/create-ad" size="lg"><Plus className="h-4 w-4" /> New Campaign</AdpadzButton>
      </div>

      {state.error && <AdpadzCard variant="flat" className="border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">{state.error}</AdpadzCard>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdpadzMetricCard icon={RadioTower} label="Active" value={String(counts.active)} detail="Live Campaign Engine records" />
        <AdpadzMetricCard icon={Layers3} label="Draft" value={String(counts.draft)} detail="Campaigns not published yet" />
        <AdpadzMetricCard icon={CalendarDays} label="Scheduled" value={String(counts.scheduled)} detail="Campaigns prepared for future dates" />
        <AdpadzMetricCard icon={Layers3} label="Outputs" value={String(state.outputs.filter(output => output.enabled).length)} detail="Enabled campaign distribution outputs" />
      </div>

      <AdpadzSection eyebrow="Single source of truth" title="Campaign Library" description="Promotional content belongs here. Outputs decide where each campaign appears.">
        <div className="space-y-3">
          {state.campaigns.length > 0 ? state.campaigns.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} outputs={state.outputs.filter(output => output.campaign_id === campaign.id)} />
          )) : <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-[var(--text-muted)]">{state.loading ? 'Loading campaigns...' : 'No campaigns yet. Use Campaign Studio to create a Campaign Engine record.'}</p>}
        </div>
      </AdpadzSection>
    </div>
  );
}

function CampaignCard({ campaign, outputs }: { campaign: CampaignRecord; outputs: CampaignOutputRecord[] }) {
  return (
    <AdpadzCard as="article" variant="flat" className="p-4 transition hover:border-neon/40">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-black">{campaign.title}</h2>
            <AdpadzBadge variant="status" className="capitalize">{campaign.status}</AdpadzBadge>
          </div>
          {campaign.headline && <p className="mt-1 text-sm text-[var(--text-secondary)]">{campaign.headline}</p>}
          <p className="mt-2 text-xs text-[var(--text-muted)]">{formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {outputs.length > 0 ? outputs.map(output => (
            <AdpadzBadge key={`${output.campaign_id}-${output.output_type}`} variant="campaign" className={output.enabled ? '' : 'opacity-45'}>{formatOutput(output.output_type)}</AdpadzBadge>
          )) : <AdpadzBadge variant="status">No outputs</AdpadzBadge>}
        </div>
      </div>
    </AdpadzCard>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatOutput(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

