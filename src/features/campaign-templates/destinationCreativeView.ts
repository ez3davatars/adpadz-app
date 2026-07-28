import type { CampaignRecord } from "../../lib/ads";
import type { QRLinkRecord } from "../../lib/qr/qrTypes";
import {
  resolveDestinationCreative,
  type CreativeAssetReference,
  type CreativeDestination,
  type CreativeQrReference,
  type DestinationCreativeResolution,
} from "./creativeWorkshop";
import { normalizeCampaignContent } from "./normalizeCampaignContent";
import type { CampaignTemplateContent } from "./types";

/**
 * Shared wiring for every surface that renders one saved Campaign creative:
 * resolve the saved destination settings, apply the fallback guard, and
 * normalize the render content — in one pure call.
 *
 * The guard: the campaign fallback image is only offered to the resolver when
 * the saved creative has NOT chosen an explicit Workshop image. A chosen but
 * unavailable image must surface as an issue, never be silently substituted.
 */

/** Minimal shape a caller-authorized QR candidate must satisfy. */
export type DestinationCreativeQrCandidate = { id: string };

export type DestinationCreativeViewInput<
  Q extends DestinationCreativeQrCandidate = QRLinkRecord,
> = {
  /** campaign_outputs.metadata for the interactive output. */
  metadata: unknown;
  destination: CreativeDestination;
  campaign: CampaignRecord;
  businessName?: string | null;
  businessPhone?: string | null;
  businessWebsite?: string | null;
  businessLogoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  assets?: readonly CreativeAssetReference[];
  /** Candidate QR record already authorized by the calling surface. */
  qr?: Q | null;
  /** Public URL for the candidate QR. */
  qrPublicUrl?: string | null;
  /**
   * Pre-authorized QR references. When provided this list is used verbatim
   * and takes precedence over the single `qr` candidate.
   */
  qrLinks?: readonly CreativeQrReference[];
  fallbackImageUrl?: string | null;
  fallbackDestinationUrl?: string | null;
};

export type DestinationCreativeView<
  Q extends DestinationCreativeQrCandidate = QRLinkRecord,
> = {
  resolved: DestinationCreativeResolution;
  content: CampaignTemplateContent;
  /** The candidate `qr` only when the saved QR choice resolved exactly. */
  exactQr: Q | null;
};

export function buildDestinationCreativeView<Q extends DestinationCreativeQrCandidate>(
  input: DestinationCreativeViewInput<Q>,
): DestinationCreativeView<Q> {
  const saved = resolveDestinationCreative(input.metadata, input.destination);
  const resolved = resolveDestinationCreative(input.metadata, input.destination, {
    assets: input.assets,
    qrLinks: input.qrLinks
      ?? (input.qr ? [{ id: input.qr.id, publicUrl: input.qrPublicUrl ?? null }] : []),
    fallbackImageUrl: saved.imageAssetId ? null : input.fallbackImageUrl,
    fallbackDestinationUrl: input.fallbackDestinationUrl,
  });
  const content = normalizeCampaignContent({
    campaign: input.campaign,
    businessName: input.businessName,
    businessPhone: input.businessPhone,
    businessWebsite: input.businessWebsite,
    businessLogoUrl: input.businessLogoUrl,
    imageUrl: resolved.imageUrl,
    destinationUrl: resolved.qrDestinationUrl,
    primaryColor: input.primaryColor,
    accentColor: input.accentColor,
  });
  return {
    resolved,
    content,
    exactQr: resolved.qrResolution === "exact" ? input.qr ?? null : null,
  };
}
