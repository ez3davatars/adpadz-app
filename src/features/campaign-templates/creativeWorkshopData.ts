import type { CampaignOutputRecord, CampaignRecord } from "../../lib/ads";
import type { QRLinkRecord } from "../../lib/qr/qrTypes";
import { supabase } from "../../lib/supabase";
import { normalizeCampaignContent } from "./normalizeCampaignContent";
import {
  listActiveCreativeAssetOptions,
  normalizeWorkshopState,
  type CreativeWorkshopState,
} from "./creativeWorkshop";
import { isCreativeQrUsableForCampaign } from "./creativeWorkshopState";

export type CreativeAssetRecord = {
  id: string;
  title: string;
  file_url: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
};

export type CreativeBusinessProfile = {
  business_name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
};

export type CreativeBusinessIdentity = {
  name: string;
  phone: string | null;
  website: string | null;
};

export type LoadedCreativeWorkshop = {
  campaign: CampaignRecord;
  output: CampaignOutputRecord | null;
  assets: CreativeAssetRecord[];
  pickerAssets: CreativeAssetRecord[];
  profile: CreativeBusinessProfile | null;
  business: CreativeBusinessIdentity | null;
  qrs: QRLinkRecord[];
};

export type LoadedCreativeWorkshopResult = {
  loaded: LoadedCreativeWorkshop;
  state: CreativeWorkshopState;
};

export async function loadCreativeWorkshop(
  campaignId: string,
): Promise<LoadedCreativeWorkshopResult> {
  const auth = await supabase.auth.getUser();
  if (auth.error) throw new Error(auth.error.message);
  if (!auth.data.user) throw new Error("Sign in to open Creative Director.");
  const ownerId = auth.data.user.id;
  const campaignResult = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("owner_id", ownerId)
    .single();
  if (campaignResult.error) throw new Error(campaignResult.error.message);
  const campaign = campaignResult.data as CampaignRecord;

  const assetRequest = campaign.business_id
    ? supabase
        .from("business_marketing_assets")
        .select("id,title,file_url,external_url,thumbnail_url,is_active")
        .eq("owner_id", ownerId)
        .eq("business_id", campaign.business_id)
        .order("updated_at", { ascending: false })
    : Promise.resolve({
        data: [] as CreativeAssetRecord[],
        error: null,
      });
  const profileRequest = campaign.business_id
    ? supabase
        .from("business_cards")
        .select(
          "business_name,logo_url,cover_image_url,primary_color,accent_color",
        )
        .eq("owner_user_id", ownerId)
        .eq("business_id", campaign.business_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({
        data: null as CreativeBusinessProfile | null,
        error: null,
      });
  const businessRequest = campaign.business_id
    ? supabase
        .from("businesses")
        .select("name,phone,website")
        .eq("id", campaign.business_id)
        .eq("owner_user_id", ownerId)
        .maybeSingle()
    : Promise.resolve({
        data: null as CreativeBusinessIdentity | null,
        error: null,
      });
  const activeQrExpiry = new Date().toISOString();
  const [outputResult, assetList, profileResult, businessResult, qrResult] =
    await Promise.all([
      supabase
        .from("campaign_outputs")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("output_type", "interactive_ad")
        .maybeSingle(),
      assetRequest,
      profileRequest,
      businessRequest,
      supabase
        .from("qr_links")
        .select("*")
        .eq("owner_user_id", ownerId)
        .eq("status", "active")
        .or(`expires_at.is.null,expires_at.gt.${activeQrExpiry}`)
        .order("updated_at", { ascending: false }),
    ]);

  for (const result of [
    outputResult,
    assetList,
    profileResult,
    businessResult,
    qrResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const output = outputResult.data as CampaignOutputRecord | null;
  const assets = (assetList.data ?? []) as CreativeAssetRecord[];
  const qrs = (qrResult.data ?? []) as QRLinkRecord[];
  const storedWorkshop = output?.metadata?.creative_workshop;
  const normalizedState = normalizeWorkshopState(
    storedWorkshop ?? output?.metadata?.template_settings,
  );
  const state = !storedWorkshop
    && campaign.primary_qr_id
    && qrs.some(qr =>
      qr.id === campaign.primary_qr_id
      && isCreativeQrUsableForCampaign(qr, {
        id: campaign.id,
        ownerId: campaign.owner_id,
        businessId: campaign.business_id,
      })
    )
    ? normalizeWorkshopState({
        ...normalizedState,
        global: {
          ...normalizedState.global,
          qrId: campaign.primary_qr_id,
          showQr: true,
        },
      })
    : normalizedState;

  return {
    loaded: {
      campaign,
      output,
      assets,
      pickerAssets: listActiveCreativeAssetOptions(assets),
      profile: profileResult.data as CreativeBusinessProfile | null,
      business: businessResult.data as CreativeBusinessIdentity | null,
      qrs,
    },
    state,
  };
}

export function buildCreativeContent(
  loaded: LoadedCreativeWorkshop,
  selectedQr: QRLinkRecord | null,
  imageUrl: string | null,
  origin = typeof window === "undefined"
    ? "https://adpadz.co"
    : window.location.origin,
) {
  return normalizeCampaignContent({
    campaign: loaded.campaign,
    businessName:
      loaded.business?.name || loaded.profile?.business_name,
    businessLogoUrl: loaded.profile?.logo_url,
    businessPhone: loaded.business?.phone,
    businessWebsite: loaded.business?.website,
    imageUrl,
    destinationUrl: selectedQr
      ? `${origin}/q/${selectedQr.slug}`
      : loaded.campaign.cta_url,
    primaryColor: loaded.profile?.primary_color,
    accentColor: loaded.profile?.accent_color,
  });
}
