import { supabase } from './supabase';
import { isCampaignPublicNow, normalizeCampaignOutput, type CampaignOutputMetadata, type CampaignOutputRecord, type CampaignRecord } from './ads';
import { isUuid } from './ids';
import { safeHttpUrl } from './urls';
import { resolveDestinationCreative } from '../features/campaign-templates/creativeWorkshop';
import {
  normalizeQRStudioVisualArtwork,
  type QRStudioVisualArtwork,
} from './qr/qrArtwork';

export type PublicBusinessSummary = {
  id: string;
  business_name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  website: string | null;
  phone: string | null;
  primary_color: string;
  accent_color: string;
  is_published: boolean;
};

export type PublicCampaignAsset = {
  id: string;
  title: string;
  file_url: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  asset_type: string;
};

export type PublicCampaignExperience = {
  campaign: CampaignRecord;
  output: CampaignOutputRecord & { metadata: CampaignOutputMetadata };
  business: PublicBusinessSummary | null;
  asset: PublicCampaignAsset | null;
  creativeAssets: PublicCampaignAsset[];
  creativeQrArtwork: PublicCampaignQrArtwork;
};

export type CampaignEventType = 'view' | 'reveal' | 'cta_click' | 'share' | 'save' | 'offer_claim';
export type PublicCampaignQrDestination = 'discovery' | 'qr';
export type PublicCampaignQrArtwork = Partial<
  Record<PublicCampaignQrDestination, QRStudioVisualArtwork>
>;
export type PublicCampaignCreativeAssets = Partial<
  Record<PublicCampaignQrDestination, PublicCampaignAsset>
>;

type PublicCampaignAssetProjectionRow = {
  campaign_id?: unknown;
  destination?: unknown;
  asset?: unknown;
};

type PublicCampaignQrArtworkRow = {
  campaign_id?: unknown;
  destination?: unknown;
  qr_artwork?: unknown;
};

type ExpectedPublicCampaignAssetIds = ReadonlyMap<
  string,
  Partial<Record<PublicCampaignQrDestination, string>>
>;

type ExpectedPublicCampaignQrIds = ReadonlyMap<
  string,
  Partial<Record<PublicCampaignQrDestination, string>>
>;

type JoinedCampaignOutput = CampaignOutputRecord & {
  campaigns?: CampaignRecord | CampaignRecord[] | null;
};

const campaignJoin = `
  campaign_id,
  output_type,
  enabled,
  sort_order,
  metadata,
  created_at,
  updated_at,
  campaigns!inner(
    id,
    business_id,
    owner_id,
    title,
    headline,
    description,
    offer_title,
    offer_description,
    cta_label,
    cta_url,
    status,
    start_date,
    end_date,
    primary_image_id,
    primary_video_id,
    primary_qr_id,
    created_at,
    updated_at
  )
`;

export async function listPublicInteractiveCampaigns(limit = 30): Promise<PublicCampaignExperience[]> {
  const { data, error } = await supabase
    .from('campaign_outputs')
    .select(campaignJoin)
    .eq('output_type', 'interactive_ad')
    .eq('enabled', true)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return hydratePublicExperiences((data ?? []) as unknown as JoinedCampaignOutput[]);
}

export async function getPublicCampaignExperience(campaignId: string): Promise<PublicCampaignExperience | null> {
  if (!isUuid(campaignId)) return null;

  const { data, error } = await supabase
    .from('campaign_outputs')
    .select(campaignJoin)
    .eq('campaign_id', campaignId)
    .eq('output_type', 'interactive_ad')
    .eq('enabled', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const experiences = await hydratePublicExperiences([data as unknown as JoinedCampaignOutput]);
  return experiences[0] ?? null;
}

async function hydratePublicExperiences(rows: JoinedCampaignOutput[]): Promise<PublicCampaignExperience[]> {
  const scheduleEligible = rows
    .map(row => normalizeCampaignOutput(row))
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter(row => isCampaignPublicNow(row.campaign));

  if (scheduleEligible.length === 0) return [];

  const businessIds = Array.from(new Set(scheduleEligible
    .map(row => row.campaign.business_id)
    .filter((value): value is string => Boolean(value))));
  const { data: activeBusinesses, error: activeBusinessesError } = await supabase
    .from('businesses')
    .select('id')
    .in('id', businessIds)
    .eq('active', true);
  if (activeBusinessesError) throw new Error(activeBusinessesError.message);

  const activeBusinessIds = new Set((activeBusinesses ?? []).map(business => business.id));
  const normalized = scheduleEligible.filter(row => (
    row.campaign.business_id && activeBusinessIds.has(row.campaign.business_id)
  ));
  if (normalized.length === 0) return [];

  const campaignIds = normalized.map(row => row.campaign.id);
  const creativeAssetIdsByCampaign = new Map<string, string[]>();
  const expectedAssetIdsByCampaign = new Map<
    string,
    Partial<Record<PublicCampaignQrDestination, string>>
  >();
  const expectedQrIdsByCampaign = new Map<
    string,
    Partial<Record<PublicCampaignQrDestination, string>>
  >();
  for (const row of normalized) {
    const expectedAssetIds: Partial<Record<PublicCampaignQrDestination, string>> = {};
    const expectedQrIds: Partial<Record<PublicCampaignQrDestination, string>> = {};
    for (const destination of PUBLIC_CREATIVE_DESTINATIONS) {
      const creative = resolveDestinationCreative(row.metadata, destination);
      if (creative.imageAssetId) {
        expectedAssetIds[destination] = creative.imageAssetId;
      }
      if (creative.settings.showQr && creative.qrId) {
        expectedQrIds[destination] = creative.qrId;
      }
    }

    const assetIds = Array.from(new Set(Object.values(expectedAssetIds)));
    creativeAssetIdsByCampaign.set(row.campaign.id, assetIds);
    if (assetIds.length > 0) {
      expectedAssetIdsByCampaign.set(row.campaign.id, expectedAssetIds);
    }
    if (Object.keys(expectedQrIds).length > 0) {
      expectedQrIdsByCampaign.set(row.campaign.id, expectedQrIds);
    }
  }

  const primaryAssetIds = Array.from(new Set(normalized
    .map(row => row.campaign.primary_image_id)
    .filter((value): value is string => Boolean(value))));
  const assetCampaignIds = Array.from(expectedAssetIdsByCampaign.keys());
  const qrCampaignIds = Array.from(expectedQrIdsByCampaign.keys());
  const [
    smartOutputsResult,
    assetsResult,
    qrArtworkResult,
    creativeAssetsResult,
  ] = await Promise.all([
    supabase
      .from('campaign_outputs')
      .select('campaign_id,metadata')
      .in('campaign_id', campaignIds)
      .eq('output_type', 'smart_card')
      .eq('enabled', true),
    primaryAssetIds.length > 0
      ? supabase
          .from('business_marketing_assets')
          .select('id,title,file_url,external_url,thumbnail_url,asset_type')
          .in('id', primaryAssetIds)
      : Promise.resolve({ data: [], error: null }),
    qrCampaignIds.length > 0
      ? supabase.rpc('get_public_campaign_qr_artwork', {
          p_campaign_ids: qrCampaignIds,
        })
      : Promise.resolve({ data: [], error: null }),
    assetCampaignIds.length > 0
      ? supabase.rpc('get_public_campaign_creative_assets', {
          p_campaign_ids: assetCampaignIds,
        })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (smartOutputsResult.error) throw new Error(smartOutputsResult.error.message);
  if (assetsResult.error) throw new Error(assetsResult.error.message);
  if (qrArtworkResult.error && import.meta.env.DEV) {
    console.error('[Campaigns] public QR artwork projection unavailable', qrArtworkResult.error);
  }
  if (creativeAssetsResult.error && import.meta.env.DEV) {
    console.error('[Campaigns] public creative asset projection unavailable', creativeAssetsResult.error);
  }

  const smartCardIdByCampaign = new Map<string, string>();
  for (const output of smartOutputsResult.data ?? []) {
    const metadata = output.metadata as CampaignOutputMetadata | null;
    if (typeof metadata?.smart_card_id === 'string') {
      smartCardIdByCampaign.set(output.campaign_id, metadata.smart_card_id);
    }
  }

  const smartCardIds = Array.from(new Set(smartCardIdByCampaign.values()));
  const { data: cards, error: cardsError } = smartCardIds.length > 0
    ? await supabase
        .from('business_cards')
        .select('id,business_name,slug,tagline,logo_url,cover_image_url,website,phone,primary_color,accent_color,is_published')
        .in('id', smartCardIds)
        .eq('is_published', true)
    : { data: [], error: null };

  if (cardsError) throw new Error(cardsError.message);

  const cardsById = new Map((cards ?? []).map(card => [card.id, card as PublicBusinessSummary]));
  const assetsById = new Map((assetsResult.data ?? []).map(asset => [asset.id, asset as PublicCampaignAsset]));
  const creativeAssetsByCampaign = indexPublicCampaignCreativeAssets(
    creativeAssetsResult.data ?? [],
    expectedAssetIdsByCampaign,
  );
  const qrArtworkByCampaign = indexPublicCampaignQrArtwork(
    qrArtworkResult.data ?? [],
    expectedQrIdsByCampaign,
  );

  return normalized.map(row => {
    const smartCardId = smartCardIdByCampaign.get(row.campaign.id);
    const assetId = row.campaign.primary_image_id ?? undefined;
    const projectedAssets = creativeAssetsByCampaign.get(row.campaign.id) ?? {};
    const creativeAssets = (creativeAssetIdsByCampaign.get(row.campaign.id) ?? [])
      .map(id => Object.values(projectedAssets).find(asset => asset?.id === id)
        ?? (id === assetId ? assetsById.get(id) : undefined))
      .filter((asset): asset is PublicCampaignAsset => Boolean(asset));
    return {
      campaign: row.campaign,
      output: row,
      business: smartCardId ? cardsById.get(smartCardId) ?? null : null,
      asset: assetId ? assetsById.get(assetId) ?? null : null,
      creativeAssets,
      creativeQrArtwork: qrArtworkByCampaign.get(row.campaign.id) ?? {},
    };
  });
}

export function indexPublicCampaignCreativeAssets(
  rows: readonly unknown[],
  expectedAssetIdsByCampaign: ExpectedPublicCampaignAssetIds,
): Map<string, PublicCampaignCreativeAssets> {
  const indexed = new Map<string, PublicCampaignCreativeAssets>();
  for (const value of rows) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as PublicCampaignAssetProjectionRow;
    if (
      typeof row.campaign_id !== 'string'
      || (row.destination !== 'discovery' && row.destination !== 'qr')
    ) continue;
    const expectedAssetId = expectedAssetIdsByCampaign.get(row.campaign_id)?.[row.destination];
    if (
      !expectedAssetId
      || !row.asset
      || typeof row.asset !== 'object'
      || Array.isArray(row.asset)
    ) continue;

    const payload = row.asset as Record<string, unknown>;
    const title = cleanProjectedText(payload.title);
    const assetType = cleanProjectedText(payload.asset_type);
    if (!title || !assetType) continue;
    const current = indexed.get(row.campaign_id) ?? {};
    if (current[row.destination]) continue;
    indexed.set(row.campaign_id, {
      ...current,
      [row.destination]: {
        id: expectedAssetId,
        title,
        asset_type: assetType,
        file_url: cleanProjectedAssetUrl(payload.file_url),
        external_url: cleanProjectedAssetUrl(payload.external_url),
        thumbnail_url: cleanProjectedAssetUrl(payload.thumbnail_url),
      },
    });
  }
  return indexed;
}

function cleanProjectedText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function cleanProjectedAssetUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
    ? value.trim()
    : null;
}

export function indexPublicCampaignQrArtwork(
  rows: readonly unknown[],
  expectedQrIdsByCampaign: ExpectedPublicCampaignQrIds,
): Map<string, PublicCampaignQrArtwork> {
  const indexed = new Map<string, PublicCampaignQrArtwork>();
  for (const value of rows) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as PublicCampaignQrArtworkRow;
    if (
      typeof row.campaign_id !== 'string'
      || (row.destination !== 'discovery' && row.destination !== 'qr')
    ) continue;
    const expectedQrId = expectedQrIdsByCampaign.get(row.campaign_id)?.[row.destination];
    if (
      !expectedQrId
      || !row.qr_artwork
      || typeof row.qr_artwork !== 'object'
      || Array.isArray(row.qr_artwork)
    ) continue;
    const current = indexed.get(row.campaign_id) ?? {};
    if (current[row.destination]) continue;
    const artwork = normalizeQRStudioVisualArtwork({
      ...(row.qr_artwork as Record<string, unknown>),
      id: expectedQrId,
      title: 'Campaign QR code',
    });
    if (!artwork) continue;
    indexed.set(row.campaign_id, {
      ...current,
      [row.destination]: artwork,
    });
  }
  return indexed;
}

export function getCampaignImage(experience: PublicCampaignExperience): string | null {
  return experience.asset?.file_url
    || experience.asset?.thumbnail_url
    || experience.asset?.external_url
    || experience.business?.cover_image_url
    || experience.business?.logo_url
    || null;
}

export function getCampaignFormat(experience: PublicCampaignExperience): string {
  const format = experience.output.metadata?.format;
  return typeof format === 'string' && format ? format : 'tap_reveal';
}

export function getCampaignDestination(experience: PublicCampaignExperience): string | null {
  const campaignDestination = safeHttpUrl(experience.campaign.cta_url);
  if (campaignDestination) return campaignDestination;
  if (experience.business) return `/c/${experience.business.slug}#offers`;
  return null;
}

export async function trackCampaignEvent(
  experience: PublicCampaignExperience,
  eventType: CampaignEventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from('campaign_events').insert({
    campaign_id: experience.campaign.id,
    business_card_id: experience.business?.id ?? null,
    output_type: 'interactive_ad',
    event_type: eventType,
    user_agent: navigator.userAgent,
    referrer: document.referrer || null,
    metadata,
  });

  if (error) throw new Error(error.message);
}

const savedCampaignStorageKey = 'adpadz-saved-campaigns';

export function readSavedCampaignIds(): Set<string> {
  try {
    const value = window.localStorage.getItem(savedCampaignStorageKey);
    const parsed = value ? JSON.parse(value) as unknown : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

export function writeSavedCampaignIds(ids: Set<string>): void {
  window.localStorage.setItem(savedCampaignStorageKey, JSON.stringify(Array.from(ids)));
}
const PUBLIC_CREATIVE_DESTINATIONS: readonly PublicCampaignQrDestination[] = [
  'discovery',
  'qr',
];
