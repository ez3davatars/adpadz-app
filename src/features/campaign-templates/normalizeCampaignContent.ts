import type { CampaignRecord } from "../../lib/ads";
import type { CampaignTemplateContent } from "./types";

export type CampaignContentSource = {
  campaign: CampaignRecord;
  businessName?: string | null;
  businessPhone?: string | null;
  businessWebsite?: string | null;
  businessLogoUrl?: string | null;
  imageUrl?: string | null;
  destinationUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
};

export function normalizeCampaignContent(source: CampaignContentSource): CampaignTemplateContent {
  const campaign = source.campaign;
  return {
    campaignId: campaign.id,
    businessName: clean(source.businessName) || "Local business",
    businessPhone: clean(source.businessPhone),
    businessWebsite: clean(source.businessWebsite),
    businessLogoUrl: clean(source.businessLogoUrl),
    imageUrl: clean(source.imageUrl),
    headline: clean(campaign.headline) || clean(campaign.title) || "Local campaign",
    description: clean(campaign.description) || "",
    offer: clean(campaign.offer_title) || "",
    offerDetails: clean(campaign.offer_description) || "",
    ctaLabel: clean(campaign.cta_label) || "Learn more",
    destinationUrl: clean(source.destinationUrl) || clean(campaign.cta_url),
    expiration: clean(campaign.end_date),
    primaryColor: validColor(source.primaryColor) || "#14251b",
    accentColor: validColor(source.accentColor) || "#b6ff00",
    campaign,
  };
}

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validColor(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}
