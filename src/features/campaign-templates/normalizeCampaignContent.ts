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
    headline: createDisplayHeadline(campaign),
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

export function createDisplayHeadline(
  campaign: Pick<CampaignRecord, "title" | "headline" | "offer_title">,
): string {
  const maximumLength = 52;
  const headline = clean(campaign.headline);
  const offer = clean(campaign.offer_title);
  const candidates = [
    headline,
    offer,
    !headline && !offer ? clean(campaign.title) : null,
  ].filter((value): value is string => Boolean(value));
  const naturallyShort = candidates.find(value =>
    value.split(/\s+/).length <= 6 && Array.from(value).length <= maximumLength
  );
  if (naturallyShort) return naturallyShort;
  const source = candidates[0] || "Local campaign";
  const sourceWords = source.split(/\s+/);
  const displayWords = sourceWords.slice(0, 6);
  while (
    displayWords.length > 2 &&
    Array.from(displayWords.join(" ")).length > maximumLength - 4
  ) {
    displayWords.pop();
  }
  const display = displayWords.join(" ");
  const displayCharacters = Array.from(display);
  if (displayCharacters.length > maximumLength) {
    const capped = displayCharacters
      .slice(0, maximumLength - 1)
      .join("")
      .trimEnd();
    return `${capped}\u2026`;
  }
  return sourceWords.length > displayWords.length || display.length < source.length
    ? `${display}…`
    : display;
}

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validColor(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}
