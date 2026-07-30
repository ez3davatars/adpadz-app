import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { geometryForMailer } from "./communityMailerProductionContracts";
import type { CommunityCardFormat } from "./communityCards";
import { getDestinationSafeBounds } from "../features/campaign-templates/creativeDestinations";
import { createDisplayHeadline } from "../features/campaign-templates/normalizeCampaignContent";
import { normalizeCreativeSettings } from "../features/campaign-templates/creativeWorkshop";
import type { NormalizedBox } from "../features/campaign-templates/types";
import {
  resolveCommunityMailerQrPrintBox,
  type CommunityMailerQrPrintBox,
} from "./communityMailerQrGeometry";
import {
  MIN_PRODUCTION_QR_CONTRAST_RATIO,
  normalizeQRStudioProductionArtwork,
  qrContrastRatio,
  type QRStudioProductionArtwork,
} from "./qr/qrArtwork";
export { qrContrastRatio } from "./qr/qrArtwork";
export const COMMUNITY_MAILER_CANDIDATE_GENERATOR_VERSION = "2.0.0";

export type CandidatePlacement = {
  id: string;
  slotKey: string;
  side: "front" | "back";
  x: number;
  y: number;
  width: number;
  height: number;
  campaignId: string;
  businessId: string;
  businessName: string;
  headline: string;
  description?: string | null;
  offer?: string | null;
  offerDetails?: string | null;
  cta?: string | null;
  phone?: string | null;
  website?: string | null;
  expiration?: string | null;
  businessLogoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  creativeAssetId: string;
  creativeUrl: string;
  qrLinkId: string;
  qrDestination: string;
  associatedQrLinkId?: string | null;
  associatedQrDestination?: string | null;
  qrShortUrl?: string | null;
  qrForegroundColor?: string | null;
  qrBackgroundColor?: string | null;
  snapshotFingerprint: string;
  creativeSettings?: Record<string, unknown> | null;
  creativeFormatKey?: string | null;
  creativeVersionId?: string | null;
  creativeSettingsFingerprint?: string | null;
  creativeSnapshotContractVersion?: number | null;
  creativeRenderContractVersion?: number | null;
  qrArtwork?: QRStudioProductionArtwork | null;
  /** Compatibility alias for v1 candidate consumers. */
  templateSettings?: Record<string, unknown> | null;
};

export type CandidateInput = {
  mailerId: string;
  title: string;
  zoneName: string;
  format: CommunityCardFormat;
  layoutRevision: number;
  preflightRunId: string;
  preflightFingerprint: string;
  generatedAt: string;
  confirmations: Record<string, boolean | number | string | null>;
  preflightReport: unknown;
  placements: CandidatePlacement[];
};

export type CandidateFile = {
  name: string;
  contentType: string;
  bytes: Uint8Array;
  checksum: string;
};

export type CandidatePackage = {
  files: CandidateFile[];
  checksum: string;
  storagePrefix: string;
  manifest: Record<string, unknown>;
};

export type CandidateDependencies = {
  renderPlacement: (
    input: CandidateInput,
    placement: CandidatePlacement,
    options: CandidatePlacementRenderOptions,
  ) => Promise<Uint8Array>;
  renderPreview: (
    input: CandidateInput,
    side: "front" | "back",
    placements: readonly CandidateRenderedPlacement[],
  ) => Promise<Uint8Array>;
};

export type CandidatePlacementRenderOptions = {
  width: number;
  height: number;
  physicalWidthInches: number;
  qrBox: NormalizedBox | null;
};

export type CandidateRenderedPlacement = CandidatePlacementRenderOptions & {
  placementId: string;
  bytes: Uint8Array;
  checksum: string;
  qrModuleFieldInches: number | null;
};

const encoder = new TextEncoder();
const occupiedForSide = (input: CandidateInput, side: "front" | "back") =>
  input.placements.filter((placement) => placement.side === side);

export async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function candidateEligibility(input: CandidateInput) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!input.preflightFingerprint) blockers.push("Current preflight is missing.");
  if (!input.placements.length) blockers.push("No occupied placements exist.");
  for (const placement of input.placements) {
    if (!placement.campaignId) blockers.push(`${placement.slotKey} has no Campaign assignment.`);
    if (!placement.creativeUrl || !placement.creativeAssetId) {
      blockers.push(`${placement.slotKey} has no immutable creative reference.`);
    }
    if (!placement.qrLinkId || !placement.qrDestination) {
      blockers.push(`${placement.slotKey} has no complete QR association.`);
    }
    if (!placement.snapshotFingerprint) blockers.push(`${placement.slotKey} has no production snapshot.`);
    if ((placement.creativeRenderContractVersion ?? 0) < 1) {
      blockers.push(`${placement.slotKey} must be resnapshotted with the exact render-input contract.`);
    }
    const rawSettings = placement.creativeSettings || placement.templateSettings;
    if (!rawSettings) blockers.push(`${placement.slotKey} has no bound Mailer creative settings.`);
    const settings = normalizeCreativeSettings(rawSettings);
    if (placement.creativeVersionId && !placement.creativeSettingsFingerprint) {
      blockers.push(`${placement.slotKey} has an incomplete creative-version binding.`);
    }
    if (settings.imageAssetId && settings.imageAssetId !== placement.creativeAssetId) {
      blockers.push(`${placement.slotKey} did not resolve the selected Workshop image asset.`);
    }
    const artwork = normalizeQRStudioProductionArtwork(placement.qrArtwork);
    if (settings.showQr) {
      if (!placement.qrShortUrl || !/^https?:\/\//i.test(placement.qrShortUrl)) {
        blockers.push(`${placement.slotKey} has no production short-link URL.`);
      }
      if (
        placement.associatedQrLinkId !== placement.qrLinkId
        || placement.associatedQrDestination !== placement.qrDestination
      ) {
        blockers.push(`${placement.slotKey} QR production association differs from the bound artwork.`);
      }
      if (!artwork || artwork.id !== placement.qrLinkId) {
        blockers.push(`${placement.slotKey} has no exact bound QR Studio artwork.`);
      } else {
        if (artwork.status !== "active" || (artwork.expires_at && Date.parse(artwork.expires_at) <= Date.parse(input.generatedAt))) {
          blockers.push(`${placement.slotKey} QR Studio artwork is inactive or expired.`);
        }
        if (artwork.destination_url !== placement.qrDestination) {
          blockers.push(`${placement.slotKey} QR artwork does not match the production association.`);
        }
        const contrast = qrContrastRatio(artwork.foreground_color, artwork.inner_field_color);
        if ((contrast ?? 0) < MIN_PRODUCTION_QR_CONTRAST_RATIO) blockers.push(`${placement.slotKey} QR contrast is below ${MIN_PRODUCTION_QR_CONTRAST_RATIO}:1.`);
        const printBox = resolveCandidateQrPrintBox(input, placement, artwork);
        if (!printBox) blockers.push(`${placement.slotKey} cannot fit the exact QR artwork at the print minimum.`);
        else if (printBox.adjusted) warnings.push(`${placement.slotKey} QR artwork is enlarged to preserve the ${geometryForMailer(input.format).qrMinimumInches}-inch module field.`);
      }
    }
    const displayHeadline = candidateDisplayHeadline(placement);
    if (
      Array.from(displayHeadline).length > 52
      || displayHeadline.split(/\s+/).length > 6
    ) {
      blockers.push(`${placement.slotKey} display headline exceeds the render contract.`);
    }
  }
  return { eligible: blockers.length === 0, blockers, warnings };
}

export type CandidateQrPrintBox = CommunityMailerQrPrintBox;

export function candidateDisplayHeadline(
  placement: Pick<CandidatePlacement, "headline" | "offer">,
) {
  return createDisplayHeadline({
    headline: placement.headline,
    title: placement.headline,
    offer_title: placement.offer,
  });
}

export function resolveCandidateQrPrintBox(
  input: CandidateInput,
  placement: CandidatePlacement,
  artwork = normalizeQRStudioProductionArtwork(placement.qrArtwork),
): CandidateQrPrintBox | null {
  const settings = normalizeCreativeSettings(placement.creativeSettings || placement.templateSettings);
  const geometry = geometryForMailer(input.format);
  const placementWidthInches =
    geometry.finishedWidthInches * placement.width / 100;
  const placementHeightInches =
    geometry.finishedHeightInches * placement.height / 100;
  return resolveCommunityMailerQrPrintBox({
    pageFormat: input.format,
    placementWidthPercent: placement.width,
    placementHeightPercent: placement.height,
    settings,
    artwork,
    safeBounds: getDestinationSafeBounds(
      "mailer",
      placement.creativeFormatKey,
      { widthInches: placementWidthInches, heightInches: placementHeightInches },
    ),
  });
}

async function composePdf(
  input: CandidateInput,
  side: "front" | "back",
  renderedByPlacement: ReadonlyMap<string, CandidateRenderedPlacement>,
) {
  const document = await PDFDocument.create();
  document.setTitle(`${input.title} ${side} Production Candidate`);
  document.setProducer(`Adpadz Community Mailer ${COMMUNITY_MAILER_CANDIDATE_GENERATOR_VERSION}`);
  document.setCreationDate(new Date(input.generatedAt));
  const geometry = geometryForMailer(input.format);
  const pageWidth = geometry.bleedWidthInches * 72;
  const pageHeight = geometry.bleedHeightInches * 72;
  const page = document.addPage([pageWidth, pageHeight]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(1, 1, 1) });
  for (const placement of occupiedForSide(input, side)) {
    const rendered = renderedByPlacement.get(placement.id);
    if (!rendered) throw new Error(`${placement.slotKey} exact creative raster is missing.`);
    const x = placement.x / 100 * pageWidth;
    const y = pageHeight - (placement.y + placement.height) / 100 * pageHeight;
    const width = placement.width / 100 * pageWidth;
    const height = placement.height / 100 * pageHeight;
    let image;
    try {
      image = await document.embedPng(rendered.bytes);
    } catch {
      throw new Error(`${placement.slotKey} exact creative raster is not a valid PNG.`);
    }
    page.drawImage(image, { x, y, width, height });
    page.drawRectangle({ x, y, width, height, borderWidth: 0.5, borderColor: rgb(0.15, 0.18, 0.22) });
  }
  page.drawText(
    `PRODUCTION CANDIDATE - NOT PRINTER CERTIFIED - revision ${input.layoutRevision}`,
    { x: 8, y: 3, size: 5, font, color: rgb(0.35, 0.35, 0.35) },
  );
  return document.save({ useObjectStreams: false });
}
function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function generateCommunityMailerCandidate(
  input: CandidateInput,
  dependencies: CandidateDependencies,
): Promise<CandidatePackage> {
  const eligibility = candidateEligibility(input);
  if (!eligibility.eligible) throw new Error(eligibility.blockers.join(" "));
  const geometry = geometryForMailer(input.format);
  const renderedPlacements = await Promise.all(input.placements.map(async placement => {
    const settings = normalizeCreativeSettings(placement.creativeSettings || placement.templateSettings);
    const qrPrint = settings.showQr ? resolveCandidateQrPrintBox(input, placement) : null;
    if (settings.showQr && !qrPrint) {
      throw new Error(`${placement.slotKey} cannot fit the exact QR artwork at the print minimum.`);
    }
    const options: CandidatePlacementRenderOptions = {
      width: Math.max(1, Math.round(geometry.bleedPixels.width * placement.width / 100)),
      height: Math.max(1, Math.round(geometry.bleedPixels.height * placement.height / 100)),
      physicalWidthInches: geometry.finishedWidthInches * placement.width / 100,
      qrBox: qrPrint?.box ?? null,
    };
    const bytes = await dependencies.renderPlacement(input, placement, options);
    if (!isPng(bytes)) throw new Error(`${placement.slotKey} exact creative renderer did not produce a PNG.`);
    return {
      ...options,
      placementId: placement.id,
      bytes,
      checksum: await sha256Hex(bytes),
      qrModuleFieldInches: qrPrint?.moduleFieldInches ?? null,
    } satisfies CandidateRenderedPlacement;
  }));
  const renderedByPlacement = new Map(renderedPlacements.map(item => [item.placementId, item]));
  const manifestPlacements = await Promise.all(input.placements.map(async placement => {
    const rendered = renderedByPlacement.get(placement.id)!;
    const artwork = normalizeQRStudioProductionArtwork(placement.qrArtwork);
    return {
      placementId: placement.id,
      campaignId: placement.campaignId,
      snapshotFingerprint: placement.snapshotFingerprint,
      creativeSnapshotContractVersion: placement.creativeSnapshotContractVersion,
      creativeRenderContractVersion: placement.creativeRenderContractVersion,
      creativeSettings: placement.creativeSettings || placement.templateSettings || null,
      creativeFormatKey: placement.creativeFormatKey || "standard",
      creativeVersionId: placement.creativeVersionId || null,
      creativeVersionClaimed: Boolean(placement.creativeVersionId),
      creativeSettingsFingerprint: placement.creativeSettingsFingerprint || null,
      resolvedImageAssetId: placement.creativeAssetId,
      resolvedImageUrl: placement.creativeUrl,
      qrArtworkSnapshot: artwork,
      encodedShortUrl: placement.qrShortUrl || null,
      associatedQrLinkId: placement.associatedQrLinkId || null,
      associatedQrDestination: placement.associatedQrDestination || null,
      qrArtworkFingerprint: artwork
        ? await sha256Hex(encoder.encode(JSON.stringify(artwork)))
        : null,
      qrPrintBox: rendered.qrBox,
      qrModuleFieldInches: rendered.qrModuleFieldInches,
      renderedCreativeChecksum: rendered.checksum,
      templateSettings: placement.creativeSettings || placement.templateSettings || null,
    };
  }));
  const manifest = {
    schema: "adpadz.community-mailer.production-candidate.v2",
    generatorVersion: COMMUNITY_MAILER_CANDIDATE_GENERATOR_VERSION,
    generatedAt: input.generatedAt,
    mailerId: input.mailerId,
    zoneName: input.zoneName,
    format: input.format,
    layoutRevision: input.layoutRevision,
    preflightRunId: input.preflightRunId,
    preflightFingerprint: input.preflightFingerprint,
    geometry,
    classification: "Production Candidate",
    templateContractVersion: 2,
    creativeRenderContractVersion: 1,
    creativeRenderer: "CampaignTemplateRenderer",
    qrRenderer: "QRStudioPreview/CircularPadQR",
    placements: manifestPlacements,
    printerCertified: false,
    warnings: eligibility.warnings,
    caveats: [
      "Not printer certified.",
      "QR artwork may be enlarged from its screen template box to preserve the recorded print module-field minimum.",
      "Printer must confirm embedded fonts, color conversion, postal compliance, and final imposition.",
    ],
  };
  const placementCsv = [
    ["placement_id", "slot_key", "side", "campaign_id", "business_id", "creative_asset_id", "snapshot_fingerprint", "rendered_creative_checksum"],
    ...input.placements.map(placement => [
      placement.id,
      placement.slotKey,
      placement.side,
      placement.campaignId,
      placement.businessId,
      placement.creativeAssetId,
      placement.snapshotFingerprint,
      renderedByPlacement.get(placement.id)?.checksum || "",
    ]),
  ].map(row => row.map(csvCell).join(",")).join("\r\n");
  const qrManifest = await Promise.all(input.placements.map(async placement => {
    const artwork = normalizeQRStudioProductionArtwork(placement.qrArtwork);
    const rendered = renderedByPlacement.get(placement.id)!;
    return {
      placementId: placement.id,
      slotKey: placement.slotKey,
      campaignId: placement.campaignId,
      businessId: placement.businessId,
      mailerId: input.mailerId,
      mailerRevision: input.layoutRevision,
      zoneName: input.zoneName,
      qrLinkId: placement.qrLinkId,
      destination: placement.qrDestination,
      encodedShortUrl: placement.qrShortUrl || null,
      associatedQrLinkId: placement.associatedQrLinkId || null,
      associatedQrDestination: placement.associatedQrDestination || null,
      slug: artwork?.slug ?? null,
      stylePreset: artwork?.style_preset ?? null,
      artworkFingerprint: artwork
        ? await sha256Hex(encoder.encode(JSON.stringify(artwork)))
        : null,
      minimumRecommendedInches: geometry.qrMinimumInches,
      renderedModuleFieldInches: rendered.qrModuleFieldInches,
      printBox: rendered.qrBox,
      contrastRatio: artwork
        ? qrContrastRatio(artwork.foreground_color, artwork.inner_field_color)
        : null,
    };
  }));
  const advertiserCsv = [
    ["placement_id", "slot_key", "business_id", "business_name", "campaign_id"],
    ...input.placements.map(placement => [
      placement.id,
      placement.slotKey,
      placement.businessId,
      placement.businessName,
      placement.campaignId,
    ]),
  ].map(row => row.map(csvCell).join(",")).join("\r\n");
  const rawFiles = [
    ["front.pdf", "application/pdf", await composePdf(input, "front", renderedByPlacement)],
    ["back.pdf", "application/pdf", await composePdf(input, "back", renderedByPlacement)],
    ["front.png", "image/png", await dependencies.renderPreview(input, "front", renderedPlacements)],
    ["back.png", "image/png", await dependencies.renderPreview(input, "back", renderedPlacements)],
    ["production-manifest.json", "application/json", encoder.encode(JSON.stringify(manifest, null, 2))],
    ["placement-manifest.csv", "text/csv", encoder.encode(placementCsv)],
    ["advertiser-manifest.csv", "text/csv", encoder.encode(advertiserCsv)],
    ["qr-manifest.json", "application/json", encoder.encode(JSON.stringify(qrManifest, null, 2))],
    ["preflight-report.json", "application/json", encoder.encode(JSON.stringify(input.preflightReport, null, 2))],
    ["confirmation-record.json", "application/json", encoder.encode(JSON.stringify(input.confirmations, null, 2))],
  ] as const;
  const files = await Promise.all(rawFiles.map(async ([name, contentType, bytes]) => ({
    name,
    contentType,
    bytes,
    checksum: await sha256Hex(bytes),
  })));
  const checksum = await sha256Hex(encoder.encode(
    files.map(file => `${file.name}:${file.checksum}`).sort().join("\n"),
  ));
  return {
    files,
    checksum,
    storagePrefix: `community-mailers/${input.mailerId}/revisions/${input.layoutRevision}/production-candidate/`,
    manifest,
  };
}

function isPng(bytes: Uint8Array) {
  return bytes.length > 8 && bytes[0] === 137 && bytes[1] === 80
    && bytes[2] === 78 && bytes[3] === 71;
}
