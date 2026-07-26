import type { CampaignRecord } from "../../lib/ads";

export type CampaignTemplateKey =
  | "hero-visual"
  | "offer-first"
  | "brand-focus"
  | "featured-sponsor";

export type CampaignTemplateDestination =
  | "studio"
  | "mailer"
  | "discovery"
  | "qr"
  | "social-square"
  | "social-portrait"
  | "social-landscape"
  | "social-story";

export type CampaignTheme = "dark" | "light";
export type CampaignImageFit = "cover" | "contain";

export type NormalizedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CampaignTemplateLayout = {
  image: NormalizedBox;
  logo: NormalizedBox;
  copy: NormalizedBox;
  cta: NormalizedBox;
  qr: NormalizedBox;
  expiration: NormalizedBox;
};

export type CampaignTemplateDefinition = {
  key: CampaignTemplateKey;
  label: string;
  description: string;
  bestFor: string;
  defaultLayout: CampaignTemplateLayout;
};

export type CampaignTemplateSettings = {
  version: 1;
  template: CampaignTemplateKey;
  imageFit: CampaignImageFit;
  imagePositionX: number;
  imagePositionY: number;
  imageZoom: number;
  showQr: boolean;
  showExpiration: boolean;
  theme: CampaignTheme;
};

export type CampaignTemplateContent = {
  campaignId: string;
  businessName: string;
  businessPhone: string | null;
  businessWebsite: string | null;
  businessLogoUrl: string | null;
  imageUrl: string | null;
  headline: string;
  description: string;
  offer: string;
  offerDetails: string;
  ctaLabel: string;
  destinationUrl: string | null;
  expiration: string | null;
  primaryColor: string;
  accentColor: string;
  campaign: CampaignRecord;
};

export type TemplateReadinessIssue = {
  field: "business_name" | "headline" | "image" | "offer" | "logo" | "qr" | "expiration";
  severity: "blocker" | "warning";
  message: string;
};
