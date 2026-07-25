import type {
  CampaignTemplateDefinition,
  CampaignTemplateKey,
  CampaignTemplateLayout,
  CampaignTemplateSettings,
  NormalizedBox,
} from "./types";

const box = (x: number, y: number, width: number, height: number): NormalizedBox => ({ x, y, width, height });

const definitions: CampaignTemplateDefinition[] = [
  {
    key: "hero-visual",
    label: "Hero Visual",
    description: "A strong campaign image with concise supporting copy.",
    bestFor: "Services, experiences, transformations, and destination imagery.",
    defaultLayout: {
      image: box(0, 0, 1, .62), logo: box(.06, .05, .3, .1), copy: box(.06, .53, .88, .28),
      cta: box(.06, .84, .46, .1), qr: box(.78, .78, .16, .16), expiration: box(.06, .95, .6, .035),
    },
  },
  {
    key: "offer-first",
    label: "Offer First",
    description: "Makes the promotional value the clearest element.",
    bestFor: "Discounts, limited-time offers, and direct response.",
    defaultLayout: {
      image: box(.52, 0, .48, .48), logo: box(.06, .05, .34, .1), copy: box(.06, .22, .88, .48),
      cta: box(.06, .76, .48, .11), qr: box(.77, .75, .17, .17), expiration: box(.06, .91, .6, .04),
    },
  },
  {
    key: "brand-focus",
    label: "Brand Focus",
    description: "Leads with the local business identity and promise.",
    bestFor: "Awareness, new businesses, and evergreen promotion.",
    defaultLayout: {
      image: box(0, .48, 1, .52), logo: box(.07, .07, .38, .15), copy: box(.07, .25, .86, .29),
      cta: box(.07, .78, .46, .1), qr: box(.77, .76, .17, .17), expiration: box(.07, .92, .55, .04),
    },
  },
  {
    key: "featured-sponsor",
    label: "Featured Sponsor",
    description: "A premium, balanced layout for high-visibility placements.",
    bestFor: "Mailer features, community sponsorships, and premium campaigns.",
    defaultLayout: {
      image: box(.04, .04, .92, .48), logo: box(.08, .07, .32, .11), copy: box(.08, .48, .84, .3),
      cta: box(.08, .82, .48, .1), qr: box(.76, .78, .16, .16), expiration: box(.08, .94, .55, .035),
    },
  },
];

export const CAMPAIGN_TEMPLATE_REGISTRY = Object.freeze(
  Object.fromEntries(definitions.map(definition => [definition.key, Object.freeze(definition)])),
) as Readonly<Record<CampaignTemplateKey, CampaignTemplateDefinition>>;

export const CAMPAIGN_TEMPLATES = definitions;

export const DEFAULT_TEMPLATE_SETTINGS: CampaignTemplateSettings = Object.freeze({
  version: 1,
  template: "hero-visual",
  imageFit: "cover",
  imagePositionX: 50,
  imagePositionY: 50,
  imageZoom: 1,
  showQr: false,
  showExpiration: true,
  theme: "dark",
});

export function isCampaignTemplateKey(value: unknown): value is CampaignTemplateKey {
  return typeof value === "string" && value in CAMPAIGN_TEMPLATE_REGISTRY;
}

export function normalizeTemplateSettings(value: unknown): CampaignTemplateSettings {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const clamp = (candidate: unknown, min: number, max: number, fallback: number) => {
    const numeric = typeof candidate === "number" ? candidate : Number(candidate);
    return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
  };
  return {
    version: 1,
    template: isCampaignTemplateKey(input.template) ? input.template : DEFAULT_TEMPLATE_SETTINGS.template,
    imageFit: input.imageFit === "contain" ? "contain" : "cover",
    imagePositionX: clamp(input.imagePositionX, 0, 100, 50),
    imagePositionY: clamp(input.imagePositionY, 0, 100, 50),
    imageZoom: clamp(input.imageZoom, 1, 3, 1),
    showQr: input.showQr === true,
    showExpiration: input.showExpiration !== false,
    theme: input.theme === "light" ? "light" : "dark",
  };
}

export function resolveTemplateLayout(template: CampaignTemplateKey): CampaignTemplateLayout {
  return CAMPAIGN_TEMPLATE_REGISTRY[template].defaultLayout;
}

