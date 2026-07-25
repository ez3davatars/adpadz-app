import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftRight, Building2, Check, FileText, Image as ImageIcon, Instagram, Loader2,
  Mail, Megaphone, MonitorSmartphone, MousePointerClick, Save, Upload,
  Smartphone, Zap, type LucideIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SMART_CARD_CAMPAIGN_SECTIONS, type CampaignOutputRecord, type CampaignRecord } from '../../lib/ads';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzSection } from '../../components/adpadz-ui';
import { evaluateCampaignReadiness } from '../../lib/campaignReadiness';
import { CampaignReadinessSummary } from '../../components/campaign-readiness/CampaignReadinessSummary';
import { uploadSmartCardImage } from '../../lib/cloudflareImages';
import { clampImagePosition, clampImageZoom, normalizeImageFit, type ImageFitMode } from '../../lib/smartCards';
import {
  CAMPAIGN_TEMPLATES,
  CampaignTemplateRenderer,
  DEFAULT_TEMPLATE_SETTINGS,
  evaluateTemplateReadiness,
  normalizeCampaignContent,
  normalizeTemplateSettings,
  type CampaignTemplateContent,
  type CampaignTemplateKey,
  type CampaignTemplateSettings,
} from '../../features/campaign-templates';

type AdType = 'tap_reveal' | 'scratch' | 'before_after';
type CampaignStatus = 'draft' | 'active' | 'scheduled' | 'expired';
type OutputType = 'smart_card' | 'interactive_ad' | 'community_mailer' | 'qr_landing' | 'facebook' | 'instagram' | 'email' | 'flyer';

type SmartCardChoice = {
  id: string;
  business_id: string | null;
  business_name: string;
  slug: string;
  is_published: boolean;
  cover_image_url: string | null;
  logo_url: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
};

type AssetChoice = {
  id: string;
  title: string;
  asset_type: string;
  file_url: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
};

type BusinessHubChoice = {
  id: string;
  name: string;
  category: string | null;
  service_area: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  active: boolean;
};

const formats: Array<{ value: AdType; label: string; description: string; icon: LucideIcon }> = [
  { value: 'tap_reveal', label: 'Tap to Reveal', description: 'A simple, accessible offer reveal.', icon: Zap },
  { value: 'scratch', label: 'Scratch & Win', description: 'Customers drag or tap to uncover the offer.', icon: MousePointerClick },
  { value: 'before_after', label: 'Before / After', description: 'A visual comparison for results-driven services.', icon: ArrowLeftRight },
];

const outputOptions: Array<{ value: OutputType; label: string; description: string; icon: LucideIcon }> = [
  { value: 'interactive_ad', label: 'Interactive Campaign', description: 'Publish to the public discovery feed.', icon: Zap },
  { value: 'smart_card', label: 'Business Profile', description: 'Feature it on a published Smart Card.', icon: Smartphone },
  { value: 'community_mailer', label: 'Community Mailer', description: 'Prepare neighborhood mailer copy.', icon: Megaphone },
  { value: 'qr_landing', label: 'QR Landing', description: 'Make the campaign available as a QR destination.', icon: MonitorSmartphone },
  { value: 'facebook', label: 'Facebook', description: 'Generate reusable post copy.', icon: FileText },
  { value: 'instagram', label: 'Instagram', description: 'Generate caption-ready copy.', icon: Instagram },
  { value: 'email', label: 'Email', description: 'Generate subject and body copy.', icon: Mail },
  { value: 'flyer', label: 'Flyer', description: 'Generate print-ready content.', icon: ImageIcon },
];

const defaultOutputs: Record<OutputType, boolean> = {
  interactive_ad: true,
  smart_card: false,
  community_mailer: false,
  qr_landing: false,
  facebook: false,
  instagram: false,
  email: false,
  flyer: false,
};

export default function BizCreateAd() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(campaignId);
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [offerTitle, setOfferTitle] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Claim Offer');
  const [ctaUrl, setCtaUrl] = useState('');
  const [format, setFormat] = useState<AdType>('tap_reveal');
  const [tone, setTone] = useState('friendly');
  const [status, setStatus] = useState<CampaignStatus>('draft');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [primaryAssetId, setPrimaryAssetId] = useState('');
  const [secondaryImageUrl, setSecondaryImageUrl] = useState('');
  const [imageFit, setImageFit] = useState<ImageFitMode>('cover');
  const [imagePositionX, setImagePositionX] = useState(50);
  const [imagePositionY, setImagePositionY] = useState(50);
  const [imageZoom, setImageZoom] = useState(1);
  const [templateSettings, setTemplateSettings] = useState<CampaignTemplateSettings>(DEFAULT_TEMPLATE_SETTINGS);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [outputs, setOutputs] = useState<Record<OutputType, boolean>>(defaultOutputs);
  const [smartCards, setSmartCards] = useState<SmartCardChoice[]>([]);
  const [assets, setAssets] = useState<AssetChoice[]>([]);
  const [businessHub, setBusinessHub] = useState<BusinessHubChoice | null>(null);
  const [selectedSmartCardId, setSelectedSmartCardId] = useState('');
  const [smartCardSection, setSmartCardSection] = useState('promotions');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStudio() {
      setLoading(true);
      setError(null);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw new Error(authError.message);
        const userId = authData.user?.id;
        if (!userId) throw new Error('Sign in to open Campaign Studio.');

        const [cardResult, assetResult, businessResult] = await Promise.all([
          supabase.from('business_cards').select('id,business_id,business_name,slug,is_published,cover_image_url,logo_url,website,phone,address').eq('owner_user_id', userId).order('updated_at', { ascending: false }),
          supabase.from('business_marketing_assets').select('id,title,asset_type,file_url,external_url,thumbnail_url').eq('owner_id', userId).eq('is_active', true).order('updated_at', { ascending: false }),
          supabase.from('businesses').select('id,name,category,service_area,address,website,phone,active').eq('owner_user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (cardResult.error) throw new Error(cardResult.error.message);
        if (assetResult.error) throw new Error(assetResult.error.message);
        if (businessResult.error) throw new Error(businessResult.error.message);

        const loadedCards = (cardResult.data ?? []) as SmartCardChoice[];
        if (!cancelled) {
          setSmartCards(loadedCards);
          setAssets((assetResult.data ?? []) as AssetChoice[]);
          setBusinessHub((businessResult.data ?? null) as BusinessHubChoice | null);
          if (loadedCards.length === 1) setSelectedSmartCardId(loadedCards[0].id);
        }

        if (campaignId) {
          const [campaignResult, outputResult] = await Promise.all([
            supabase.from('campaigns').select('*').eq('id', campaignId).eq('owner_id', userId).single(),
            supabase.from('campaign_outputs').select('*').eq('campaign_id', campaignId).order('sort_order', { ascending: true }),
          ]);
          if (campaignResult.error) throw new Error(campaignResult.error.message);
          if (outputResult.error) throw new Error(outputResult.error.message);
          if (cancelled) return;
          hydrateEditor(campaignResult.data as CampaignRecord, (outputResult.data ?? []) as CampaignOutputRecord[]);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load Campaign Studio.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadStudio();
    return () => { cancelled = true; };
  }, [campaignId]);

  function hydrateEditor(campaign: CampaignRecord, savedOutputs: CampaignOutputRecord[]) {
    setCampaignName(campaign.title || '');
    setHeadline(campaign.headline || '');
    setDescription(campaign.description || '');
    setOfferTitle(campaign.offer_title || '');
    setOfferDescription(campaign.offer_description || '');
    setCtaLabel(campaign.cta_label || 'Claim Offer');
    setCtaUrl(campaign.cta_url || '');
    setStatus(isCampaignStatus(campaign.status) ? campaign.status : 'draft');
    setStartDate(toLocalDateTime(campaign.start_date));
    setEndDate(toLocalDateTime(campaign.end_date));
    setPrimaryAssetId(campaign.primary_image_id || '');

    const selection = { ...defaultOutputs };
    for (const output of savedOutputs) {
      if (isOutputType(output.output_type)) selection[output.output_type] = output.enabled;
    }
    setOutputs(selection);

    const interactive = savedOutputs.find(output => output.output_type === 'interactive_ad');
    const interactiveMetadata = interactive?.metadata ?? {};
    if (typeof interactiveMetadata.format === 'string' && isAdType(interactiveMetadata.format)) setFormat(interactiveMetadata.format);
    if (typeof interactiveMetadata.tone === 'string') setTone(interactiveMetadata.tone);
    if (typeof interactiveMetadata.secondary_image_url === 'string') setSecondaryImageUrl(interactiveMetadata.secondary_image_url);
    setImageFit(normalizeImageFit(typeof interactiveMetadata.image_fit === 'string' ? interactiveMetadata.image_fit : undefined));
    setImagePositionX(clampImagePosition(asImageNumber(interactiveMetadata.image_position_x)));
    setImagePositionY(clampImagePosition(asImageNumber(interactiveMetadata.image_position_y)));
    setImageZoom(clampImageZoom(asImageNumber(interactiveMetadata.image_zoom)));
    const savedTemplateMetadata = savedOutputs.find(output => output.metadata?.template_settings)?.metadata?.template_settings;
    setTemplateSettings(normalizeTemplateSettings(interactiveMetadata.template_settings ?? savedTemplateMetadata));

    const cardOutput = savedOutputs.find(output => output.output_type === 'smart_card');
    const cardMetadata = cardOutput?.metadata ?? {};
    if (typeof cardMetadata.smart_card_id === 'string') setSelectedSmartCardId(cardMetadata.smart_card_id);
    if (typeof cardMetadata.section === 'string') setSmartCardSection(cardMetadata.section);
  }

  const selectedAsset = useMemo(() => assets.find(asset => asset.id === primaryAssetId) ?? null, [assets, primaryAssetId]);
  const selectedCard = useMemo(() => smartCards.find(card => card.id === selectedSmartCardId) ?? null, [selectedSmartCardId, smartCards]);
  const previewImage = selectedAsset?.file_url || selectedAsset?.thumbnail_url || selectedAsset?.external_url || selectedCard?.cover_image_url || null;
  const templateContent = useMemo(() => normalizeCampaignContent({
    campaign: {
      id: campaignId || 'new-campaign', owner_id: 'current-owner', title: campaignName,
      headline, description, offer_title: offerTitle, offer_description: offerDescription,
      cta_label: ctaLabel, cta_url: ctaUrl, status, start_date: startDate || null,
      end_date: endDate || null, primary_image_id: primaryAssetId || null,
    },
    businessName: businessHub?.name || selectedCard?.business_name,
    businessLogoUrl: selectedCard?.logo_url,
    imageUrl: previewImage,
    destinationUrl: ctaUrl || null,
    primaryColor: '#14251b',
    accentColor: '#b6ff00',
  }), [businessHub?.name, campaignId, campaignName, ctaLabel, ctaUrl, description, endDate, headline, offerDescription, offerTitle, previewImage, primaryAssetId, selectedCard?.business_name, selectedCard?.logo_url, startDate, status]);
  const templateReadiness = useMemo(() => evaluateTemplateReadiness(templateContent, templateSettings), [templateContent, templateSettings]);
const selectedOutputCount = Object.values(outputs).filter(Boolean).length;
  const liveReadiness = useMemo(() => evaluateCampaignReadiness({
    campaign: { id: campaignId || 'new-campaign', owner_id: 'current-owner', title: campaignName, headline, description, offer_title: offerTitle, offer_description: offerDescription, cta_label: ctaLabel, cta_url: ctaUrl, status, start_date: startDate || null, end_date: endDate || null, primary_image_id: primaryAssetId || null },
    business: { name: businessHub?.name || selectedCard?.business_name, logoUrl: selectedCard?.logo_url, category: businessHub?.category, location: businessHub?.service_area || businessHub?.address || selectedCard?.address, website: businessHub?.website || selectedCard?.website, phone: businessHub?.phone || selectedCard?.phone, profilePublished: selectedCard?.is_published ?? false, active: businessHub?.active ?? false },
    campaignImageUrl: previewImage,
    outputs: outputOptions.filter(option => outputs[option.value]).map((option, index) => ({ campaign_id: campaignId || 'new-campaign', output_type: option.value, enabled: true, sort_order: index })),
    qr: null,
  }), [businessHub, campaignId, campaignName, ctaLabel, ctaUrl, description, endDate, headline, offerDescription, offerTitle, outputs, previewImage, primaryAssetId, selectedCard, startDate, status]);

  function updateOutput(type: OutputType) {
    setOutputs(current => ({ ...current, [type]: !current[type] }));
  }

  async function uploadCampaignImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const uploadCard = (selectedCard?.business_id === businessHub?.id ? selectedCard : null) ?? smartCards.find(card => card.business_id === businessHub?.id);
    if (!uploadCard) {
      setError('Create a Business Profile before uploading campaign images. The uploaded image will be stored in Asset Library.');
      return;
    }

    setUploadingImage(true);
    setUploadProgress('Preparing image...');
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      const userId = authData.user?.id;
      if (!userId || !businessHub) throw new Error('Sign in and finish Business Settings before uploading an image.');
      const result = await uploadSmartCardImage({
        file,
        cardId: uploadCard.id,
        imageType: 'gallery',
        onProgress: progress => setUploadProgress(progress.label),
      });
      const title = file.name.replace(/\.[^.]+$/, '').trim() || 'Campaign image';
      const { data: asset, error: assetError } = await supabase.from('business_marketing_assets').insert({
        business_id: businessHub.id,
        smart_card_id: uploadCard.id,
        owner_id: userId,
        asset_type: 'image',
        title,
        file_url: result.imageUrl,
        thumbnail_url: result.imageUrl,
        provider: 'cloudflare_images',
        provider_asset_id: result.imageId,
        mime_type: file.type,
        file_size_bytes: file.size,
        is_active: true,
      }).select('id,title,asset_type,file_url,external_url,thumbnail_url').single();
      if (assetError) throw new Error(assetError.message);
      const uploadedAsset = asset as AssetChoice;
      setAssets(current => [uploadedAsset, ...current.filter(item => item.id !== uploadedAsset.id)]);
      setPrimaryAssetId(uploadedAsset.id);
      setImagePositionX(50);
      setImagePositionY(50);
      setImageZoom(1);
      setUploadProgress('Image ready');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the campaign image.');
      setUploadProgress('');
    } finally {
      setUploadingImage(false);
    }
  }
  function nextStep() {
    setError(null);
    if (step === 2 && (!campaignName.trim() || !headline.trim())) {
      setError('Add a campaign name and customer-facing headline before continuing.');
      return;
    }
    if (step === 3) {
      if (selectedOutputCount === 0) {
        setError('Choose at least one campaign output.');
        return;
      }
      if (outputs.smart_card && !selectedSmartCardId) {
        setError('Choose the Business Profile that should display this campaign.');
        return;
      }
      if (outputs.smart_card && selectedCard?.business_id !== businessHub?.id) {
        setError('Reconnect this Business Profile to the current Business Hub in Settings before using it as an output.');
        return;
      }
    }
    setStep(current => Math.min(4, current + 1));
  }

  async function saveCampaign() {
    setSaving(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      const userId = authData.user?.id;
      if (!userId) throw new Error('Sign in before saving a campaign.');
      if (!businessHub) throw new Error('Create the Business Hub in Settings before saving campaigns.');
      if (!businessHub.active && status !== 'draft') throw new Error('Activate the Business Hub before publishing or scheduling campaigns.');
      if (!campaignName.trim() || !headline.trim()) throw new Error('Campaign name and headline are required.');
      if (selectedOutputCount === 0) throw new Error('Choose at least one campaign output.');
      if (outputs.smart_card && selectedCard?.business_id !== businessHub.id) throw new Error('The selected Business Profile is not connected to this Business Hub.');
      if (status === 'scheduled' && !startDate) throw new Error('Scheduled campaigns require a start date.');
      if (startDate && endDate && new Date(endDate) < new Date(startDate)) throw new Error('The campaign end date must be after its start date.');

      const normalizedCtaUrl = normalizeOptionalUrl(ctaUrl);
      const campaignPayload = {
        owner_id: userId,
        business_id: businessHub.id,
        title: campaignName.trim(),
        headline: headline.trim(),
        description: description.trim() || null,
        offer_title: offerTitle.trim() || null,
        offer_description: offerDescription.trim() || null,
        cta_label: ctaLabel.trim() || 'Learn More',
        cta_url: normalizedCtaUrl,
        status,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        primary_image_id: primaryAssetId || null,
      };

      const outputPayloads = outputOptions
        .filter(option => outputs[option.value])
        .map((option, index) => ({
          output_type: option.value,
          enabled: true,
          sort_order: index,
          metadata: buildOutputMetadata(option.value),
        }));

      const { data, error: saveError } = await supabase.rpc('save_campaign_bundle', {
        p_campaign: campaignPayload,
        p_outputs: outputPayloads,
        p_campaign_id: campaignId || null,
      });
      if (saveError) throw new Error(saveError.message);
      const savedId = typeof data === 'string' ? data : campaignId;
      if (!savedId) throw new Error('Campaign saved, but the response did not include its ID.');

      const [reloadCampaign, reloadOutputs] = await Promise.all([
        supabase.from('campaigns').select('*').eq('id', savedId).eq('owner_id', userId).single(),
        supabase.from('campaign_outputs').select('*').eq('campaign_id', savedId),
      ]);
      if (reloadCampaign.error) throw new Error(reloadCampaign.error.message);
      if (reloadOutputs.error) throw new Error(reloadOutputs.error.message);

      navigate(`/app/business/campaigns/${savedId}/content`);
    } catch (saveFailure) {
      setError(saveFailure instanceof Error ? saveFailure.message : 'Could not save the campaign.');
    } finally {
      setSaving(false);
    }
  }

  function buildOutputMetadata(type: OutputType): Record<string, unknown> {
    if (type === 'interactive_ad') return { format, tone, secondary_image_url: secondaryImageUrl.trim() || null, image_fit: imageFit, image_position_x: imagePositionX, image_position_y: imagePositionY, image_zoom: imageZoom, template_settings: { ...templateSettings, imageFit, imagePositionX, imagePositionY, imageZoom } };
    const template_settings = { ...templateSettings, imageFit: imageFit === 'contain' ? 'contain' : 'cover', imagePositionX, imagePositionY, imageZoom };
    if (type === 'smart_card') return { smart_card_id: selectedSmartCardId, section: smartCardSection, template_settings };
    return { channel: type, prepared_from_campaign: true, template_settings };
  }

  if (loading) {
    return <p className="flex min-h-64 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-5 w-5 animate-spin text-neon" /> Loading Campaign Studio...</p>;
  }

  if (!businessHub) {
    return (
      <AdpadzCard variant="flat" className="mx-auto max-w-2xl p-8 text-center">
        <Building2 className="mx-auto h-10 w-10 text-neon" />
        <h1 className="mt-4 text-2xl font-black">Create the Business Hub first</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--text-muted)]">Campaigns need the permanent business identity, ownership, and contact details that every output references.</p>
        <AdpadzButton href="/app/business/settings" className="mt-6">Open Business Settings</AdpadzButton>
      </AdpadzCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Campaign Engine</p>
          <h1 className="text-2xl font-black">{editing ? 'Edit Campaign' : 'Create Campaign'}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Enter the promotion once, then choose every customer experience it should power.</p>
        </div>
        {editing && campaignId && <div className="flex flex-wrap gap-2"><AdpadzButton href={`/app/business/campaigns/${campaignId}/creative`}>Design Creative</AdpadzButton><AdpadzButton href={`/app/business/campaigns/${campaignId}/content`} variant="secondary">Marketing Package</AdpadzButton></div>}
      </div>

      {error && <AdpadzCard variant="flat" className="border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100" role="alert">{error}</AdpadzCard>}

      <CampaignReadinessSummary result={liveReadiness} />

      <div className="grid grid-cols-4 gap-2" aria-label="Campaign Studio progress">
        {['Format', 'Campaign', 'Outputs', 'Review'].map((label, index) => (
          <button key={label} type="button" onClick={() => index + 1 < step && setStep(index + 1)} className="text-left" aria-current={step === index + 1 ? 'step' : undefined}>
            <span className={`block h-1.5 rounded-full ${index + 1 <= step ? 'bg-neon' : 'bg-[var(--bg-input)]'}`} />
            <span className={`mt-1 block text-[10px] font-bold ${index + 1 <= step ? 'text-neon' : 'text-[var(--text-muted)]'}`}>{label}</span>
          </button>
        ))}
      </div>

      {step === 1 && (
        <AdpadzSection eyebrow="Engagement" title="Choose the interactive experience" description="The format is output metadata. Campaign content remains the single source of truth.">
          <div className="grid gap-3 md:grid-cols-3">
            {formats.map(option => (
              <button key={option.value} type="button" onClick={() => setFormat(option.value)} aria-pressed={format === option.value} className={`rounded-3xl border p-5 text-left transition ${format === option.value ? 'border-neon bg-neon/[0.08]' : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-neon/40'}`}>
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${format === option.value ? 'bg-neon text-black' : 'bg-white/[0.06] text-[var(--text-muted)]'}`}><option.icon className="h-5 w-5" /></span>
                <span className="mt-4 block text-sm font-black">{option.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-[var(--text-muted)]">{option.description}</span>
                {format === option.value && <Check className="mt-3 h-4 w-4 text-neon" />}
              </button>
            ))}
          </div>
          <div className="mt-6"><AdpadzButton type="button" onClick={nextStep}>Continue</AdpadzButton></div>
        </AdpadzSection>
      )}

      {step === 2 && (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
          <AdpadzSection eyebrow="Single source of truth" title="Campaign content">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Internal campaign name" required><input value={campaignName} onChange={event => setCampaignName(event.target.value)} className="input-field" placeholder="Summer service special" /></Field>
              <Field label="Customer-facing headline" required><input value={headline} onChange={event => setHeadline(event.target.value)} className="input-field" placeholder="Your summer upgrade is here" maxLength={90} /></Field>
            </div>
            <Field label="Description" className="mt-4"><textarea value={description} onChange={event => setDescription(event.target.value)} className="input-field resize-y" rows={4} placeholder="Explain why this campaign matters to local customers." maxLength={500} /></Field>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Offer title"><input value={offerTitle} onChange={event => setOfferTitle(event.target.value)} className="input-field" placeholder="20% off your first visit" /></Field>
              <Field label="Offer details"><input value={offerDescription} onChange={event => setOfferDescription(event.target.value)} className="input-field" placeholder="New customers Ãƒâ€šÃ‚Â· weekdays only" /></Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="CTA label"><input value={ctaLabel} onChange={event => setCtaLabel(event.target.value)} className="input-field" /></Field>
              <Field label="CTA URL"><input type="url" value={ctaUrl} onChange={event => setCtaUrl(event.target.value)} className="input-field" placeholder="https://..." /></Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Status">
                <select value={status} onChange={event => setStatus(event.target.value as CampaignStatus)} className="input-field">
                  <option value="draft">Draft</option><option value="active">Active now</option><option value="scheduled">Scheduled</option><option value="expired">Archived</option>
                </select>
              </Field>
              <Field label="Start"><input type="datetime-local" value={startDate} onChange={event => setStartDate(event.target.value)} className="input-field" /></Field>
              <Field label="End"><input type="datetime-local" value={endDate} onChange={event => setEndDate(event.target.value)} className="input-field" /></Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Primary Business Hub asset">
                <select value={primaryAssetId} onChange={event => setPrimaryAssetId(event.target.value)} className="input-field">
                  <option value="">Use Business Profile cover</option>
                  {assets.map(asset => <option key={asset.id} value={asset.id}>{asset.title} Ãƒâ€šÃ‚Â· {asset.asset_type}</option>)}
                </select>
              </Field>
              <Field label="Tone">
                <select value={tone} onChange={event => setTone(event.target.value)} className="input-field">
                  <option value="friendly">Friendly</option><option value="professional">Professional</option><option value="playful">Playful</option><option value="urgent">Urgent</option>
                </select>
              </Field>
            </div>
            <AdpadzCard variant="flat" className="mt-4 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-black">Offer image framing</p><p className="mt-1 text-xs text-[var(--text-muted)]">Upload once to Asset Library, then position and zoom it for this offer.</p></div>
                <label className={`btn-secondary cursor-pointer px-4 py-2.5 text-sm ${uploadingImage ? 'pointer-events-none opacity-60' : ''}`}>
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {uploadingImage ? uploadProgress : 'Upload image'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingImage} onChange={event => void uploadCampaignImage(event)} />
                </label>
              </div>
              {previewImage && (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-bold text-[var(--text-secondary)]">Image fit</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setImageFit('cover')} className={`rounded-xl border px-3 py-2 text-xs font-bold ${imageFit === 'cover' ? 'border-neon bg-neon/10 text-neon' : 'border-[var(--border-default)] text-[var(--text-secondary)]'}`}>Fill frame</button>
                      <button type="button" onClick={() => { setImageFit('contain'); setImageZoom(1); }} className={`rounded-xl border px-3 py-2 text-xs font-bold ${imageFit === 'contain' ? 'border-neon bg-neon/10 text-neon' : 'border-[var(--border-default)] text-[var(--text-secondary)]'}`}>Show entire image</button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <RangeControl label="Horizontal position" value={imagePositionX} display={`${Math.round(imagePositionX)}%`} min={0} max={100} step={1} onChange={value => setImagePositionX(clampImagePosition(value))} />
                    <RangeControl label="Vertical position" value={imagePositionY} display={`${Math.round(imagePositionY)}%`} min={0} max={100} step={1} onChange={value => setImagePositionY(clampImagePosition(value))} />
                    <RangeControl label="Zoom" value={imageZoom} display={`${imageZoom.toFixed(2)}x`} min={1} max={3} step={0.05} onChange={value => setImageZoom(clampImageZoom(value))} />
                    <button type="button" className="btn-secondary px-3 py-2 text-xs md:col-span-3" onClick={() => { setImageFit('cover'); setImagePositionX(50); setImagePositionY(50); setImageZoom(1); }}>Reset image framing</button>
                  </div>
                </div>
              )}
            </AdpadzCard>
            {format === 'before_after' && <Field label="After image URL" className="mt-4"><input type="url" value={secondaryImageUrl} onChange={event => setSecondaryImageUrl(event.target.value)} className="input-field" placeholder="https://..." /><span className="mt-1 block text-[10px] text-[var(--text-muted)]">The primary asset is used as the before image.</span></Field>}
            <div className="mt-6 flex gap-2"><AdpadzButton type="button" variant="secondary" onClick={() => setStep(1)}>Back</AdpadzButton><AdpadzButton type="button" onClick={nextStep}>Choose outputs</AdpadzButton></div>
          </AdpadzSection>
          {editing && campaignId ? <CreativeSummary campaignId={campaignId} content={templateContent} settings={{ ...templateSettings, imageFit: imageFit === 'contain' ? 'contain' : 'cover', imagePositionX, imagePositionY, imageZoom }} /> : <TemplateStudioPreview content={templateContent} settings={{ ...templateSettings, imageFit: imageFit === 'contain' ? 'contain' : 'cover', imagePositionX, imagePositionY, imageZoom }} onChange={setTemplateSettings} ready={templateReadiness.ready} issues={[...templateReadiness.blockers, ...templateReadiness.warnings].map(issue => issue.message)} />}
        </div>
      )}

      {step === 3 && (
        <AdpadzSection eyebrow="Publish everywhere" title="Choose campaign outputs" description="Every selected output references this campaign. No promotional copy is duplicated.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {outputOptions.map(option => (
              <button key={option.value} type="button" onClick={() => updateOutput(option.value)} aria-pressed={outputs[option.value]} className={`rounded-3xl border p-4 text-left transition ${outputs[option.value] ? 'border-neon bg-neon/[0.08]' : 'border-[var(--border-default)] bg-[var(--bg-input)] hover:border-neon/40'}`}>
                <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${outputs[option.value] ? 'bg-neon text-black' : 'bg-white/[0.06] text-[var(--text-muted)]'}`}><option.icon className="h-4 w-4" /></span>
                <span className="mt-3 block text-sm font-black">{option.label}</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-[var(--text-muted)]">{option.description}</span>
              </button>
            ))}
          </div>
          {outputs.smart_card && (
            <AdpadzCard variant="flat" className="mt-5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Business Profile">
                  <select value={selectedSmartCardId} onChange={event => setSelectedSmartCardId(event.target.value)} className="input-field">
                    <option value="">Choose a Business Profile</option>
                    {smartCards.map(card => <option key={card.id} value={card.id}>{card.business_name} Ãƒâ€šÃ‚Â· {card.is_published ? 'Published' : 'Draft'}</option>)}
                  </select>
                </Field>
                <Field label="Profile section">
                  <select value={smartCardSection} onChange={event => setSmartCardSection(event.target.value)} className="input-field">
                    {SMART_CARD_CAMPAIGN_SECTIONS.map(section => <option key={section.value} value={section.value}>{section.label}</option>)}
                  </select>
                </Field>
              </div>
              {selectedCard && !selectedCard.is_published && <p className="mt-3 text-xs font-bold text-amber-300">This Business Profile is still a draft. The attachment will save, but customers cannot see it until the profile is published.</p>}
            </AdpadzCard>
          )}
          <div className="mt-6 flex gap-2"><AdpadzButton type="button" variant="secondary" onClick={() => setStep(2)}>Back</AdpadzButton><AdpadzButton type="button" onClick={nextStep}>Review campaign</AdpadzButton></div>
        </AdpadzSection>
      )}

      {step === 4 && (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
          <AdpadzSection eyebrow="Review" title="One campaign, one source of truth">
            <AdpadzCard variant="flat" className="divide-y divide-white/10">
              <ReviewRow label="Campaign" value={campaignName} /><ReviewRow label="Headline" value={headline} /><ReviewRow label="Offer" value={offerTitle || 'No offer title'} /><ReviewRow label="Status" value={status} /><ReviewRow label="Format" value={formats.find(item => item.value === format)?.label || format} /><ReviewRow label="Outputs" value={`${selectedOutputCount} selected`} />
            </AdpadzCard>
            <div className="mt-5 flex flex-wrap gap-2">
              <AdpadzButton type="button" variant="secondary" onClick={() => setStep(3)}>Back</AdpadzButton>
              <AdpadzButton type="button" onClick={() => void saveCampaign()} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {editing ? 'Save Campaign' : 'Create Campaign'}</AdpadzButton>
            </div>
          </AdpadzSection>
          {editing && campaignId ? <CreativeSummary campaignId={campaignId} content={templateContent} settings={{ ...templateSettings, imageFit: imageFit === 'contain' ? 'contain' : 'cover', imagePositionX, imagePositionY, imageZoom }} /> : <TemplateStudioPreview content={templateContent} settings={{ ...templateSettings, imageFit: imageFit === 'contain' ? 'contain' : 'cover', imagePositionX, imagePositionY, imageZoom }} onChange={setTemplateSettings} ready={templateReadiness.ready} issues={[...templateReadiness.blockers, ...templateReadiness.warnings].map(issue => issue.message)} />}
        </div>
      )}
    </div>
  );
}

function Field({ label, required = false, className = '', children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">{label}{required ? ' *' : ''}</span>{children}</label>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm"><span className="text-[var(--text-muted)]">{label}</span><span className="text-right font-black capitalize">{value}</span></div>;
}

function CreativeSummary({ campaignId, content, settings }: { campaignId: string; content: CampaignTemplateContent; settings: CampaignTemplateSettings }) {
  return <AdpadzCard variant="featured" className="p-4"><div className="aspect-square overflow-hidden rounded-2xl" style={{ containerType: 'inline-size' }}><CampaignTemplateRenderer content={content} settings={settings} destination="studio" /></div><div className="mt-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-neon">Creative summary</p><p className="mt-1 text-sm font-black">{CAMPAIGN_TEMPLATES.find(item => item.key === settings.template)?.label}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">Open the dedicated workspace to refine every destination without duplicating campaign content.</p><AdpadzButton href={`/app/business/campaigns/${campaignId}/creative`} fullWidth className="mt-4">Design Creative</AdpadzButton></div></AdpadzCard>;
}
function TemplateStudioPreview({ content, settings, onChange, ready, issues }: { content: CampaignTemplateContent; settings: CampaignTemplateSettings; onChange: (settings: CampaignTemplateSettings) => void; ready: boolean; issues: string[] }) {
  const destinations = [
    { key: 'mailer' as const, label: 'Mailer', ratio: 'aspect-[4/3]' },
    { key: 'discovery' as const, label: 'Discovery', ratio: 'aspect-square' },
    { key: 'qr' as const, label: 'QR landing', ratio: 'aspect-[3/4]' },
    { key: 'social-square' as const, label: 'Social', ratio: 'aspect-square' },
  ];
  const update = (patch: Partial<CampaignTemplateSettings>) => onChange({ ...settings, ...patch });
  return <div className="space-y-4">
    <AdpadzCard variant="featured" className="p-4">
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">Live destination previews</p><p className="text-[10px] text-[var(--text-muted)]">Unsaved campaign state Â· one canonical template</p></div><AdpadzBadge variant={ready ? 'verified' : 'status'}>{ready ? 'Ready' : 'Needs attention'}</AdpadzBadge></div>
      <div className="mt-4 grid grid-cols-2 gap-3">{destinations.map(destination => <div key={destination.key}><p className="mb-1 text-[10px] font-bold text-[var(--text-muted)]">{destination.label}</p><div className={`${destination.ratio} container-type-inline-size overflow-hidden rounded-xl border border-white/10`} style={{ containerType: 'inline-size' }}><CampaignTemplateRenderer content={content} settings={settings} destination={destination.key} /></div></div>)}</div>
      {issues.length > 0 && <ul className="mt-3 space-y-1 text-[10px] text-amber-200">{issues.map(message => <li key={message}>â€¢ {message}</li>)}</ul>}
    </AdpadzCard>
    <AdpadzCard variant="flat" className="space-y-4 p-4">
      <div><p className="mb-2 text-xs font-black">Template family</p><div className="grid gap-2">{CAMPAIGN_TEMPLATES.map(template => <button key={template.key} type="button" onClick={() => update({ template: template.key as CampaignTemplateKey })} aria-pressed={settings.template === template.key} className={`rounded-xl border p-3 text-left ${settings.template === template.key ? 'border-neon bg-neon/10' : 'border-white/10'}`}><span className="block text-xs font-black">{template.label}</span><span className="mt-1 block text-[10px] text-[var(--text-muted)]">{template.description}</span></button>)}</div></div>
      <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => update({ theme: 'dark' })} className={`rounded-xl border p-2 text-xs font-bold ${settings.theme === 'dark' ? 'border-neon text-neon' : 'border-white/10'}`}>Dark</button><button type="button" onClick={() => update({ theme: 'light' })} className={`rounded-xl border p-2 text-xs font-bold ${settings.theme === 'light' ? 'border-neon text-neon' : 'border-white/10'}`}>Light</button></div>
      <label className="flex items-center justify-between gap-3 text-xs font-bold"><span>Show QR code</span><input type="checkbox" checked={settings.showQr} onChange={event => update({ showQr: event.target.checked })} className="h-5 w-5 accent-[var(--neon)]" /></label>
      <label className="flex items-center justify-between gap-3 text-xs font-bold"><span>Show expiration</span><input type="checkbox" checked={settings.showExpiration} onChange={event => update({ showExpiration: event.target.checked })} className="h-5 w-5 accent-[var(--neon)]" /></label>
    </AdpadzCard>
  </div>;
}
function RangeControl({ label, value, display, min, max, step, onChange }: { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-2 flex justify-between gap-2 text-xs font-bold text-[var(--text-secondary)]"><span>{label}</span><span className="text-[var(--text-muted)]">{display}</span></span><input type="range" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} className="w-full accent-[var(--brand-primary)]" /></label>;
}
function asImageNumber(value: unknown): number | string | undefined {
  return typeof value === 'number' || typeof value === 'string' ? value : undefined;
}
function normalizeOptionalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('CTA URL must be a complete web address beginning with http:// or https://.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('CTA URL must use http:// or https://.');
  return parsed.toString();
}

function toLocalDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function isCampaignStatus(value: string): value is CampaignStatus {
  return ['draft', 'active', 'scheduled', 'expired'].includes(value);
}

function isAdType(value: string): value is AdType {
  return ['tap_reveal', 'scratch', 'before_after'].includes(value);
}

function isOutputType(value: string): value is OutputType {
  return outputOptions.some(option => option.value === value);
}
