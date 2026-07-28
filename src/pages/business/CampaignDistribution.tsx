import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft, Copy, Download, ExternalLink, Loader2, Mail,
  MonitorPlay, QrCode, RefreshCcw, Share2, Sparkles, Store, Users,
} from 'lucide-react';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzSection } from '../../components/adpadz-ui';
import {
  buildSuggestedCaption, evaluateDistributionReadiness, getSocialFormat, isDistributionQrUsable,
  type CampaignCreativeData, type SocialFormatKey,
} from '../../lib/campaignDistribution';
import type { CampaignOutputRecord, CampaignRecord } from '../../lib/ads';
import { copyTextToClipboard } from '../../lib/clipboard';
import { exportSocialCreativeElement } from '../../lib/socialCreativeExport';
import { supabase } from '../../lib/supabase';
import { evaluateCampaignReadiness, type CampaignReadinessResult } from '../../lib/campaignReadiness';
import {
  buildDestinationCreativeView,
  CAMPAIGN_TEMPLATE_REGISTRY,
  CampaignTemplateRenderer,
  resolveDestinationCreative,
  type CreativeAssetReference,
} from '../../features/campaign-templates';
import QRStudioPreview from '../../components/qr/QRStudioPreview';
import type { QRLinkRecord } from '../../lib/qr/qrTypes';

type State = {
  creative: CampaignCreativeData | null;
  outputs: CampaignOutputRecord[];
  smartCard: { slug: string; is_published: boolean } | null;
  readiness: CampaignReadinessResult | null;
  creativeAssets: CreativeAssetReference[];
  discoveryQr: QRLinkRecord | null;
  socialQr: QRLinkRecord | null;
  loading: boolean;
  error: string | null;
};

const initialState: State = {
  creative: null,
  outputs: [],
  smartCard: null,
  readiness: null,
  creativeAssets: [],
  discoveryQr: null,
  socialQr: null,
  loading: true,
  error: null,
};

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
    ? <SocialDistributionWorkspace
        key={state.creative.campaign.id}
        creative={state.creative}
        output={state.outputs.find(item => item.output_type === 'interactive_ad')}
        assets={state.creativeAssets}
        socialQr={state.socialQr}
      />
    : <DistributionOverview
        creative={state.creative}
        outputs={state.outputs}
        smartCard={state.smartCard}
        readiness={state.readiness}
        assets={state.creativeAssets}
        discoveryQr={state.discoveryQr}
      />;
}

function DistributionOverview({
  creative,
  outputs,
  smartCard,
  readiness,
  assets,
  discoveryQr,
}: Pick<State, 'outputs' | 'smartCard' | 'readiness' | 'discoveryQr'> & {
  creative: CampaignCreativeData;
  assets: CreativeAssetReference[];
}) {
  const interactiveOutput = outputs.find(item => item.output_type === 'interactive_ad');
  const usableDiscoveryQr = isDistributionQrUsable(discoveryQr) ? discoveryQr : null;
  const qrPublicUrl = usableDiscoveryQr
    ? `${window.location.origin}/q/${usableDiscoveryQr.slug}`
    : null;
  const { resolved, content, exactQr } = useMemo(() => buildDestinationCreativeView({
    metadata: interactiveOutput?.metadata,
    destination: 'discovery',
    campaign: creative.campaign,
    businessName: creative.businessName,
    businessPhone: creative.phone,
    businessWebsite: creative.website,
    businessLogoUrl: creative.businessLogoUrl,
    primaryColor: creative.primaryColor,
    accentColor: creative.accentColor,
    assets,
    qr: usableDiscoveryQr,
    qrPublicUrl,
    fallbackImageUrl: creative.campaignImageUrl,
    fallbackDestinationUrl: creative.campaignUrl,
  }), [assets, creative, interactiveOutput?.metadata, qrPublicUrl, usableDiscoveryQr]);
  const discoveryReadiness = readiness?.sections.find(section => section.key === 'discovery')?.status;
  const savedPreviewReady = discoveryReadiness === 'ready' && resolved.issues.length === 0;
  const savedPreviewStatus = savedPreviewReady
    ? 'Ready'
    : discoveryReadiness === 'blocked' ? 'Blocked' : 'Needs attention';
  const templateLabel = CAMPAIGN_TEMPLATE_REGISTRY[resolved.settings.template].label;
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
      <AdpadzCard variant="featured" className="overflow-hidden p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)] lg:items-center">
          <section aria-label="Saved Consumer Discovery creative preview" className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neon">Saved creative preview</p>
                <p className="mt-1 text-xs font-bold text-[var(--text-secondary)]">Consumer Discovery · {resolved.format === 'card' ? 'Card' : resolved.format}</p>
              </div>
              <AdpadzBadge variant={savedPreviewReady ? 'verified' : 'status'}>{savedPreviewStatus}</AdpadzBadge>
            </div>
            <div
              data-testid="saved-distribution-creative"
              className="mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-black/25"
              style={{ containerType: 'inline-size' }}
            >
              <CampaignTemplateRenderer
                content={content}
                settings={resolved.renderSettings}
                destination={resolved.rendererDestination}
                qrArtwork={exactQr ? <QRStudioPreview qr={exactQr} /> : undefined}
              />
            </div>
            {resolved.issues.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[10px] font-bold leading-relaxed text-amber-100" role="status">
                {resolved.issues.join(' ')}
              </div>
            )}
          </section>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <AdpadzBadge variant="campaign">Publish</AdpadzBadge>
              <AdpadzBadge variant="status">Read-only</AdpadzBadge>
            </div>
            <h2 className="mt-4 text-2xl font-bold">Hand this campaign to its destinations</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">Review the saved destination creative here. Design changes stay in Creative Workshop so every output continues from one approved campaign.</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div><dt className="text-[var(--text-muted)]">Destination</dt><dd className="mt-1 font-black">Discovery</dd></div>
              <div><dt className="text-[var(--text-muted)]">Template</dt><dd className="mt-1 font-black">{templateLabel}</dd></div>
              <div><dt className="text-[var(--text-muted)]">Format</dt><dd className="mt-1 font-black capitalize">{resolved.format}</dd></div>
              <div><dt className="text-[var(--text-muted)]">Readiness</dt><dd className="mt-1 font-black">{savedPreviewStatus}</dd></div>
            </dl>
            <p className="mt-3 text-[10px] text-[var(--text-muted)]">{creativeSourceLabel(resolved.source, 'Discovery')} · saved Campaign creative</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <AdpadzButton href={`/app/business/campaigns/${creative.campaign.id}/creative`} variant="secondary" size="sm"><Sparkles className="h-4 w-4" /> Open Creative Workshop</AdpadzButton>
              <AdpadzButton href={`/app/business/campaigns/${creative.campaign.id}/distribution/social`} variant="secondary" size="sm"><Download className="h-4 w-4" /> Export social asset</AdpadzButton>
              <AdpadzButton
                href={interactiveOutput?.enabled ? `/ad/${creative.campaign.id}` : `/app/business/campaigns/${creative.campaign.id}/edit?section=outputs`}
                size="sm"
              >
                <ExternalLink className="h-4 w-4" /> {interactiveOutput?.enabled ? 'Open published campaign' : 'Prepare to publish'}
              </AdpadzButton>
            </div>
          </div>
        </div>
      </AdpadzCard>
      <AdpadzSection eyebrow="One campaign · many destinations" title="Where this campaign can go" description="Each destination reads the same approved campaign and Business Hub information.">
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
function SocialDistributionWorkspace({
  creative,
  output,
  assets,
  socialQr,
}: {
  creative: CampaignCreativeData;
  output?: CampaignOutputRecord;
  assets: CreativeAssetReference[];
  socialQr: QRLinkRecord | null;
}) {
  const usableSocialQr = isDistributionQrUsable(socialQr) ? socialQr : null;
  const qrPublicUrl = usableSocialQr ? `${window.location.origin}/q/${usableSocialQr.slug}` : null;
  const { resolved, content, exactQr } = useMemo(() => buildDestinationCreativeView({
    metadata: output?.metadata,
    destination: 'social',
    campaign: creative.campaign,
    businessName: creative.businessName,
    businessPhone: creative.phone,
    businessWebsite: creative.website,
    businessLogoUrl: creative.businessLogoUrl,
    primaryColor: creative.primaryColor,
    accentColor: creative.accentColor,
    assets,
    qr: usableSocialQr,
    qrPublicUrl,
    fallbackImageUrl: creative.campaignImageUrl,
    fallbackDestinationUrl: creative.campaignUrl,
  }), [assets, creative, output?.metadata, qrPublicUrl, usableSocialQr]);
  const format = resolved.format as SocialFormatKey;
  const preset = getSocialFormat(format);
  const previewWidth = `min(100%, ${Math.round(7000 * preset.width / preset.height) / 100}vh)`;
  const effectiveCreative = useMemo<CampaignCreativeData>(() => ({
    ...creative,
    campaignImageUrl: resolved.imageUrl,
    campaignUrl: resolved.qrDestinationUrl ?? creative.campaignUrl,
  }), [creative, resolved.imageUrl, resolved.qrDestinationUrl]);
  const suggestedCaption = useMemo(() => buildSuggestedCaption(effectiveCreative), [effectiveCreative]);
  const [caption, setCaption] = useState(suggestedCaption);
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const readiness = evaluateDistributionReadiness(effectiveCreative, {
    template: resolved.settings.template,
    showQr: resolved.renderSettings.showQr,
  });
  const deliveryReady = readiness.ready && resolved.issues.length === 0;
  const templateLabel = CAMPAIGN_TEMPLATE_REGISTRY[resolved.settings.template].label;

  async function copyCaption() {
    try {
      await copyTextToClipboard(caption);
      setMessage('Caption copied.');
    } catch {
      setMessage('Could not copy the caption.');
    }
  }

  async function download() {
    if (!previewRef.current || !deliveryReady) return;
    setExporting(true);
    setMessage('');
    try {
      await exportSocialCreativeElement(
        previewRef.current,
        format,
        creative.businessName,
        creative.campaign.title,
      );
      setMessage(`${preset.width} × ${preset.height} PNG downloaded from the saved Social creative.`);
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neon">Social Media · Manual posting</p>
        <h2 className="mt-1 text-2xl font-bold">Export social creative</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">Review the saved Social creative, download its exact rendered design, then copy the editable caption into the social account you already use.</p>
      </div>
      {message && <div role="status" aria-live="polite" className="rounded-2xl border border-neon/25 bg-neon/[0.08] p-4 text-sm font-bold text-neon">{message}</div>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section aria-label="Saved creative preview" className="order-1 xl:sticky xl:top-6 xl:self-start">
          <AdpadzCard variant="featured" className="p-3 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div><p className="text-xs font-black">Saved Social preview</p><p className="text-[10px] text-[var(--text-muted)]">{preset.width} × {preset.height} PNG</p></div>
              <AdpadzBadge variant={deliveryReady ? 'verified' : 'status'}>{deliveryReady ? 'Ready' : 'Needs attention'}</AdpadzBadge>
            </div>
            <div className="mx-auto flex max-h-[70vh] justify-center overflow-hidden rounded-2xl bg-black/30">
              <div
                ref={previewRef}
                data-testid="saved-social-creative"
                className="h-auto max-h-[70vh] max-w-full overflow-hidden rounded-2xl"
                style={{ aspectRatio: `${preset.width} / ${preset.height}`, containerType: 'inline-size', width: previewWidth }}
              >
                <CampaignTemplateRenderer
                  content={content}
                  settings={resolved.renderSettings}
                  destination={resolved.rendererDestination}
                  qrArtwork={exactQr ? <QRStudioPreview qr={exactQr} /> : undefined}
                  className="rounded-2xl"
                />
              </div>
            </div>
            <AdpadzButton type="button" onClick={() => void download()} disabled={!deliveryReady || exporting} fullWidth size="lg" className="mt-4">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{exporting ? 'Creating PNG...' : 'Download image'}</AdpadzButton>
            <p className="mt-3 text-[10px] leading-relaxed text-[var(--text-muted)]">The PNG is rasterized from this shared Campaign Template renderer. If an owned image cannot be embedded safely, export stops instead of substituting a different design.</p>
          </AdpadzCard>
        </section>
        <div className="order-2 space-y-5">
          <AdpadzCard variant="flat" className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-neon">Saved creative</p><h2 className="mt-1 text-base font-black">{templateLabel}</h2></div>
              <AdpadzBadge variant="status">{creativeSourceLabel(resolved.source)}</AdpadzBadge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><dt className="text-[var(--text-muted)]">Destination</dt><dd className="mt-1 font-black">Social</dd></div>
              <div><dt className="text-[var(--text-muted)]">Format</dt><dd className="mt-1 font-black">{preset.label}</dd></div>
              <div><dt className="text-[var(--text-muted)]">Image</dt><dd className="mt-1 font-black capitalize">{resolved.imageResolution}</dd></div>
              <div><dt className="text-[var(--text-muted)]">QR</dt><dd className="mt-1 font-black capitalize">{resolved.settings.showQr ? resolved.qrResolution : 'Hidden'}</dd></div>
            </dl>
            <p className="mt-4 text-[10px] leading-relaxed text-[var(--text-muted)]">Creative settings are read-only in Distribution so the saved Workshop design remains the single source of truth.</p>
            <AdpadzButton href={`/app/business/campaigns/${creative.campaign.id}/creative`} variant="secondary" fullWidth className="mt-4"><Sparkles className="h-4 w-4" /> Open Creative Workshop</AdpadzButton>
          </AdpadzCard>
          {resolved.issues.length > 0 && <AdpadzCard variant="flat" className="border-amber-400/30 bg-amber-400/[0.07] p-5" role="status"><h2 className="font-black text-amber-200">Saved creative needs attention</h2><ul className="mt-3 list-disc space-y-2 pl-4 text-xs text-amber-100">{resolved.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></AdpadzCard>}
          {!readiness.ready && <AdpadzCard variant="flat" className="border-amber-400/30 bg-amber-400/[0.07] p-5" role="status"><h2 className="font-black text-amber-200">Complete this campaign</h2><div className="mt-3 space-y-3">{readiness.issues.map(issue => <div key={issue.field} className="flex items-center justify-between gap-3"><p className="text-xs text-amber-100">{issue.message}</p><AdpadzButton href={issueHref(creative.campaign.id, issue.section)} variant="secondary" size="sm">{issue.action}</AdpadzButton></div>)}</div></AdpadzCard>}
          <AdpadzCard variant="flat" className="p-5">
            <label htmlFor="social-caption" className="text-sm font-black">Suggested caption</label>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">Edit freely. Changes stay in this workspace and do not alter campaign creative.</p>
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

function creativeSourceLabel(
  source: ReturnType<typeof resolveDestinationCreative>['source'],
  destination = 'Social',
) {
  if (source === 'workshop-override') return `${destination} override`;
  if (source === 'workshop-global') return 'Global settings';
  return 'Legacy settings';
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
    const campaignResult = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('owner_id', auth.user.id)
      .maybeSingle();
    if (campaignResult.error) throw new Error(campaignResult.error.message);
    if (!campaignResult.data) throw new Error('Campaign not found.');

    const campaign = campaignResult.data as CampaignRecord;
    const cardRequest = campaign.business_id
      ? supabase
          .from('business_cards')
          .select('id,business_name,slug,logo_url,cover_image_url,primary_color,accent_color,website,phone,address,is_published')
          .eq('owner_user_id', auth.user.id)
          .eq('business_id', campaign.business_id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });
    const businessRequest = campaign.business_id
      ? supabase
          .from('businesses')
          .select('name,category,service_area,address,website,phone,active')
          .eq('id', campaign.business_id)
          .eq('owner_user_id', auth.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });
    const [outputsResult, cardResult, businessResult] = await Promise.all([
      supabase.from('campaign_outputs').select('*').eq('campaign_id', campaignId).order('sort_order'),
      cardRequest,
      businessRequest,
    ]);
    if (outputsResult.error) throw new Error(outputsResult.error.message);
    if (cardResult.error) throw new Error(cardResult.error.message);
    if (businessResult.error) throw new Error(businessResult.error.message);

    const outputs = (outputsResult.data ?? []) as CampaignOutputRecord[];
    const card = cardResult.data;
    const business = businessResult.data;
    const interactiveOutput = outputs.find(item => item.output_type === 'interactive_ad');
    const unresolvedDiscovery = resolveDestinationCreative(interactiveOutput?.metadata, 'discovery');
    const unresolvedSocial = resolveDestinationCreative(interactiveOutput?.metadata, 'social');
    const assetIds = Array.from(new Set([
      campaign.primary_image_id,
      unresolvedDiscovery.imageAssetId,
      unresolvedSocial.imageAssetId,
    ].filter((id): id is string => Boolean(id))));
    const discoveryQrId = unresolvedDiscovery.qrId
      ?? (unresolvedDiscovery.source === 'legacy' ? campaign.primary_qr_id ?? null : null);
    const socialQrId = unresolvedSocial.qrId
      ?? (unresolvedSocial.source === 'legacy' ? campaign.primary_qr_id ?? null : null);
    const qrIds = Array.from(new Set([
      discoveryQrId,
      socialQrId,
    ].filter((id): id is string => Boolean(id))));

    const [assetsResult, qrResult] = await Promise.all([
      assetIds.length
        ? supabase.from('business_marketing_assets').select('id,file_url,external_url,thumbnail_url').eq('owner_id', auth.user.id).in('id', assetIds)
        : Promise.resolve({ data: [], error: null }),
      qrIds.length
        ? supabase.from('qr_links').select('*').eq('owner_user_id', auth.user.id).in('id', qrIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (assetsResult.error) throw new Error(assetsResult.error.message);
    if (qrResult.error) throw new Error(qrResult.error.message);

    const creativeAssets = (assetsResult.data ?? []) as CreativeAssetReference[];
    const assetMap = new Map(creativeAssets.map(asset => [asset.id, asset]));
    const primaryImage = campaign.primary_image_id ? assetMap.get(campaign.primary_image_id) : null;
    const primaryImageUrl = primaryImage?.file_url
      || primaryImage?.thumbnail_url
      || primaryImage?.external_url
      || card?.cover_image_url
      || null;
    const campaignUrl = absolutePublicUrl(
      campaign.cta_url || (card?.slug ? `/c/${card.slug}#offers` : null),
    );
    const creativeQrLinks = (qrResult.data ?? []) as QRLinkRecord[];
    const discoveryQr = creativeQrLinks.find(qr => qr.id === discoveryQrId) ?? null;
    const socialQr = creativeQrLinks.find(qr => qr.id === socialQrId) ?? null;

    return {
      creative: {
        campaign,
        businessName: business?.name || card?.business_name || 'Your business',
        businessLogoUrl: card?.logo_url || null,
        campaignImageUrl: primaryImageUrl,
        primaryColor: card?.primary_color || '#14251b',
        accentColor: card?.accent_color || '#b0ff00',
        website: business?.website || card?.website || null,
        phone: business?.phone || card?.phone || null,
        category: business?.category || null,
        city: parseCity(business?.service_area || business?.address || card?.address),
        campaignUrl,
      },
      outputs,
      smartCard: card ? { slug: card.slug, is_published: card.is_published } : null,
      readiness: evaluateCampaignReadiness({
        campaign,
        campaignImageUrl: primaryImageUrl,
        outputs,
        business: {
          name: business?.name || card?.business_name,
          logoUrl: card?.logo_url,
          category: business?.category,
          location: business?.service_area || business?.address || card?.address,
          website: business?.website || card?.website,
          phone: business?.phone || card?.phone,
          profilePublished: card?.is_published ?? false,
          active: business?.active ?? false,
        },
        qr: campaign.primary_qr_id ? {
          exists: true,
          valid: Boolean(campaignUrl),
          publishable: campaign.status !== 'expired',
          publicRouteResolves: Boolean(campaignUrl),
        } : null,
      }),
      creativeAssets,
      discoveryQr,
      socialQr,
      loading: false,
      error: null,
    };
  } catch (error) {
    return {
      ...initialState,
      loading: false,
      error: error instanceof Error ? error.message : 'Could not load campaign distribution.',
    };
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

function parseCity(address: unknown): string | null {
  if (typeof address === 'string') return address.split(',')[0]?.trim() || null;
  if (address && typeof address === 'object' && 'city' in address && typeof address.city === 'string') return address.city;
  return null;
}
