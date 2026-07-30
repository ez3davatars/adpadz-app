import {
  canonicalCommunityMailerCreativePlacement,
  communityMailerRowGridPlacement,
} from "../../lib/communityMailerProductionContracts";

import type { CampaignTemplateDestination } from "./types";

/**
 * Single source of truth for every Campaign creative destination.
 *
 * One Campaign. Many Destinations. Every surface that needs the destination
 * list, its formats, aspect ratios, labels, renderer mapping, or print-safety
 * capabilities must derive it from this registry. Adding a future destination
 * (for example Adpadz TV) should be a single entry here plus a database
 * migration — never another hardcoded list.
 */

export const CREATIVE_DESTINATION_KEYS = [
  "mailer",
  "discovery",
  "qr",
  "social",
] as const;

export type CreativeDestination = (typeof CREATIVE_DESTINATION_KEYS)[number];

export type CreativeFormatKey =
  | "standard"
  | "combined"
  | "featured"
  | "card"
  | "hero"
  | "square"
  | "portrait"
  | "landscape"
  | "story";

export type CreativeSafeBounds = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CreativeFormatDefinition = {
  key: CreativeFormatKey;
  label: string;
  detail: string;
  /** CSS `aspect-ratio` value, e.g. "4 / 3". */
  ratio: string;
  /** Numeric aspect ratio (width / height) for layout math. */
  aspect: number;
  /** Renderer key override for formats that change the renderer destination. */
  rendererDestination?: CampaignTemplateDestination;
};

export type CreativeDestinationCapabilities = {
  /** Creative changes to this destination invalidate print production. */
  affectsPrint: boolean;
  /** The QR code must remain visible (print scannability). */
  requiresQr: boolean;
  /** Bleed and trim guides apply to this destination. */
  hasBleed: boolean;
  /** The Featured Sponsor template is allowed on this destination. */
  allowsFeaturedSponsor: boolean;
};

export type CreativeDestinationDefinition = {
  key: CreativeDestination;
  name: string;
  shortName: string;
  detail: string;
  rendererDestination: CampaignTemplateDestination;
  defaultFormat: CreativeFormatKey;
  formats: readonly CreativeFormatDefinition[];
  capabilities: CreativeDestinationCapabilities;
};

const DIGITAL_CAPABILITIES: CreativeDestinationCapabilities = Object.freeze({
  affectsPrint: false,
  requiresQr: false,
  hasBleed: false,
  allowsFeaturedSponsor: false,
});
const MAILER_STANDARD_GEOMETRY = communityMailerRowGridPlacement(1);
const MAILER_COMBINED_GEOMETRY = communityMailerRowGridPlacement(2);
const MAILER_FEATURED_GEOMETRY = communityMailerRowGridPlacement(4);


export const CREATIVE_DESTINATION_MAP: Readonly<
  Record<CreativeDestination, CreativeDestinationDefinition>
> = Object.freeze({
  mailer: {
    key: "mailer",
    name: "Community Mailer",
    shortName: "Mailer",
    detail: "Print-safe neighborhood placement",
    rendererDestination: "mailer",
    defaultFormat: "standard",
    formats: [
      {
        key: "standard",
        label: "Standard",
        detail: "Single-unit print placement",
        ratio: `${MAILER_STANDARD_GEOMETRY.widthInches} / ${MAILER_STANDARD_GEOMETRY.heightInches}`,
        aspect: MAILER_STANDARD_GEOMETRY.aspect,
      },
      {
        key: "combined",
        label: "Combined",
        detail: "Two-unit print placement",
        ratio: `${MAILER_COMBINED_GEOMETRY.widthInches} / ${MAILER_COMBINED_GEOMETRY.heightInches}`,
        aspect: MAILER_COMBINED_GEOMETRY.aspect,
      },
      {
        key: "featured",
        label: "Featured Sponsor",
        detail: "Full-row eligible placement",
        ratio: `${MAILER_FEATURED_GEOMETRY.widthInches} / ${MAILER_FEATURED_GEOMETRY.heightInches}`,
        aspect: MAILER_FEATURED_GEOMETRY.aspect,
      },
    ],
    capabilities: {
      affectsPrint: true,
      requiresQr: true,
      hasBleed: true,
      allowsFeaturedSponsor: true,
    },
  },
  discovery: {
    key: "discovery",
    name: "Consumer Discovery",
    shortName: "Discovery",
    detail: "Campaign-first browsing",
    rendererDestination: "discovery",
    defaultFormat: "card",
    formats: [
      { key: "card", label: "Discovery Card", detail: "Campaign feed", ratio: "1 / 1", aspect: 1 },
    ],
    capabilities: DIGITAL_CAPABILITIES,
  },
  qr: {
    key: "qr",
    name: "QR Landing",
    shortName: "QR Landing",
    detail: "Scan destination experience",
    rendererDestination: "qr",
    defaultFormat: "hero",
    formats: [
      { key: "hero", label: "Landing Hero", detail: "Mobile destination", ratio: "3 / 4", aspect: 3 / 4 },
    ],
    capabilities: DIGITAL_CAPABILITIES,
  },
  social: {
    key: "social",
    name: "Social Media",
    shortName: "Social",
    detail: "Square, portrait, landscape, story",
    rendererDestination: "social-square",
    defaultFormat: "square",
    formats: [
      { key: "square", label: "Square", detail: "1080 × 1080", ratio: "1 / 1", aspect: 1, rendererDestination: "social-square" },
      { key: "portrait", label: "Portrait", detail: "1080 × 1350", ratio: "4 / 5", aspect: 4 / 5, rendererDestination: "social-portrait" },
      { key: "landscape", label: "Landscape", detail: "1200 × 628", ratio: "1200 / 628", aspect: 1200 / 628, rendererDestination: "social-landscape" },
      { key: "story", label: "Story", detail: "1080 × 1920", ratio: "9 / 16", aspect: 9 / 16, rendererDestination: "social-story" },
    ],
    capabilities: DIGITAL_CAPABILITIES,
  },
});

export const CREATIVE_DESTINATIONS: readonly CreativeDestinationDefinition[] =
  Object.freeze(CREATIVE_DESTINATION_KEYS.map(key => CREATIVE_DESTINATION_MAP[key]));

export function isCreativeDestination(value: unknown): value is CreativeDestination {
  return typeof value === "string"
    && (CREATIVE_DESTINATION_KEYS as readonly string[]).includes(value);
}

export function getCreativeDestination(key: CreativeDestination): CreativeDestinationDefinition {
  return CREATIVE_DESTINATION_MAP[key];
}

export function getCreativeDestinationCapabilities(
  key: CreativeDestination,
): CreativeDestinationCapabilities {
  return CREATIVE_DESTINATION_MAP[key].capabilities;
}

/** Destinations whose creative definition participates in print production. */
export const PRINT_CREATIVE_DESTINATIONS: readonly CreativeDestination[] = Object.freeze(
  CREATIVE_DESTINATIONS.filter(item => item.capabilities.affectsPrint).map(item => item.key),
);

export function resolveCreativeFormatDefinition(
  destination: CreativeDestination,
  format?: string | null,
): CreativeFormatDefinition {
  const definition = CREATIVE_DESTINATION_MAP[destination];
  return definition.formats.find(item => item.key === format)
    ?? definition.formats.find(item => item.key === definition.defaultFormat)
    ?? definition.formats[0];
}

/** CSS `aspect-ratio` string for a destination + format pair. */
export function creativeFormatRatio(
  destination: CreativeDestination,
  format?: string | null,
): string {
  return resolveCreativeFormatDefinition(destination, format).ratio;
}

/** Numeric aspect ratio (width / height) for a destination + format pair. */
export function creativeFormatAspect(
  destination: CreativeDestination,
  format?: string | null,
): number {
  return resolveCreativeFormatDefinition(destination, format).aspect;
}

export type CreativePhysicalSize = {
  widthInches: number;
  heightInches: number;
};

export function getDestinationSafeBounds(
  destination: CreativeDestination,
  format?: string | null,
  physicalSize?: CreativePhysicalSize | null,
): CreativeSafeBounds {
  if (destination === "mailer") {
    const canonical = canonicalCommunityMailerCreativePlacement(format);
    const size = physicalSize ?? canonical;
    if (
      !size
      || !Number.isFinite(size.widthInches)
      || !Number.isFinite(size.heightInches)
      || size.widthInches <= 0
      || size.heightInches <= 0
    ) {
      return { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 };
    }
    const printSafeInsetInches = 0.125;
    return {
      top: printSafeInsetInches / size.heightInches,
      right: printSafeInsetInches / size.widthInches,
      bottom: printSafeInsetInches / size.heightInches,
      left: printSafeInsetInches / size.widthInches,
    };
  }
  if (destination === "qr") {
    return { top: 0.045, right: 0.05, bottom: 0.06, left: 0.05 };
  }
  if (destination === "social" && format === "story") {
    return { top: 0.08, right: 0.05, bottom: 0.11, left: 0.05 };
  }
  if (destination === "social") {
    return { top: 0.055, right: 0.055, bottom: 0.07, left: 0.055 };
  }
  return { top: 0.045, right: 0.045, bottom: 0.055, left: 0.045 };
}

export function creativeDestinationLabel(
  destination: CreativeDestination,
  variant: "name" | "short" = "short",
): string {
  const definition = CREATIVE_DESTINATION_MAP[destination];
  return variant === "name" ? definition.name : definition.shortName;
}

/** Maps a workshop destination + format to the renderer destination key. */
export function destinationToRenderer(
  destination: CreativeDestination,
  format?: CreativeFormatKey,
): CampaignTemplateDestination {
  const definition = CREATIVE_DESTINATION_MAP[destination];
  const formatDefinition = definition.formats.find(item => item.key === format);
  return formatDefinition?.rendererDestination ?? definition.rendererDestination;
}
