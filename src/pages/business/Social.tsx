import { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, Copy, ExternalLink, Facebook, FileText, Instagram, Loader2, Mail, Megaphone, Save, Sparkles, type LucideIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { buildCampaignChannelCopy, type CampaignContentChannel, type CampaignOutputRecord, type CampaignRecord } from '../../lib/ads';
import { copyTextToClipboard } from '../../lib/clipboard';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzEmptyState, AdpadzSection } from '../../components/adpadz-ui';

type ChannelOption = {
  value: CampaignContentChannel;
  label: string;
  description: string;
  icon: LucideIcon;
};

type SavedOutput = CampaignOutputRecord & {
  metadata?: {
    copy?: string;
    status?: string;
    scheduled_at?: string;
    [key: string]: unknown;
  } | null;
};

const channels: ChannelOption[] = [
  { value: 'facebook', label: 'Facebook', description: 'Long-form local post', icon: Facebook },
  { value: 'instagram', label: 'Instagram', description: 'Caption and hashtags', icon: Instagram },
  { value: 'email', label: 'Email', description: 'Subject and message', icon: Mail },
  { value: 'flyer', label: 'Flyer', description: 'Print-ready copy', icon: FileText },
  { value: 'community_mailer', label: 'Community Mailer', description: 'Neighborhood placement', icon: Megaphone },
];

export default function BizSocial() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [outputs, setOutputs] = useState<SavedOutput[]>([]);
  const [businessName, setBusinessName] = useState('Your business');
  const [campaignId, setCampaignId] = useState('');
  const [channel, setChannel] = useState<CampaignContentChannel>('facebook');
  const [copy, setCopy] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setLoading(true);
      setError(null);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw new Error(authError.message);
        const userId = authData.user?.id;
        if (!userId) throw new Error('Sign in to prepare campaign content.');

        const [campaignResult, cardResult] = await Promise.all([
          supabase.from('campaigns').select('*').eq('owner_id', userId).order('updated_at', { ascending: false }),
          supabase.from('business_cards').select('business_name').eq('owner_user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (campaignResult.error) throw new Error(campaignResult.error.message);
        if (cardResult.error) throw new Error(cardResult.error.message);

        const loadedCampaigns = (campaignResult.data ?? []) as CampaignRecord[];
        const ids = loadedCampaigns.map(item => item.id);
        const outputResult = ids.length > 0
          ? await supabase.from('campaign_outputs').select('*').in('campaign_id', ids).in('output_type', channels.map(item => item.value)).order('updated_at', { ascending: false })
          : { data: [], error: null };
        if (outputResult.error) throw new Error(outputResult.error.message);

        if (!cancelled) {
          setCampaigns(loadedCampaigns);
          setOutputs((outputResult.data ?? []) as SavedOutput[]);
          setBusinessName(cardResult.data?.business_name || 'Your business');
          setCampaignId(current => current || loadedCampaigns[0]?.id || '');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load the publishing workspace.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadWorkspace();
    return () => { cancelled = true; };
  }, []);

  const selectedCampaign = useMemo(() => campaigns.find(item => item.id === campaignId) ?? null, [campaignId, campaigns]);

  useEffect(() => {
    if (!selectedCampaign) {
      setCopy('');
      return;
    }
    const existing = outputs.find(output => output.campaign_id === selectedCampaign.id && output.output_type === channel);
    const existingCopy = typeof existing?.metadata?.copy === 'string' ? existing.metadata.copy : '';
    setCopy(existingCopy || buildCampaignChannelCopy(selectedCampaign, businessName, channel));
    setScheduledAt(typeof existing?.metadata?.scheduled_at === 'string' ? toLocalDateTime(existing.metadata.scheduled_at) : '');
  }, [businessName, channel, outputs, selectedCampaign]);

  async function saveOutput() {
    if (!selectedCampaign || !copy.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        campaign_id: selectedCampaign.id,
        output_type: channel,
        enabled: true,
        sort_order: 0,
        metadata: {
          copy: copy.trim(),
          status: scheduledAt ? 'scheduled_handoff' : 'ready',
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        },
      };
      const { data, error: saveError } = await supabase.from('campaign_outputs').upsert(payload, { onConflict: 'campaign_id,output_type' }).select('*').single();
      if (saveError || !data) throw new Error(saveError?.message ?? 'Could not save this campaign output.');

      const { data: reloaded, error: reloadError } = await supabase.from('campaign_outputs').select('*').eq('campaign_id', selectedCampaign.id).eq('output_type', channel).single();
      if (reloadError || !reloaded) throw new Error(reloadError?.message ?? 'Could not verify the saved output.');

      setOutputs(current => [reloaded as SavedOutput, ...current.filter(output => !(output.campaign_id === selectedCampaign.id && output.output_type === channel))]);
      setMessage(scheduledAt ? 'Output saved with its planned handoff time.' : 'Output saved to the campaign marketing package.');
    } catch (saveFailure) {
      setError(saveFailure instanceof Error ? saveFailure.message : 'Could not save this output.');
    } finally {
      setSaving(false);
    }
  }

  async function copyOutput() {
    try {
      await copyTextToClipboard(copy);
      setMessage('Campaign copy copied.');
    } catch {
      setError('Could not copy this content.');
    }
  }

  const prepared = outputs.filter(output => output.enabled && channels.some(item => item.value === output.output_type));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Create once · prepare everywhere</p>
          <h1 className="text-2xl font-black">Publishing Workspace</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">Turn Campaign Engine content into ready-to-use social, email, print, and neighborhood outputs without retyping the promotion.</p>
        </div>
        <AdpadzButton href="/app/business/create-ad" size="lg"><Sparkles className="h-4 w-4" /> New Campaign</AdpadzButton>
      </div>

      {(error || message) && <AdpadzCard variant="flat" className={`p-4 text-sm font-bold ${error ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-neon/30 bg-neon/10 text-neon'}`} role={error ? 'alert' : 'status'}>{error || message}</AdpadzCard>}

      {loading ? (
        <p className="flex items-center rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin text-neon" /> Loading campaign outputs...</p>
      ) : campaigns.length === 0 ? (
        <AdpadzEmptyState icon={<Megaphone className="h-7 w-7" />} title="Create a campaign first" description="The Publishing Workspace builds every channel from one Campaign Engine record." action={<AdpadzButton href="/app/business/create-ad">Create Campaign</AdpadzButton>} />
      ) : (
        <>
          <AdpadzSection eyebrow="Composer" title="Prepare a campaign output" description="Generated copy is editable. Save it back to the Campaign Engine when it is ready.">
            <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">Campaign</span>
                  <select value={campaignId} onChange={event => setCampaignId(event.target.value)} className="input-field">
                    {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
                  </select>
                </label>
                <div>
                  <p className="mb-2 text-xs font-bold text-[var(--text-secondary)]">Output</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    {channels.map(option => (
                      <button key={option.value} type="button" onClick={() => setChannel(option.value)} aria-pressed={channel === option.value} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${channel === option.value ? 'border-neon bg-neon/10' : 'border-[var(--border-default)] bg-[var(--bg-input)] hover:border-neon/40'}`}>
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${channel === option.value ? 'bg-neon text-black' : 'bg-white/[0.06] text-[var(--text-muted)]'}`}><option.icon className="h-4 w-4" /></span>
                        <span><span className="block text-sm font-black">{option.label}</span><span className="text-[10px] text-[var(--text-muted)]">{option.description}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]"><Calendar className="h-3.5 w-3.5 text-neon" /> Planned handoff (optional)</span>
                  <input type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} className="input-field" />
                  <span className="mt-1 block text-[10px] text-[var(--text-muted)]">This records the plan. Direct auto-publishing requires a connected platform account.</span>
                </label>
              </div>

              <div>
                <label htmlFor="campaign-copy" className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">Editable output copy</label>
                <textarea id="campaign-copy" value={copy} onChange={event => setCopy(event.target.value)} rows={15} className="input-field resize-y font-sans leading-relaxed" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <AdpadzButton type="button" onClick={() => void saveOutput()} disabled={saving || !copy.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save to package</AdpadzButton>
                  <AdpadzButton type="button" variant="secondary" onClick={() => void copyOutput()} disabled={!copy.trim()}><Copy className="h-4 w-4" /> Copy</AdpadzButton>
                  {selectedCampaign && <AdpadzButton href={`/app/business/campaigns/${selectedCampaign.id}/content`} variant="ghost"><ExternalLink className="h-4 w-4" /> Full package</AdpadzButton>}
                </div>
              </div>
            </div>
          </AdpadzSection>

          <AdpadzSection eyebrow="Saved outputs" title="Campaign handoff queue" description="These outputs are persisted on their campaigns. Copy or export them into connected channels when ready.">
            {prepared.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-[var(--text-muted)]">No channel outputs saved yet.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {prepared.map(output => {
                  const campaign = campaigns.find(item => item.id === output.campaign_id);
                  const option = channels.find(item => item.value === output.output_type);
                  if (!campaign || !option) return null;
                  const status = typeof output.metadata?.status === 'string' ? output.metadata.status : 'ready';
                  return (
                    <AdpadzCard key={`${output.campaign_id}-${output.output_type}`} as="article" variant="flat" className="p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neon/10 text-neon"><option.icon className="h-5 w-5" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-sm font-black">{campaign.title}</h2>
                            <AdpadzBadge variant={status === 'ready' ? 'verified' : 'status'}>{status.replace(/_/g, ' ')}</AdpadzBadge>
                          </div>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">{option.label}</p>
                          {typeof output.metadata?.copy === 'string' && <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">{output.metadata.copy}</p>}
                        </div>
                        <Check className="h-4 w-4 shrink-0 text-neon" />
                      </div>
                    </AdpadzCard>
                  );
                })}
              </div>
            )}
          </AdpadzSection>

          <AdpadzCard variant="glass" className="p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neon">External publishing</p>
            <h2 className="mt-2 text-lg font-black">Prepared here, published with your account</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">Adpadz stores the finished campaign output now. Direct posting will only appear after a business explicitly connects and authorizes each platform; the app does not claim a post was published when no account is connected.</p>
          </AdpadzCard>
        </>
      )}
    </div>
  );
}

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
