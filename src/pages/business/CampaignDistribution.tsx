import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, Copy, Download, ExternalLink, ImageOff, Loader2, Mail,
  MonitorPlay, QrCode, RefreshCcw, Share2, Store, Users,
} from 'lucide-react';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzSection } from '../../components/adpadz-ui';
import CampaignCreativeRenderer from '../../components/campaign-distribution/CampaignCreativeRenderer';
import {
  SOCIAL_FORMATS, SOCIAL_TEMPLATES, buildSuggestedCaption, evaluateDistributionReadiness,
  getSocialFormat, type CampaignCreativeData, type SocialFormatKey, type SocialTemplateKey,
} from '../../lib/campaignDistribution';
import type { CampaignOutputRecord, CampaignRecord } from '../../lib/ads';
import { copyTextToClipboard } from '../../lib/clipboard';
import { exportSocialCreative } from '../../lib/socialCreativeExport';
import { supabase } from '../../lib/supabase';
import { evaluateCampaignReadiness, type CampaignReadinessResult } from '../../lib/campaignReadiness';
import { normalizeTemplateSettings } from '../../features/campaign-templates';

type State = {
  creative: CampaignCreativeData | null;
  outputs: CampaignOutputRecord[];
  smartCard: { slug: string; is_published: boolean } | null;
  readiness: CampaignReadinessResult | null;
  loading: boolean;
  error: string | null;
};

const initialState: State = { creative: null, outputs: [], smartCard: null, readiness: null, loading: true, error: null };

export default function CampaignDistribution() {
  const { campaignId = '' } = useParams();
  const location = useLocation();
  const social = location.pathname.endsWith('/social');
  const [state, setState] = useState<State>(initialState);

  useEffect(() => {
    let cancelled = false;
    void loadDistribution(campaignId).then(value => { if (!cancelled) setState(value); });
    return () => { cancelled = true; };
  }, [campaignId]);

  if (state.loading) return <p className="flex items-center rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin text-neon" /> Loading campaign distribution...</p>;
  if (state.error || !state.creative) return <AdpadzCard variant="flat" className="border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100" role="alert">{state.error || 'Campaign not found.'}</AdpadzCard>;
  return social
    ? <SocialDistributionWorkspace creative={state.creative} output={state.outputs.find(item => item.output_type === 'interactive_ad')} />
    : <DistributionOverview creative={state.creative} outputs={state.outputs} smartCard={state.smartCard} readiness={state.readiness} />;
}

function DistributionOverview({ creative, outputs, smartCard, readiness }: Pick<State, 'creative' | 'outputs' | 'smartCard' | 'readiness'> & { creative: CampaignCreativeData }) {
  const output = (type: string) => outputs.find(item => item.output_type === type && item.enabled);
  const sectionStatus = (key: 'mailer' | 'qr' | 'discovery' | 'social') => readiness?.sections.find(section => section.key === key)?.status === 'ready' ? 'Ready' : readiness?.sections.find(section => section.key === key)?.status === 'blocked' ? 'Blocked' : 'Needs attention';
  const destinations = [
    { key: 'mailer', icon: Mail, title: 'Community Mailer', status: output('community_mailer') ? 'Included' : sectionStatus('mailer'), detail: output('community_mailer') ? 'This campaign is included in a mailer output.' : 'Ready to use in a Community Mailer.', href: '/app/business/community-campaigns', action: 'View mailers' },
    { key: 'qr', icon: QrCode, title: 'QR Landing Page', status: sectionStatus('qr'), detail: creative.campaign.primary_qr_id ? 'A campaign QR destination is connected.' : 'Connect a QR destination when you want a scannable output.', href: '/app/business/qr-studio', action: 'Open QR Studio' },
    { key: 'hub', icon: Store, title: 'Business Hub', status: output('smart_card') ? 'Included' : 'Ready', detail: 'Campaign content is rendered from your Business Hub and Campaign Engine.', href: smartCard?.slug ? `/c/${smartCard.slug}` : '/app/business/smart-cards', action: smartCard?.slug ? 'Open profile' : 'Open Business Hub' },
    { key: 'discovery', icon: Users, title: 'Consumer Discovery', status: output('interactive_ad') ? 'Published' : sectionStatus('discovery'), detail: output('interactive_ad') ? 'This campaign is enabled for consumer discovery.' : 'Campaign content is ready for a discovery placement.', href: output('interactive_ad') ? `/ad/${creative.campaign.id}` : `/app/business/campaigns/${creative.campaign.id}/content`, action: 'Preview' },
    { key: 'social', icon: Share2, title: 'Social Media', status: sectionStatus('social'), detail: 'Create destination-ready images and captions for manual posting.', href: `/app/business/campaigns/${creative.campaign.id}/distribution/social`, action: 'Create social posts', primary: true },
    { key: 'tv', icon: MonitorPlay, title: 'Adpadz TV', status: 'Coming later', detail: 'A future campaign destination. It is not available yet.' },
  ];
  return (
    <div className="space-y-7">
      <AdpadzButton href="/app/business/campaigns" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Campaigns</AdpadzButton>
      <AdpadzCard variant="featured" className="overflow-hidden p-6 sm:p-8">
        <div className="grid gap-7 md:grid-cols-[180px_1fr] md:items-center">
          <div className="aspect-square overflow-hidden rounded-3xl bg-white/[0.05]">
            {creative.campaignImageUrl ? <img src={creative.campaignImageUrl} alt={`${creative.campaign.title} campaign`} className="h-full w-full object-cover" /> : <ImageOff className="m-auto h-full w-10 text-[var(--text-muted)]" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><AdpadzBadge variant="campaign">Distribution</AdpadzBadge><AdpadzBadge variant="status" className="capitalize">{creative.campaign.status}</AdpadzBadge></div>
            <h1 className="mt-4 text-3xl font-black">{creative.campaign.title}</h1>
            <p className="mt-3 max-w-2xl text-base text-[var(--text-secondary)]">Your campaign is prepared for every Adpadz destination. One campaign powers every output below.</p>
          </div>
        </div>
      </AdpadzCard>
      <AdpadzSection eyebrow="One campaign Ã‚Â· many destinations" title="Where this campaign can go" description="Each destination reads the same approved campaign and Business Hub information.">
        <div className="grid gap-4 md:grid-cols-2">
          {destinations.map(destination => (
            <AdpadzCard key={destination.key} as="article" variant={destination.primary ? 'featured' : 'flat'} className={`p-5 ${destination.key === 'tv' ? 'opacity-70' : ''}`}>
              <div className="flex h-full items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neon/10 text-neon"><destination.icon className="h-5 w-5" /></span>
                <div className="flex min-w-0 flex-1 flex-col items-start">
                  <div className="flex w-full flex-wrap items-center justify-between gap-2"><h2 className="font-black">{destination.title}</h2><AdpadzBadge variant="status">{destination.status}</AdpadzBadge></div>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--text-muted)]">{destination.detail}</p>
                  {destination.href && <AdpadzButton href={destination.href} variant={destination.primary ? 'primary' : 'secondary'} size="sm" className="mt-4">{destination.action}{destination.primary && <ExternalLink className="h-3.5 w-3.5" />}</AdpadzButton>}
                </div>
              </div>
            </AdpadzCard>
          ))}
        </div>
      </AdpadzSection>
    </div>
  );
}

function SocialDistributionWorkspace({ creative, output }: { creative: CampaignCreativeData; output?: CampaignOutputRecord }) {
  const savedTemplateSettings = normalizeTemplateSettings(output?.metadata?.template_settings);
  const [format, setFormat] = useState<SocialFormatKey>('square');
  const [template, setTemplate] = useState<SocialTemplateKey>(savedTemplateSettings.template);
  const [showQr, setShowQr] = useState(savedTemplateSettings.showQr || Boolean(creative.campaignUrl));
  const [showExpiration, setShowExpiration] = useState(savedTemplateSettings.showExpiration && Boolean(creative.campaign.end_date));
  const suggestedCaption = useMemo(() => buildSuggestedCaption(creative), [creative]);
  const [caption, setCaption] = useState(suggestedCaption);
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const readiness = evaluateDistributionReadiness(creative, { template, showQr });
  const preset = getSocialFormat(format);

  async function copyCaption() {
    try {
      await copyTextToClipboard(caption);
      setMessage('Caption copied.');
    } catch {
      setMessage('Could not copy the caption.');
    }
  }

  async function download() {
    if (!svgRef.current || !readiness.ready) return;
    setExporting(true);
    setMessage('');
    try {
      await exportSocialCreative(svgRef.current, format, creative.businessName, creative.campaign.title);
      setMessage(`${preset.width} Ãƒâ€” ${preset.height} PNG downloaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not export the image.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdpadzButton href={`/app/business/campaigns/${creative.campaign.id}/distribution`} variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Distribution</AdpadzButton>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Social Media Ã‚Â· Manual posting</p>
        <h1 className="mt-1 text-2xl font-black">{creative.campaign.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">Choose a destination-ready layout, download the image, then copy the editable caption into the social account you already use.</p>
      </div>
      {message && <div role="status" aria-live="polite" className="rounded-2xl border border-neon/25 bg-neon/[0.08] p-4 text-sm font-bold text-neon">{message}</div>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section aria-label="Creative preview" className="order-1 xl:sticky xl:top-6 xl:self-start">
          <AdpadzCard variant="featured" className="p-3 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3 px-1"><div><p className="text-xs font-black">Live preview</p><p className="text-[10px] text-[var(--text-muted)]">{preset.width} Ãƒâ€” {preset.height} PNG</p></div><AdpadzBadge variant={readiness.ready ? 'verified' : 'status'}>{readiness.ready ? 'Ready' : 'Needs attention'}</AdpadzBadge></div>
            <div className="mx-auto flex max-h-[70vh] justify-center overflow-hidden rounded-2xl bg-black/30">
              <CampaignCreativeRenderer ref={svgRef} creative={creative} format={format} template={template} showQr={showQr} showExpiration={showExpiration} className="h-auto max-h-[70vh] w-auto max-w-full" />
            </div>
            <AdpadzButton type="button" onClick={() => void download()} disabled={!readiness.ready || exporting} fullWidth size="lg" className="mt-4">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{exporting ? 'Creating PNG...' : 'Download image'}</AdpadzButton>
          </AdpadzCard>
        </section>
        <div className="order-2 space-y-5">
          <Selector title="Format">
            <div className="flex gap-2 overflow-x-auto pb-2 xl:grid xl:grid-cols-2">
              {SOCIAL_FORMATS.map(option => <SelectionButton key={option.key} selected={format === option.key} onClick={() => setFormat(option.key)} title={option.label} detail={`${option.width} Ãƒâ€” ${option.height}`} />)}
            </div>
          </Selector>
          <Selector title="Template">
            <div className="space-y-2">{SOCIAL_TEMPLATES.map(option => <SelectionButton key={option.key} selected={template === option.key} onClick={() => setTemplate(option.key)} title={option.label} detail={option.description} />)}</div>
          </Selector>
          <AdpadzCard variant="flat" className="space-y-3 p-5">
            <Toggle checked={showQr} onChange={setShowQr} label="Show QR code" detail="Uses the campaign or CTA destination." />
            <Toggle checked={showExpiration} onChange={setShowExpiration} disabled={!creative.campaign.end_date} label="Show expiration date" detail={creative.campaign.end_date ? 'Uses the campaign end date.' : 'No expiration date is set.'} />
          </AdpadzCard>
          {!readiness.ready && <AdpadzCard variant="flat" className="border-amber-400/30 bg-amber-400/[0.07] p-5" role="status"><h2 className="font-black text-amber-200">Complete this campaign</h2><div className="mt-3 space-y-3">{readiness.issues.map(issue => <div key={issue.field} className="flex items-center justify-between gap-3"><p className="text-xs text-amber-100">{issue.message}</p><AdpadzButton href={issueHref(creative.campaign.id, issue.section)} variant="secondary" size="sm">{issue.action}</AdpadzButton></div>)}</div></AdpadzCard>}
          <AdpadzCard variant="flat" className="p-5">
            <label htmlFor="social-caption" className="text-sm font-black">Suggested caption</label>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">Edit freely. Changes stay in this workspace and do not alter campaign copy.</p>
            <textarea id="social-caption" value={caption} onChange={event => setCaption(event.target.value)} rows={12} className="input-field mt-3 resize-y text-sm leading-relaxed" />
            <div className="mt-3 flex flex-wrap gap-2">
              <AdpadzButton type="button" onClick={() => void copyCaption()} disabled={!caption.trim()}><Copy className="h-4 w-4" /> Copy caption</AdpadzButton>
              <AdpadzButton type="button" variant="secondary" onClick={() => setCaption(suggestedCaption)}><RefreshCcw className="h-4 w-4" /> Reset</AdpadzButton>
            </div>
          </AdpadzCard>
        </div>
      </div>
    </div>
  );
}

function Selector({ title, children }: { title: string; children: React.ReactNode }) {
  return <AdpadzCard variant="flat" className="p-5"><h2 className="mb-3 text-sm font-black">{title}</h2>{children}</AdpadzCard>;
}

function SelectionButton({ selected, onClick, title, detail }: { selected: boolean; onClick: () => void; title: string; detail: string }) {
  return <button type="button" onClick={onClick} aria-pressed={selected} className={`min-w-[170px] rounded-2xl border p-3 text-left transition ${selected ? 'border-neon bg-neon/10' : 'border-white/10 bg-white/[0.025] hover:border-neon/40'}`}><span className="flex items-center justify-between gap-2 text-xs font-black">{title}{selected && <Check className="h-4 w-4 text-neon" />}</span><span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">{detail}</span></button>;
}

function Toggle({ checked, onChange, disabled = false, label, detail }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label: string; detail: string }) {
  return <label className={`flex min-h-12 items-center justify-between gap-4 ${disabled ? 'opacity-50' : ''}`}><span><span className="block text-xs font-black">{label}</span><span className="text-[10px] text-[var(--text-muted)]">{detail}</span></span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} disabled={disabled} className="h-5 w-5 accent-[var(--neon)]" /></label>;
}

function issueHref(campaignId: string, section: string) {
  if (section === 'business-profile') return '/app/business/smart-cards';
  if (section === 'qr-studio') return '/app/business/qr-studio';
  return `/app/business/campaigns/${campaignId}/edit?section=${section === 'campaign-media' ? 'media' : 'details'}`;
}

async function loadDistribution(campaignId: string): Promise<State> {
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);
    if (!auth.user) throw new Error('Sign in to open campaign distribution.');
    const [campaignResult, outputsResult, cardResult, businessResult] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', campaignId).eq('owner_id', auth.user.id).maybeSingle(),
      supabase.from('campaign_outputs').select('*').eq('campaign_id', campaignId).order('sort_order'),
      supabase.from('business_cards').select('id,business_name,slug,logo_url,cover_image_url,primary_color,accent_color,website,phone,address,is_published').eq('owner_user_id', auth.user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('businesses').select('name,category,service_area,address,website,phone,active').eq('owner_user_id', auth.user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (campaignResult.error) throw new Error(campaignResult.error.message);
    if (outputsResult.error) throw new Error(outputsResult.error.message);
    if (cardResult.error) throw new Error(cardResult.error.message);
    if (businessResult.error) throw new Error(businessResult.error.message);
    if (!campaignResult.data) throw new Error('Campaign not found.');
    const campaign = campaignResult.data as CampaignRecord;
    const card = cardResult.data;
    const business = businessResult.data;
    const assetResult = campaign.primary_image_id
      ? await supabase.from('business_marketing_assets').select('file_url,external_url,thumbnail_url').eq('id', campaign.primary_image_id).maybeSingle()
      : { data: null, error: null };
    if (assetResult.error) throw new Error(assetResult.error.message);
    const image = assetResult.data;
    const campaignUrl = campaign.cta_url || (card?.slug ? `${window.location.origin}/c/${card.slug}#offers` : null);
    return {
      creative: {
        campaign,
        businessName: business?.name || card?.business_name || 'Your business',
        businessLogoUrl: card?.logo_url || null,
        campaignImageUrl: image?.file_url || image?.thumbnail_url || image?.external_url || card?.cover_image_url || null,
        primaryColor: card?.primary_color || '#14251b',
        accentColor: card?.accent_color || '#b0ff00',
        website: card?.website || null,
        phone: card?.phone || null,
        category: null,
        city: parseCity(card?.address),
        campaignUrl,
      },
      outputs: (outputsResult.data ?? []) as CampaignOutputRecord[],
      smartCard: card ? { slug: card.slug, is_published: card.is_published } : null,
      readiness: evaluateCampaignReadiness({ campaign, campaignImageUrl: image?.file_url || image?.thumbnail_url || image?.external_url || card?.cover_image_url || null, outputs: (outputsResult.data ?? []) as CampaignOutputRecord[], business: { name: business?.name || card?.business_name, logoUrl: card?.logo_url, category: business?.category, location: business?.service_area || business?.address || card?.address, website: business?.website || card?.website, phone: business?.phone || card?.phone, profilePublished: card?.is_published ?? false, active: business?.active ?? false }, qr: campaign.primary_qr_id ? { exists: true, valid: Boolean(campaignUrl), publishable: campaign.status !== 'expired', publicRouteResolves: Boolean(campaignUrl) } : null }),
      loading: false,
      error: null,
    };
  } catch (error) {
    return { ...initialState, loading: false, error: error instanceof Error ? error.message : 'Could not load campaign distribution.' };
  }
}

function parseCity(address: unknown): string | null {
  if (typeof address === 'string') return address.split(',')[0]?.trim() || null;
  if (address && typeof address === 'object' && 'city' in address && typeof address.city === 'string') return address.city;
  return null;
}
