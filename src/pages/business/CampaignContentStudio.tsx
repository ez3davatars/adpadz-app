import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgePercent, CalendarDays, Check, ChevronDown, Copy,
  ExternalLink, FileText, Image, Mail, Megaphone, MessageSquare,
  QrCode, RadioTower, Smartphone, Sparkles, Users, Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { copyTextToClipboard } from '../../lib/clipboard';
import {
  AdpadzBadge,
  AdpadzButton,
  AdpadzCard,
  AdpadzPill,
  AdpadzSection,
} from '../../components/adpadz-ui';
import type { CampaignOutputRecord, CampaignRecord } from '../../lib/ads';

type SmartCardSummary = {
  id: string;
  business_name: string;
  slug: string;
  tagline?: string | null;
  is_published: boolean;
  booking_enabled: boolean;
  booking_request_enabled: boolean;
  lead_form_enabled: boolean;
};

type ContentStudioState = {
  campaign: CampaignRecord | null;
  outputs: CampaignOutputRecord[];
  smartCard: SmartCardSummary | null;
  loading: boolean;
  error: string | null;
};

type ReadinessState = 'Ready' | 'Needs info';

type ReadinessItem = {
  label: string;
  status: ReadinessState;
  detail: string;
  icon: typeof Smartphone;
};

type CopyOutput = {
  key: string;
  title: string;
  eyebrow: string;
  icon: typeof MessageSquare;
  text: string;
  buttonLabel: string;
};

type PackagePreview = {
  key: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: typeof Smartphone;
  previewHref: string;
  status: ReadinessState;
  copy?: CopyOutput;
};

const initialState: ContentStudioState = {
  campaign: null,
  outputs: [],
  smartCard: null,
  loading: true,
  error: null,
};

export default function CampaignContentStudio() {
  const { campaignId } = useParams();
  const [state, setState] = useState<ContentStudioState>(initialState);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMarketingPackage() {
      setState(current => ({ ...current, loading: true, error: null }));
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw new Error(authError.message);
        const userId = authData.user?.id;
        if (!userId) throw new Error('Sign in to load this campaign preview.');
        if (!campaignId) throw new Error('Missing campaign ID.');

        const { data: campaign, error: campaignError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', campaignId)
          .eq('owner_id', userId)
          .single();
        if (campaignError) throw new Error(campaignError.message);

        const { data: outputs, error: outputError } = await supabase
          .from('campaign_outputs')
          .select('*')
          .eq('campaign_id', campaignId)
          .order('sort_order', { ascending: true });
        if (outputError) throw new Error(outputError.message);

        const outputRows = (outputs ?? []) as CampaignOutputRecord[];
        const smartCardId = getSmartCardId(outputRows);
        let smartCard: SmartCardSummary | null = null;

        if (smartCardId) {
          const { data: card, error: cardError } = await supabase
            .from('business_cards')
            .select('id,business_name,slug,tagline,is_published,booking_enabled,booking_request_enabled,lead_form_enabled')
            .eq('id', smartCardId)
            .eq('owner_user_id', userId)
            .maybeSingle();
          if (cardError) throw new Error(cardError.message);
          smartCard = (card ?? null) as SmartCardSummary | null;
        }

        if (!cancelled) {
          setState({ campaign: campaign as CampaignRecord, outputs: outputRows, smartCard, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Could not load campaign preview.' }));
        }
      }
    }

    void loadMarketingPackage();
    return () => { cancelled = true; };
  }, [campaignId]);

  const campaign = state.campaign;
  const content = useMemo(() => campaign ? buildCampaignContent(campaign, state.smartCard) : null, [campaign, state.smartCard]);
  const outputsByType = useMemo(() => new Map(state.outputs.map(output => [output.output_type, output])), [state.outputs]);
  const copyOutputs = useMemo(() => campaign && content ? buildCopyOutputs(content) : [], [campaign, content]);
  const readiness = useMemo(() => campaign && content ? buildReadiness(campaign, state.smartCard, outputsByType) : [], [campaign, content, outputsByType, state.smartCard]);
  const packagePreviews = useMemo(() => campaign && content ? buildPackagePreviews(content, readiness, copyOutputs, outputsByType) : [], [campaign, content, copyOutputs, outputsByType, readiness]);

  async function handleCopy(key: string, value: string) {
    try {
      await copyTextToClipboard(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(current => current === key ? null : current), 1800);
    } catch (error) {
      if (import.meta.env.DEV) console.error('[CampaignContentStudio] copy failed', error);
    }
  }

  if (state.loading) {
    return <p className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-[var(--text-muted)]">Loading campaign preview...</p>;
  }

  if (state.error || !campaign || !content) {
    return (
      <AdpadzCard variant="flat" className="border-amber-400/30 bg-amber-500/10 p-6 text-amber-100">
        <h1 className="text-xl font-black">Could not load Campaign Preview</h1>
        <p className="mt-2 text-sm opacity-80">{state.error ?? 'This campaign could not be found.'}</p>
        <AdpadzButton href="/app/business/campaigns" variant="secondary" className="mt-5"><ArrowLeft className="h-4 w-4" /> Back to Campaigns</AdpadzButton>
      </AdpadzCard>
    );
  }

  const smartCardUrl = state.smartCard?.is_published ? `/c/${state.smartCard.slug}` : null;
  const reachMetrics = buildReachMetrics(readiness);
  const readyCount = readiness.filter(item => item.status === 'Ready').length;
  const campaignIsReady = readyCount === readiness.length && readiness.length > 0;

  return (
    <div className="space-y-8">
      <AdpadzButton href="/app/business/campaigns" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Campaigns</AdpadzButton>

      <AdpadzCard variant="featured" className="p-8 sm:p-10 lg:p-12">
        <div className="grid gap-10 xl:grid-cols-[0.9fr_1.1fr] xl:items-center">
          <div>
            <AdpadzBadge variant={campaignIsReady ? 'verified' : 'status'} className="mb-6">
              <Check className="h-3.5 w-3.5" /> {campaignIsReady ? 'Campaign ready' : `${readyCount} of ${readiness.length} paths ready`}
            </AdpadzBadge>
            <h1 className="text-4xl font-black leading-none sm:text-6xl">Campaign package.</h1>
            <p className="mt-6 max-w-2xl text-xl font-bold leading-relaxed text-neutral-200">
              One Campaign Engine record now powers every prepared output shown below.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <AdpadzPill><CalendarDays className="h-3.5 w-3.5 text-neon" /> {content.dateRange}</AdpadzPill>
              <AdpadzPill><Sparkles className="h-3.5 w-3.5 text-neon" /> {content.businessName}</AdpadzPill>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {readiness.slice(0, 6).map(item => <ReadyIcon key={item.label} item={item} />)}
          </div>
        </div>
      </AdpadzCard>

      <AdpadzSection eyebrow="Customer Journey" title="One campaign becomes the full local path to purchase." description="This is the story your customer experiences from mailbox to lead capture.">
        <div className="grid gap-4 md:grid-cols-7 md:items-stretch">
          {journeySteps.map((step, index) => (
            <JourneyStep key={step.label} step={step} isLast={index === journeySteps.length - 1} />
          ))}
        </div>
      </AdpadzSection>

      <AdpadzSection eyebrow="Marketing Package" title="Preview every campaign experience" description="Large sales-demo cards generated from the same Campaign Engine record. No duplicate content, no separate builders.">
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {packagePreviews.map(preview => (
            <PackagePreviewCard
              key={preview.key}
              preview={preview}
              copied={copiedKey === preview.copy?.key}
              onCopy={preview.copy ? () => void handleCopy(preview.copy!.key, preview.copy!.text) : undefined}
            />
          ))}
        </div>
      </AdpadzSection>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdpadzSection eyebrow="Campaign Reach" title="Ready to meet customers where they are">
          <div className="grid gap-4 sm:grid-cols-2">
            {reachMetrics.map(metric => <ReachMetric key={metric.label} metric={metric} />)}
          </div>
        </AdpadzSection>

        <AdpadzCard variant="glass" className="p-8 sm:p-10">
          <AdpadzBadge variant="local" className="mb-6"><Megaphone className="h-3.5 w-3.5" /> Campaign package</AdpadzBadge>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">{campaignIsReady ? 'Ready to publish' : 'Setup in progress'}</p>
          <h2 className="mt-3 text-4xl font-black leading-tight">One campaign.</h2>
          <h3 className="text-3xl font-black leading-tight text-neon">Multiple marketing experiences.</h3>
          <p className="mt-5 text-sm leading-relaxed text-neutral-300">
            Adpadz turns one Campaign Engine record into the assets a local business needs to sell, share, print, scan, and convert.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {smartCardUrl && <AdpadzButton href={smartCardUrl} variant="secondary"><ExternalLink className="h-4 w-4" /> Open Business Profile</AdpadzButton>}
            <AdpadzButton href="#package-business-profile"><Sparkles className="h-4 w-4" /> Preview package</AdpadzButton>
          </div>
        </AdpadzCard>
      </div>

      <AdpadzSection eyebrow="Preview Details" title="Generated content preview" description="Copy can be saved through the Publishing Workspace. External posting appears only after the business authorizes a supported platform account.">
        <div className="grid gap-4 lg:grid-cols-2">
          {copyOutputs.map(output => (
            <CopyPreviewCard
              key={output.key}
              output={output}
              copied={copiedKey === output.key}
              onCopy={() => void handleCopy(output.key, output.text)}
            />
          ))}
        </div>
      </AdpadzSection>
    </div>
  );
}

const journeySteps = [
  { label: 'Community Mailer', icon: Megaphone },
  { label: 'QR Scan', icon: QrCode },
  { label: 'Interactive Ad', icon: Zap },
  { label: 'Business Profile', icon: Smartphone },
  { label: 'Offer', icon: BadgePercent },
  { label: 'Booking', icon: CalendarDays },
  { label: 'Lead', icon: Users },
];

function ReadyIcon({ item }: { item: ReadinessItem }) {
  const isReady = item.status === 'Ready';
  return (
    <AdpadzCard as="article" variant={isReady ? 'glass' : 'flat'} className="p-5 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-neon text-black shadow-[0_18px_45px_rgba(176,255,0,0.2)]">
        <item.icon className="h-7 w-7" />
      </div>
      <h2 className="text-sm font-black">{item.label}</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{item.status}</p>
    </AdpadzCard>
  );
}

function JourneyStep({ step, isLast }: { step: { label: string; icon: typeof Megaphone }; isLast: boolean }) {
  return (
    <div className="relative flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.08] text-neon">
        <step.icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-black">{step.label}</p>
      {!isLast && <ChevronDown className="h-5 w-5 text-[var(--text-muted)] md:absolute md:-right-3 md:top-1/2 md:-translate-y-1/2 md:-rotate-90" />}
    </div>
  );
}

function PackagePreviewCard({ preview, copied, onCopy }: { preview: PackagePreview; copied: boolean; onCopy?: () => void }) {
  return (
    <AdpadzCard id={`package-${preview.key}`} as="article" variant="glass" className="group flex min-h-[280px] flex-col justify-between p-6 transition hover:border-neon/40">
      <div>
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-neon text-black">
            <preview.icon className="h-7 w-7" />
          </div>
          <AdpadzBadge variant={preview.status === 'Ready' ? 'verified' : 'status'}>{preview.status}</AdpadzBadge>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">{preview.eyebrow}</p>
        <h3 className="mt-2 text-2xl font-black leading-tight">{preview.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">{preview.description}</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <AdpadzButton href={preview.previewHref} variant="secondary" size="sm"><ExternalLink className="h-4 w-4" /> Preview</AdpadzButton>
        {preview.copy && onCopy && (
          <AdpadzButton type="button" variant="ghost" size="sm" onClick={onCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </AdpadzButton>
        )}
      </div>
    </AdpadzCard>
  );
}

function ReachMetric({ metric }: { metric: { label: string; value: string; detail: string; icon: typeof Megaphone } }) {
  return (
    <AdpadzCard as="article" variant="flat" className="p-5">
      <metric.icon className="mb-5 h-6 w-6 text-neon" />
      <p className="text-3xl font-black">{metric.value}</p>
      <h3 className="mt-2 text-sm font-black">{metric.label}</h3>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{metric.detail}</p>
    </AdpadzCard>
  );
}

function CopyPreviewCard({ output, copied, onCopy }: { output: CopyOutput; copied: boolean; onCopy: () => void }) {
  return (
    <AdpadzCard id={`preview-${output.key}`} as="article" variant="flat" className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.08] text-neon"><output.icon className="h-5 w-5" /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{output.eyebrow}</p>
            <h3 className="text-base font-black">{output.title}</h3>
          </div>
        </div>
        <AdpadzButton type="button" variant="secondary" size="sm" onClick={onCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : output.buttonLabel}
        </AdpadzButton>
      </div>
      <pre className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-neutral-200">{output.text}</pre>
    </AdpadzCard>
  );
}

function buildCampaignContent(campaign: CampaignRecord, smartCard: SmartCardSummary | null) {
  const businessName = smartCard?.business_name || 'Your business';
  const offerTitle = clean(campaign.offer_title) || clean(campaign.headline) || clean(campaign.title) || 'Featured local offer';
  const offerDescription = clean(campaign.offer_description) || clean(campaign.description) || 'A limited-time local campaign prepared through Adpadz.';
  const headline = clean(campaign.headline) || clean(campaign.title) || offerTitle;
  const description = clean(campaign.description) || offerDescription;
  const ctaLabel = clean(campaign.cta_label) || 'Claim Offer';
  const shortDescription = truncateSentence(description, 115);
  const dateRange = formatDateRange(campaign.start_date, campaign.end_date);

  return { businessName, offerTitle, offerDescription, headline, description, ctaLabel, shortDescription, dateRange };
}

function buildCopyOutputs(content: ReturnType<typeof buildCampaignContent>): CopyOutput[] {
  const facebook = `${content.headline}\n\n${content.businessName} is running ${content.offerTitle}. ${content.offerDescription}. Tap below to learn more or claim the offer.\n\n${content.ctaLabel}`;
  const instagram = `Local deal alert: ${content.offerTitle} from ${content.businessName}. ${content.shortDescription}\n\n${content.ctaLabel}\n\n#SupportLocal #LocalDeals #Adpadz`;
  const google = `Looking for local savings? ${content.businessName} is offering ${content.offerTitle}. ${content.offerDescription}. Contact us today or claim the offer through Adpadz.\n\n${content.ctaLabel}`;
  const email = `Subject: ${content.offerTitle} from ${content.businessName}\n\nHi there,\n\n${content.businessName} is currently offering ${content.offerTitle}.\n\n${content.offerDescription}\n\n${content.description}\n\n${content.ctaLabel}\n\nOffer valid ${content.dateRange}.`;
  const flyer = `${content.headline}\n\n${content.offerTitle}\n${content.offerDescription}\n\n${content.ctaLabel}\n\nFeatured through Adpadz local marketing.`;

  return [
    { key: 'facebook', title: 'Facebook Post', eyebrow: 'Social copy', icon: MessageSquare, text: facebook, buttonLabel: 'Copy Text' },
    { key: 'instagram', title: 'Instagram Caption', eyebrow: 'Caption', icon: Image, text: instagram, buttonLabel: 'Copy Caption' },
    { key: 'google', title: 'Google Business Post', eyebrow: 'Local SEO', icon: Sparkles, text: google, buttonLabel: 'Copy Post' },
    { key: 'email', title: 'Email Copy', eyebrow: 'Email', icon: Mail, text: email, buttonLabel: 'Copy Email' },
    { key: 'flyer', title: 'Flyer Copy', eyebrow: 'Print copy', icon: FileText, text: flyer, buttonLabel: 'Copy Flyer Text' },
  ];
}

function buildReadiness(campaign: CampaignRecord, smartCard: SmartCardSummary | null, outputsByType: Map<string, CampaignOutputRecord>): ReadinessItem[] {
  const hasCoreContent = Boolean(clean(campaign.headline) || clean(campaign.offer_title) || clean(campaign.description));
  const smartCardOutput = outputsByType.get('smart_card');
  const interactiveOutput = outputsByType.get('interactive_ad');
  const mailerOutput = outputsByType.get('community_mailer');
  const qrOutput = outputsByType.get('qr_landing');
  const bookingReady = Boolean(smartCard?.is_published && (smartCard.booking_enabled || smartCard.booking_request_enabled));
  const leadReady = Boolean(smartCard?.is_published && smartCard.lead_form_enabled);

  return [
    {
      label: 'Business Profile',
      status: smartCardOutput?.enabled && smartCard?.is_published ? 'Ready' : 'Needs info',
      detail: smartCard?.is_published ? `Connected to ${smartCard.business_name}.` : 'Connect and publish a Business Profile output.',
      icon: Smartphone,
    },
    {
      label: 'Interactive Campaign',
      status: interactiveOutput?.enabled ? 'Ready' : 'Needs info',
      detail: interactiveOutput?.enabled ? 'Interactive campaign output is enabled.' : 'Enable the interactive campaign output from Campaign Studio.',
      icon: Zap,
    },
    { label: 'Community Mailer', status: mailerOutput?.enabled && hasCoreContent ? 'Ready' : 'Needs info', detail: mailerOutput?.enabled ? 'Mailer output is saved on this campaign.' : 'Enable the Community Mailer output in Campaign Studio.', icon: Megaphone },
    { label: 'QR Experience', status: qrOutput?.enabled || smartCardOutput?.enabled ? 'Ready' : 'Needs info', detail: qrOutput?.enabled ? 'QR landing output is enabled.' : 'Enable QR Landing or connect a Business Profile.', icon: QrCode },
    { label: 'Booking', status: bookingReady ? 'Ready' : 'Needs info', detail: bookingReady ? 'Published Business Profile has a booking path.' : 'Enable booking or booking requests on the published Business Profile.', icon: CalendarDays },
    { label: 'Lead Tracking', status: leadReady ? 'Ready' : 'Needs info', detail: leadReady ? 'Published Business Profile has lead capture enabled.' : 'Enable the lead form on the published Business Profile.', icon: Users },
  ];
}

function buildPackagePreviews(content: ReturnType<typeof buildCampaignContent>, readiness: ReadinessItem[], copyOutputs: CopyOutput[], outputsByType: Map<string, CampaignOutputRecord>): PackagePreview[] {
  const byKey = new Map(copyOutputs.map(output => [output.key, output]));
  const statusFor = (label: string): ReadinessState => readiness.find(item => item.label === label)?.status ?? 'Ready';
  const interactiveEnabled = outputsByType.get('interactive_ad')?.enabled === true;

  return [
    { key: 'business-profile', title: 'Business Profile', eyebrow: content.businessName, description: `${content.offerTitle} appears inside the public business landing experience.`, icon: Smartphone, previewHref: '#preview-facebook', status: statusFor('Business Profile') },
    { key: 'community-mailer', title: 'Community Mailer', eyebrow: 'Neighborhood distribution', description: 'A sales-ready mailer placement with campaign headline, offer, CTA, and QR path.', icon: Megaphone, previewHref: '#preview-flyer', status: statusFor('Community Mailer') },
    { key: 'interactive-ad', title: 'Interactive Ad', eyebrow: interactiveEnabled ? 'Discovery output' : 'Preview pending', description: interactiveEnabled ? 'Interactive campaign output is enabled for engagement.' : 'Interactive preview can be connected when the output is enabled.', icon: Zap, previewHref: '#preview-facebook', status: interactiveEnabled ? 'Ready' : 'Needs info' },
    { key: 'facebook', title: 'Facebook', eyebrow: 'Social post', description: 'Share-ready local offer copy for Facebook.', icon: MessageSquare, previewHref: '#preview-facebook', status: outputsByType.get('facebook')?.enabled ? 'Ready' : 'Needs info', copy: byKey.get('facebook') },
    { key: 'instagram', title: 'Instagram', eyebrow: 'Caption', description: 'Short local caption with campaign CTA and hashtags.', icon: Image, previewHref: '#preview-instagram', status: outputsByType.get('instagram')?.enabled ? 'Ready' : 'Needs info', copy: byKey.get('instagram') },
    { key: 'google', title: 'Google Business', eyebrow: 'Local search', description: 'Local SEO-friendly preview copy built from the campaign offer.', icon: Sparkles, previewHref: '#preview-google', status: 'Needs info', copy: byKey.get('google') },
    { key: 'email', title: 'Email', eyebrow: 'Customer follow-up', description: 'Subject line and email body for the campaign.', icon: Mail, previewHref: '#preview-email', status: outputsByType.get('email')?.enabled ? 'Ready' : 'Needs info', copy: byKey.get('email') },
    { key: 'flyer', title: 'Flyer', eyebrow: 'Print copy', description: 'Headline, offer, and CTA for simple local flyers.', icon: FileText, previewHref: '#preview-flyer', status: outputsByType.get('flyer')?.enabled ? 'Ready' : 'Needs info', copy: byKey.get('flyer') },
  ];
}

function buildReachMetrics(readiness: ReadinessItem[]) {
  const qrReady = readiness.find(item => item.label === 'QR Experience')?.status === 'Ready';
  const mailerReady = readiness.find(item => item.label === 'Community Mailer')?.status === 'Ready';
  const bookingReady = readiness.find(item => item.label === 'Booking')?.status === 'Ready';
  const leadReady = readiness.find(item => item.label === 'Lead Tracking')?.status === 'Ready';
  return [
    { label: 'Community Mailer', value: mailerReady ? 'Ready' : 'Needs info', detail: 'Campaign can be previewed for neighborhood distribution.', icon: Megaphone },
    { label: 'QR Ready', value: qrReady ? 'Ready' : 'Needs info', detail: 'QR paths can drive customers into the Smart Card campaign experience.', icon: QrCode },
    { label: 'Booking Ready', value: bookingReady ? 'Ready' : 'Needs info', detail: 'Booking is ready only when a published Business Profile has a configured booking path.', icon: CalendarDays },
    { label: 'Lead Ready', value: leadReady ? 'Ready' : 'Needs info', detail: 'Lead capture is ready only when the published Business Profile form is enabled.', icon: RadioTower },
  ];
}

function getSmartCardId(outputs: CampaignOutputRecord[]): string | null {
  const output = outputs.find(item => item.output_type === 'smart_card' && item.enabled);
  const value = output?.metadata?.smart_card_id;
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function clean(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function truncateSentence(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trim()}...`;
}

function formatDateRange(start?: string | null, end?: string | null): string {
  const startText = formatDate(start);
  const endText = formatDate(end);
  if (startText === 'No date' && endText === 'No date') return 'while supplies last';
  if (startText !== 'No date' && endText !== 'No date') return `${startText} - ${endText}`;
  return startText !== 'No date' ? `starting ${startText}` : `through ${endText}`;
}

function formatDate(value?: string | null): string {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

